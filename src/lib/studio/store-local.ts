/**
 * Local mode (development): Studio reads and writes the files in this folder directly. "Changes" are what git sees
 * as changed against the last commit in content/ and public/images/; undo restores the committed version; Publish is
 * simulated (nothing is committed or pushed) and returns the diff.
 */
import { execFile } from 'node:child_process';
import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join, relative, sep } from 'node:path';
import { promisify } from 'node:util';
import { assertReadable, assertWritable, isTracked, type Change, type ContentStore, type PublishResult } from './store';

const run = promisify(execFile);

export class LocalStore implements ContentStore {
  readonly mode = 'local' as const;
  constructor(private root: string = process.cwd()) {}

  private abs(path: string) {
    return join(this.root, ...path.split('/'));
  }

  private async git(args: string[], opts: { allowFail?: boolean } = {}): Promise<string> {
    try {
      const { stdout } = await run('git', args, { cwd: this.root, maxBuffer: 20 * 1024 * 1024, windowsHide: true });
      return stdout;
    } catch (e) {
      if (opts.allowFail) return '';
      throw e;
    }
  }

  async read(path: string) {
    assertReadable(path);
    try {
      return await readFile(this.abs(path), 'utf8');
    } catch {
      return null;
    }
  }

  async readBinary(path: string) {
    assertReadable(path);
    try {
      return new Uint8Array(await readFile(this.abs(path)));
    } catch {
      return null;
    }
  }

  async list(dir: string) {
    assertReadable(dir.endsWith('/') ? dir : dir + '/');
    const out: string[] = [];
    const walk = async (d: string) => {
      let entries;
      try {
        entries = await readdir(d, { withFileTypes: true });
      } catch {
        return;
      }
      for (const e of entries) {
        const p = join(d, e.name);
        if (e.isDirectory()) await walk(p);
        else if (e.isFile() && !e.name.startsWith('.')) out.push(relative(this.root, p).split(sep).join('/'));
      }
    };
    await walk(this.abs(dir.replace(/\/$/, '')));
    return out.sort();
  }

  async write(path: string, content: string | Uint8Array, _message?: string) {
    assertWritable(path);
    await mkdir(dirname(this.abs(path)), { recursive: true });
    await writeFile(this.abs(path), content);
  }

  async remove(path: string, _message?: string) {
    assertWritable(path);
    await rm(this.abs(path), { force: true });
  }

  async readPublished(path: string) {
    assertReadable(path);
    try {
      return await this.git(['cat-file', '-p', `HEAD:${path}`]);
    } catch {
      return null; // not in the last commit: a new file
    }
  }

  async changes(): Promise<Change[]> {
    // Compared by content (git diff), not by file timestamps, so a file saved back to its committed text (or with
    // different line endings) does not count as a change.
    const roots = ['content', 'public/images'];
    const diff = await this.git(['diff', '--name-status', '--no-renames', '-z', 'HEAD', '--', ...roots], { allowFail: true });
    const added = await this.git(['ls-files', '--others', '--exclude-standard', '-z', '--', ...roots], { allowFail: true });
    const changes: Change[] = [];
    const parts = diff.split('\0').filter(Boolean);
    for (let i = 0; i + 1 < parts.length; i += 2) {
      const code = parts[i];
      const path = parts[i + 1];
      if (!isTracked(path)) continue;
      changes.push({ path, status: code === 'A' ? 'added' : code === 'D' ? 'deleted' : 'modified' });
    }
    for (const path of added.split('\0').filter(Boolean)) {
      if (isTracked(path) && !path.endsWith('/.gitkeep')) changes.push({ path, status: 'added' });
    }
    return changes.sort((a, b) => a.path.localeCompare(b.path));
  }

  async undo(path: string) {
    assertWritable(path);
    const tracked = (await this.git(['ls-tree', '--name-only', 'HEAD', '--', path], { allowFail: true })).trim();
    if (tracked) {
      await this.git(['checkout', 'HEAD', '--', path]);
    } else {
      await rm(this.abs(path), { force: true });
    }
  }

  async undoAll() {
    for (const c of await this.changes()) if (isTracked(c.path)) await this.undo(c.path).catch(() => {});
  }

  async publish(): Promise<PublishResult> {
    const changes = await this.changes();
    const diff = await this.git(['diff', '--no-color', '--no-ext-diff', 'HEAD', '--', 'content'], { allowFail: true });
    const added = changes.filter((c) => c.status === 'added' && c.path.startsWith('content/'));
    let extra = '';
    for (const a of added) {
      const text = await this.read(a.path);
      if (text !== null) extra += `\n--- /dev/null\n+++ b/${a.path}\n${text.split('\n').map((l) => '+' + l).join('\n')}\n`;
    }
    return { published: false, simulated: true, changes, diff: (diff + extra).trim() };
  }
}
