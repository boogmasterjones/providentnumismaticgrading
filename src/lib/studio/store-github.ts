/**
 * Production storage: the client's GitHub repository, through the GitHub REST API.
 *
 * - Every save is a commit on the drafts branch (default "studio-drafts") through the Contents API. The live branch
 *   (default "main") is untouched, so Netlify does not build (branch deploys are off).
 * - "What's changed" is GitHub's compare of live...drafts.
 * - Publish merges drafts into live with one merge commit: one Netlify build per publish. Drafts then fast-forwards
 *   to the merge, ready for the next round of edits.
 * - Undo puts a file on the drafts branch back to its live version; Undo all resets drafts to live.
 *
 * Reads use the Git trees and blobs APIs; blobs are cached by their hash, so a page preview costs one or two calls.
 */
import type { Fetch } from './github-app';
import { assertReadable, assertWritable, isTracked, StoreError, type Change, type ContentStore, type PublishResult } from './store';

export interface GitHubStoreOptions {
  repo: string;
  liveBranch: string;
  draftsBranch: string;
  tokens: { token(): Promise<string> };
  fetch?: Fetch;
}

interface TreeEntry {
  path: string;
  sha: string;
  type: string;
}

const API = 'https://api.github.com';
const blobCache = new Map<string, Uint8Array>();
const treeCache = new Map<string, Map<string, TreeEntry>>();

function remember<K, V>(map: Map<K, V>, k: K, v: V, max: number) {
  if (map.size >= max) map.delete(map.keys().next().value as K);
  map.set(k, v);
}

const enc = (path: string) => path.split('/').map(encodeURIComponent).join('/');
const toB64 = (c: string | Uint8Array) => Buffer.from(typeof c === 'string' ? Buffer.from(c, 'utf8') : c).toString('base64');

export class GitHubStore implements ContentStore {
  readonly mode = 'github' as const;
  private fetchFn: Fetch;
  private heads = new Map<string, string | null>();

  constructor(private o: GitHubStoreOptions) {
    this.fetchFn = o.fetch ?? globalThis.fetch;
  }

  private async api<T = unknown>(method: string, path: string, body?: unknown, okStatuses: number[] = []): Promise<{ status: number; json: T }> {
    const token = await this.o.tokens.token();
    const r = await this.fetchFn(`${API}/repos/${this.o.repo}${path}`, {
      method,
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token}`,
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'provident-studio',
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const json = (r.status === 204 ? null : await r.json().catch(() => null)) as T;
    if (!r.ok && !okStatuses.includes(r.status)) {
      // Never pass GitHub's message through verbatim to the browser; keep the status for the logs.
      const status = r.status === 401 || r.status === 403 ? 502 : r.status === 409 || r.status === 422 ? 409 : 502;
      throw new StoreError(
        status === 409
          ? 'Someone else changed the same thing at the same time. Reload and try again.'
          : `The website's storage (GitHub) did not answer as expected (status ${r.status}). Try again in a minute.`,
        status,
      );
    }
    return { status: r.status, json };
  }

  /** Latest commit of a branch, or null when the branch does not exist. */
  private async head(branch: string, fresh = false): Promise<string | null> {
    if (!fresh && this.heads.has(branch)) return this.heads.get(branch)!;
    const { status, json } = await this.api<{ object: { sha: string } }>('GET', `/git/ref/heads/${enc(branch)}`, undefined, [404]);
    const sha = status === 404 ? null : json.object.sha;
    this.heads.set(branch, sha);
    return sha;
  }

  private async liveHead(): Promise<string> {
    const sha = await this.head(this.o.liveBranch);
    if (!sha) throw new StoreError(`The live branch "${this.o.liveBranch}" was not found.`, 500);
    return sha;
  }

  /** The drafts branch, created from live the first time it is needed. */
  private async draftsHead(): Promise<string> {
    const sha = await this.head(this.o.draftsBranch);
    if (sha) return sha;
    const live = await this.liveHead();
    await this.api('POST', '/git/refs', { ref: `refs/heads/${this.o.draftsBranch}`, sha: live });
    this.heads.set(this.o.draftsBranch, live);
    return live;
  }

  /** The drafts head for reading: drafts if it exists, otherwise live. */
  private async readHead(): Promise<string> {
    return (await this.head(this.o.draftsBranch)) ?? (await this.liveHead());
  }

  private async tree(commit: string): Promise<Map<string, TreeEntry>> {
    const hit = treeCache.get(commit);
    if (hit) return hit;
    const { json } = await this.api<{ tree: TreeEntry[] }>('GET', `/git/trees/${commit}?recursive=1`);
    const map = new Map(json.tree.filter((e) => e.type === 'blob').map((e) => [e.path, e]));
    remember(treeCache, commit, map, 20);
    return map;
  }

  private async blob(sha: string): Promise<Uint8Array> {
    const hit = blobCache.get(sha);
    if (hit) return hit;
    const { json } = await this.api<{ content: string; encoding: string }>('GET', `/git/blobs/${sha}`);
    const bytes = new Uint8Array(Buffer.from(json.content, json.encoding === 'base64' ? 'base64' : 'utf8'));
    remember(blobCache, sha, bytes, 400);
    return bytes;
  }

  private async fileAt(commit: string, path: string): Promise<Uint8Array | null> {
    const e = (await this.tree(commit)).get(path);
    return e ? this.blob(e.sha) : null;
  }

  async read(path: string) {
    assertReadable(path);
    const b = await this.fileAt(await this.readHead(), path);
    return b ? Buffer.from(b).toString('utf8') : null;
  }

  async readBinary(path: string) {
    assertReadable(path);
    return this.fileAt(await this.readHead(), path);
  }

  /** The blob hash of a file in the drafts (an ETag for the media route). */
  async blobSha(path: string): Promise<string | null> {
    assertReadable(path);
    return (await this.tree(await this.readHead())).get(path)?.sha ?? null;
  }

  async list(dir: string) {
    const prefix = dir.endsWith('/') ? dir : dir + '/';
    assertReadable(prefix);
    return [...(await this.tree(await this.readHead())).keys()].filter((p) => p.startsWith(prefix)).sort();
  }

  private async put(path: string, content: string | Uint8Array, message: string) {
    const drafts = await this.draftsHead();
    const existing = (await this.tree(drafts)).get(path);
    const { json } = await this.api<{ commit: { sha: string } }>('PUT', `/contents/${enc(path)}`, {
      message,
      content: toB64(content),
      branch: this.o.draftsBranch,
      ...(existing ? { sha: existing.sha } : {}),
    });
    this.heads.set(this.o.draftsBranch, json.commit.sha);
  }

  async write(path: string, content: string | Uint8Array, message: string) {
    assertWritable(path);
    await this.put(path, content, message);
  }

  async remove(path: string, message: string) {
    assertWritable(path);
    const drafts = await this.draftsHead();
    const existing = (await this.tree(drafts)).get(path);
    if (!existing) return;
    const { json } = await this.api<{ commit: { sha: string } }>('DELETE', `/contents/${enc(path)}`, {
      message,
      sha: existing.sha,
      branch: this.o.draftsBranch,
    });
    this.heads.set(this.o.draftsBranch, json.commit.sha);
  }

  async readPublished(path: string) {
    assertReadable(path);
    const b = await this.fileAt(await this.liveHead(), path);
    return b ? Buffer.from(b).toString('utf8') : null;
  }

  async changes(): Promise<Change[]> {
    const drafts = await this.head(this.o.draftsBranch);
    if (!drafts) return [];
    const live = await this.liveHead();
    if (drafts === live) return [];
    const { json } = await this.api<{ files?: { filename: string; status: string }[] }>(
      'GET',
      `/compare/${enc(this.o.liveBranch)}...${enc(this.o.draftsBranch)}`,
    );
    return (json.files ?? [])
      .filter((f) => isTracked(f.filename))
      .map((f) => ({
        path: f.filename,
        status: f.status === 'added' ? 'added' : f.status === 'removed' ? 'deleted' : 'modified',
      }) satisfies Change)
      .sort((a, b) => a.path.localeCompare(b.path));
  }

  async undo(path: string) {
    assertWritable(path);
    const live = await this.fileAt(await this.liveHead(), path);
    if (live) await this.put(path, live, `Studio: undo changes to ${path}`);
    else await this.remove(path, `Studio: undo (remove new file) ${path}`);
  }

  async undoAll() {
    const live = await this.liveHead();
    if (!(await this.head(this.o.draftsBranch))) return;
    await this.api('PATCH', `/git/refs/heads/${enc(this.o.draftsBranch)}`, { sha: live, force: true });
    this.heads.set(this.o.draftsBranch, live);
  }

  async publish(message: string): Promise<PublishResult> {
    const changes = await this.changes();
    if (changes.length === 0) return { published: false, simulated: false, changes };
    const { status, json } = await this.api<{ sha: string } | null>(
      'POST',
      '/merges',
      { base: this.o.liveBranch, head: this.o.draftsBranch, commit_message: message },
      [409],
    );
    if (status === 409) {
      throw new StoreError('The live site changed in a way that clashes with these drafts. Ask your web person to merge them.', 409);
    }
    if (status === 204 || !json) return { published: false, simulated: false, changes: [] };
    // Fast-forward drafts to the published commit so the next edits start from the live site.
    await this.api('PATCH', `/git/refs/heads/${enc(this.o.draftsBranch)}`, { sha: json.sha, force: false }, [422]);
    this.heads.set(this.o.liveBranch, json.sha);
    this.heads.set(this.o.draftsBranch, json.sha);
    return { published: true, simulated: false, changes, commit: json.sha };
  }
}

/** For tests. */
export function clearGitHubCaches() {
  blobCache.clear();
  treeCache.clear();
}
