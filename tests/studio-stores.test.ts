/**
 * Provident Studio storage: local mode (files + git, in a throwaway repository) and GitHub mode (the GitHub REST API,
 * mocked: no network), including the GitHub App token exchange.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { createVerify, generateKeyPairSync } from 'node:crypto';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { LocalStore } from '../src/lib/studio/store-local';
import { GitHubStore, clearGitHubCaches } from '../src/lib/studio/store-github';
import { InstallationTokens, appJwt, normalizePem } from '../src/lib/studio/github-app';
import { StoreError } from '../src/lib/studio/store';

// ------------------------------------------------------------------------------------------------ local mode

describe('local mode (files and git)', () => {
  let dir: string;
  let store: LocalStore;
  const git = (...a: string[]) => execFileSync('git', a, { cwd: dir, encoding: 'utf8' });

  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), 'studio-local-'));
    git('init', '-q');
    git('config', 'user.email', 'test@example.test');
    git('config', 'user.name', 'Test');
    git('config', 'core.autocrlf', 'false');
    mkdirSync(join(dir, 'content/pages'), { recursive: true });
    writeFileSync(join(dir, 'content/faq.json'), '{\n  "items": []\n}\n');
    writeFileSync(join(dir, 'content/pages/home.mdoc'), '---\nheading: Hi\n---\n');
    git('add', '.');
    git('commit', '-q', '-m', 'init');
    store = new LocalStore(dir);
  });
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it('reads, writes and lists files', async () => {
    expect(await store.read('content/pages/home.mdoc')).toBe('---\nheading: Hi\n---\n');
    expect(await store.read('content/pages/none.mdoc')).toBeNull();
    await store.write('content/pages/home.mdoc', '---\nheading: Hello\n---\n', 'm');
    await store.write('public/images/home/a-1.webp', new Uint8Array([1, 2, 3]), 'm');
    expect(await store.list('content')).toEqual(['content/faq.json', 'content/pages/home.mdoc']);
    expect([...(await store.readBinary('public/images/home/a-1.webp'))!]).toEqual([1, 2, 3]);
  });

  it('lists changes against the last commit, by content', async () => {
    expect(await store.changes()).toEqual([
      { path: 'content/pages/home.mdoc', status: 'modified' },
      { path: 'public/images/home/a-1.webp', status: 'added' },
    ]);
    await store.write('content/faq.json', '{\n  "items": []\n}\n', 'same text'); // rewritten, but unchanged
    expect((await store.changes()).map((c) => c.path)).not.toContain('content/faq.json');
    expect(await store.readPublished('content/pages/home.mdoc')).toBe('---\nheading: Hi\n---\n');
  });

  it('simulates Publish with the diff and changes nothing', async () => {
    const r = await store.publish();
    expect(r).toMatchObject({ published: false, simulated: true });
    expect(r.diff).toContain('-heading: Hi');
    expect(r.diff).toContain('+heading: Hello');
    expect(git('log', '--oneline').trim().split('\n')).toHaveLength(1);
  });

  it('undoes one file, then everything (new files are removed)', async () => {
    await store.undo('content/pages/home.mdoc');
    expect(await store.read('content/pages/home.mdoc')).toBe('---\nheading: Hi\n---\n');
    await store.undoAll();
    expect(existsSync(join(dir, 'public/images/home/a-1.webp'))).toBe(false);
    expect(await store.changes()).toEqual([]);
  });

  it('never writes outside content files and photos', async () => {
    await expect(store.write('package.json', '{}', 'm')).rejects.toBeInstanceOf(StoreError);
    await expect(store.write('content/../src/x.ts', 'x', 'm')).rejects.toBeInstanceOf(StoreError);
    await expect(store.read('../secret')).rejects.toBeInstanceOf(StoreError);
    await expect(store.remove('src/pages/index.astro', 'm')).rejects.toBeInstanceOf(StoreError);
  });
});

// ------------------------------------------------------------------------------------------------ GitHub mode

interface Call {
  method: string;
  url: string;
  body?: Record<string, unknown>;
  auth?: string | null;
}

/** A tiny fake of the parts of the GitHub API Studio uses: refs, trees, blobs, contents, compare, merges. */
class FakeGitHub {
  calls: Call[] = [];
  branches: Record<string, string> = { main: 'c1' };
  commits: Record<string, Record<string, string>> = { c1: { 'content/pages/home.mdoc': '---\nheading: Hi\n---\n', 'src/x.ts': 'code' } };
  n = 1;
  mergeConflict = false;

  private sha(s: string) {
    return 'b' + Buffer.from(s).toString('hex').slice(0, 30);
  }
  private newCommit(from: string, files: Record<string, string>) {
    const id = `c${++this.n}`;
    this.commits[id] = files;
    return id;
  }

  fetch = async (input: string | URL | Request, init: RequestInit = {}): Promise<Response> => {
    const url = String(input);
    const method = init.method ?? 'GET';
    const body = init.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : undefined;
    const auth = new Headers(init.headers).get('authorization');
    this.calls.push({ method, url: url.replace('https://api.github.com', ''), body, auth });
    const ok = (j: unknown, status = 200) => new Response(JSON.stringify(j), { status, headers: { 'content-type': 'application/json' } });
    const path = url.replace('https://api.github.com/repos/owner/site', '');
    let m: RegExpMatchArray | null;

    if (url.endsWith('/repos/owner/site/installation')) return ok({ id: 42 });
    if (url.includes('/app/installations/42/access_tokens')) return ok({ token: 'ghs_test', expires_at: new Date(Date.now() + 3600e3).toISOString() }, 201);
    if ((m = path.match(/^\/git\/ref\/heads\/(.+)$/))) {
      const sha = this.branches[decodeURIComponent(m[1])];
      return sha ? ok({ object: { sha } }) : ok({ message: 'Not Found' }, 404);
    }
    if (path === '/git/refs' && method === 'POST') {
      this.branches[String(body!.ref).replace('refs/heads/', '')] = String(body!.sha);
      return ok({}, 201);
    }
    if ((m = path.match(/^\/git\/refs\/heads\/(.+)$/)) && method === 'PATCH') {
      this.branches[decodeURIComponent(m[1])] = String(body!.sha);
      return ok({});
    }
    if ((m = path.match(/^\/git\/trees\/(c\d+)\?recursive=1$/))) {
      const files = this.commits[m[1]];
      return ok({ tree: Object.entries(files).map(([p, c]) => ({ path: p, type: 'blob', sha: this.sha(c) })) });
    }
    if ((m = path.match(/^\/git\/blobs\/(b[0-9a-f]+)$/))) {
      for (const files of Object.values(this.commits))
        for (const c of Object.values(files)) if (this.sha(c) === m[1]) return ok({ content: Buffer.from(c).toString('base64'), encoding: 'base64' });
      return ok({}, 404);
    }
    if ((m = path.match(/^\/contents\/(.+)$/))) {
      const file = m[1].split('/').map(decodeURIComponent).join('/');
      const branch = String(body!.branch);
      const files = { ...this.commits[this.branches[branch]] };
      if (files[file] && body!.sha !== this.sha(files[file])) return ok({ message: 'sha mismatch' }, 409);
      if (method === 'PUT') files[file] = Buffer.from(String(body!.content), 'base64').toString('utf8');
      else delete files[file];
      this.branches[branch] = this.newCommit(this.branches[branch], files);
      return ok({ commit: { sha: this.branches[branch] } });
    }
    if ((m = path.match(/^\/compare\/(.+)\.\.\.(.+)$/))) {
      const a = this.commits[this.branches[m[1]]];
      const b = this.commits[this.branches[m[2]]];
      const files = [];
      for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
        if (!(k in a)) files.push({ filename: k, status: 'added' });
        else if (!(k in b)) files.push({ filename: k, status: 'removed' });
        else if (a[k] !== b[k]) files.push({ filename: k, status: 'modified' });
      }
      return ok({ files });
    }
    if (path === '/merges' && method === 'POST') {
      if (this.mergeConflict) return ok({ message: 'Merge conflict' }, 409);
      const head = this.branches[String(body!.head)];
      if (head === this.branches[String(body!.base)]) return new Response(null, { status: 204 });
      const merged = this.newCommit(head, { ...this.commits[head] });
      this.branches[String(body!.base)] = merged;
      return ok({ sha: merged }, 201);
    }
    return ok({ message: `unhandled ${method} ${path}` }, 500);
  };
}

describe('GitHub mode', () => {
  let gh: FakeGitHub;
  let store: GitHubStore;
  beforeEach(() => {
    clearGitHubCaches();
    gh = new FakeGitHub();
    store = new GitHubStore({ repo: 'owner/site', liveBranch: 'main', draftsBranch: 'studio-drafts', tokens: { token: async () => 'ghs_test' }, fetch: gh.fetch as typeof fetch });
  });

  it('reads the live version until there are drafts', async () => {
    expect(await store.read('content/pages/home.mdoc')).toBe('---\nheading: Hi\n---\n');
    expect(await store.list('content')).toEqual(['content/pages/home.mdoc']);
    expect(gh.calls.every((c) => c.auth === 'Bearer ghs_test')).toBe(true);
  });

  it('commits saves to the drafts branch (created from main), never to main', async () => {
    await store.write('content/pages/home.mdoc', '---\nheading: Hello\n---\n', 'Studio: edit Home');
    expect(gh.branches['studio-drafts']).toBeDefined();
    expect(gh.branches.main).toBe('c1');
    const put = gh.calls.find((c) => c.method === 'PUT')!;
    expect(put.url).toBe('/repos/owner/site/contents/content/pages/home.mdoc');
    expect(put.body).toMatchObject({ branch: 'studio-drafts', message: 'Studio: edit Home' });
    expect(put.body!.sha).toBeTruthy(); // updating an existing file needs its current hash
    expect(await store.read('content/pages/home.mdoc')).toBe('---\nheading: Hello\n---\n');
    expect(await store.readPublished('content/pages/home.mdoc')).toBe('---\nheading: Hi\n---\n');
  });

  it('uploads photos as binary and lists the change', async () => {
    await store.write('public/images/home/a-1.webp', new Uint8Array([0x52, 0x49]), 'Studio: upload');
    expect(await store.changes()).toEqual([{ path: 'public/images/home/a-1.webp', status: 'added' }]);
    expect([...(await store.readBinary('public/images/home/a-1.webp'))!]).toEqual([0x52, 0x49]);
  });

  it('undoes one file and everything', async () => {
    await store.write('content/pages/home.mdoc', 'x', 'm');
    await store.write('content/faq.json', '{}', 'm');
    await store.undo('content/pages/home.mdoc');
    expect(await store.changes()).toEqual([{ path: 'content/faq.json', status: 'added' }]);
    await store.undo('content/faq.json'); // new file: removed from the drafts
    expect(await store.changes()).toEqual([]);
    await store.write('content/faq.json', '{}', 'm');
    await store.undoAll();
    expect(gh.branches['studio-drafts']).toBe(gh.branches.main);
  });

  it('publishes by merging drafts into main once, then fast-forwards the drafts', async () => {
    await store.write('content/pages/home.mdoc', 'one', 'm');
    await store.write('content/faq.json', '{}', 'm');
    const r = await store.publish('Publish from Provident Studio: 2 changes');
    expect(r).toMatchObject({ published: true, simulated: false });
    expect(r.changes).toHaveLength(2);
    expect(gh.calls.filter((c) => c.url.endsWith('/merges'))).toHaveLength(1);
    expect(gh.branches.main).toBe(r.commit);
    expect(gh.branches['studio-drafts']).toBe(r.commit);
    expect(gh.commits[gh.branches.main]['content/faq.json']).toBe('{}');
    expect(await store.changes()).toEqual([]);
  });

  it('publishes nothing when there is nothing to publish', async () => {
    expect(await store.publish('x')).toMatchObject({ published: false, changes: [] });
    expect(gh.calls.some((c) => c.url.endsWith('/merges'))).toBe(false);
  });

  it('reports a merge conflict in plain words', async () => {
    await store.write('content/pages/home.mdoc', 'one', 'm');
    gh.mergeConflict = true;
    await expect(store.publish('x')).rejects.toThrow(/clashes/);
  });

  it('never writes code or settings', async () => {
    await expect(store.write('src/x.ts', 'evil', 'm')).rejects.toBeInstanceOf(StoreError);
    await expect(store.write('netlify.toml', 'evil', 'm')).rejects.toBeInstanceOf(StoreError);
    expect(gh.calls.some((c) => c.method === 'PUT')).toBe(false);
  });

  it('turns GitHub errors into a friendly message without GitHub’s own text', async () => {
    const failing = new GitHubStore({
      repo: 'owner/site',
      liveBranch: 'main',
      draftsBranch: 'studio-drafts',
      tokens: { token: async () => 't' },
      fetch: (async () => new Response(JSON.stringify({ message: 'Bad credentials: token ghs_secret' }), { status: 401 })) as typeof fetch,
    });
    const e = await failing.read('content/faq.json').catch((x: Error) => x);
    expect(e).toBeInstanceOf(StoreError);
    expect((e as Error).message).not.toContain('ghs_secret');
  });
});

describe('GitHub App tokens', () => {
  const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const pem = privateKey.export({ type: 'pkcs1', format: 'pem' }).toString();

  it('signs a short-lived RS256 JWT for the App', () => {
    const jwt = appJwt('123', pem, Date.UTC(2026, 10, 2, 12));
    const [h, p, s] = jwt.split('.');
    expect(JSON.parse(Buffer.from(h, 'base64url').toString())).toEqual({ alg: 'RS256', typ: 'JWT' });
    const payload = JSON.parse(Buffer.from(p, 'base64url').toString());
    expect(payload.iss).toBe('123');
    expect(payload.exp - payload.iat).toBe(540);
    const v = createVerify('RSA-SHA256');
    v.update(`${h}.${p}`);
    expect(v.verify(publicKey, Buffer.from(s, 'base64url'))).toBe(true);
  });

  it('accepts the key with escaped newlines or base64-encoded, as pasted into Netlify', () => {
    expect(normalizePem(pem.replace(/\n/g, '\\n'))).toBe(pem.trim());
    expect(normalizePem(Buffer.from(pem).toString('base64'))).toBe(pem.trim());
  });

  it('finds the installation, gets a repository-only token and reuses it until near expiry', async () => {
    const gh = new FakeGitHub();
    let now = Date.now();
    const t = new InstallationTokens({ appId: '1', privateKey: pem, repo: 'owner/site' }, gh.fetch as typeof fetch, () => now);
    expect(await t.token()).toBe('ghs_test');
    expect(await t.token()).toBe('ghs_test');
    expect(gh.calls.filter((c) => c.url.includes('access_tokens'))).toHaveLength(1);
    const req = gh.calls.find((c) => c.url.includes('access_tokens'))!;
    expect(req.body).toEqual({ repositories: ['site'], permissions: { contents: 'write' } });
    expect(req.auth).toMatch(/^Bearer ey/);
    now += 58 * 60e3; // within 5 minutes of expiry: a fresh one
    await t.token();
    expect(gh.calls.filter((c) => c.url.includes('access_tokens'))).toHaveLength(2);
  });
});

// keep the unused import checker quiet when the suite is filtered
void readFileSync;
