/**
 * Everything Studio does to the website's content, independent of HTTP (the API routes in src/pages/api/studio/ are
 * thin wrappers). Every write is validated against the field registry (schema.ts) before it reaches the store.
 */
import { parseFile, serializeFile } from './format';
import { cleanValue, EditError, getAt, listOp, requireField, setAt, slugify, uniqueSlug, validateDoc, type Data, type ListOp } from './ops';
import { docFile, docType, fileDoc, IMAGE_FOLDERS, notableDoc, postDoc, type DocType, type ImageFolder } from './schema';
import { PAGES } from './pages';
import { assertWritable, isWritable, type Change, type ContentStore, type PublishResult } from './store';

export interface DocValue {
  doc: string;
  file: string;
  data: Data;
  body: string;
  exists: boolean;
}

export interface Snapshot {
  settings: Data;
  faq: Data;
  gallery: Data;
  pages: Record<string, { data: Data; body: string }>;
  notable: Record<string, Data>;
  posts: Record<string, { data: Data; body: string }>;
}

/** What a save changed, so the browser can offer "Undo": the file's text before the save (null = it was new). */
export interface SaveResult {
  file: string;
  before: string | null;
  doc: string;
}

export interface ChangeView extends Change {
  label: string;
  doc: string | null;
  /** a public address to look at the change, when there is one */
  href?: string;
}

export interface Photo {
  path: string;
  src: string;
  folder: string;
  name: string;
  usedBy: string[];
}

export const MAX_UPLOAD_BYTES = 6 * 1024 * 1024;

function sniffImage(b: Uint8Array): 'webp' | 'png' | 'jpg' | null {
  if (b.length > 12 && b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return 'webp';
  if (b.length > 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'png';
  if (b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'jpg';
  return null;
}

export class StudioService {
  constructor(public store: ContentStore) {}

  private type(doc: string): DocType {
    const t = docType(doc);
    if (!t) throw new EditError('That part of the site is not editable.', 404);
    return t;
  }

  async readDoc(doc: string): Promise<DocValue> {
    this.type(doc);
    const file = docFile(doc);
    const text = await this.store.read(file);
    if (text === null) return { doc, file, data: {}, body: '', exists: false };
    const { data, body } = parseFile(file, text);
    return { doc, file, data, body, exists: true };
  }

  private async writeDoc(doc: string, data: Data, body: string, what: string, opts: { mustExist?: boolean } = {}): Promise<SaveResult> {
    const type = this.type(doc);
    const file = docFile(doc);
    const problems = validateDoc(type, data, body);
    if (problems.length) throw new EditError(problems[0].message, 400, problems);
    const before = await this.store.read(file);
    if (opts.mustExist && before === null) throw new EditError('That item no longer exists. Reload and try again.', 404);
    const text = serializeFile(file, data, type.hasBody ? body : '');
    if (before !== null && before.replace(/\r\n/g, '\n') === text) return { file, before, doc };
    await this.store.write(file, text, `Studio: ${what}`);
    return { file, before, doc };
  }

  /** Change one field (inline edits in the visual editor). */
  async saveField(doc: string, path: string, value: unknown): Promise<SaveResult> {
    const type = this.type(doc);
    const f = requireField(type, path);
    const cur = await this.readDoc(doc);
    if (!cur.exists && type.type !== 'settings' && type.type !== 'faq' && type.type !== 'gallery') {
      throw new EditError('That item no longer exists. Reload and try again.', 404);
    }
    const v = cleanValue(f, value);
    if (path === 'body') return this.writeDoc(doc, cur.data, String(v ?? ''), `edit ${type.label} (text)`);
    return this.writeDoc(doc, setAt(cur.data, path, v), cur.body, `edit ${type.label} (${f.label})`);
  }

  /** Replace a whole document (forms). Fields the form does not know about are kept. */
  async saveDoc(doc: string, data: Data, body?: string): Promise<SaveResult> {
    const type = this.type(doc);
    const cur = await this.readDoc(doc);
    const merged: Data = { ...cur.data };
    for (const [k, f] of Object.entries(type.fields)) {
      if (k === 'body') continue;
      if (k in data) merged[k] = cleanDeep(f, data[k]);
    }
    const b = body === undefined ? cur.body : String(cleanValue(type.fields.body ?? null, body) ?? '');
    return this.writeDoc(doc, merged, b, `edit ${type.label}`, { mustExist: type.type === 'notable' || type.type === 'post' });
  }

  /** Add, remove or move an item in a list field. */
  async listChange(doc: string, path: string, op: ListOp, index: number, item?: unknown): Promise<SaveResult> {
    const type = this.type(doc);
    const f = requireField(type, path);
    if (f.kind !== 'list') throw new EditError(`"${f.label}" is not a list.`);
    const cur = await this.readDoc(doc);
    let value = item;
    if (op === 'add') {
      const len = (getAt(cur.data, path) as unknown[] | undefined)?.length ?? 0;
      if (f.maxItems && len >= f.maxItems) throw new EditError(`${f.label}: ${f.maxItems} at most.`);
      if (value === undefined) {
        if (!f.newItem) throw new EditError(`A new ${f.noun} needs its details first.`);
        value = f.newItem();
      } else value = cleanDeep(f.item, value);
    }
    const data = listOp(cur.data, path, op, index, value);
    const verb = op === 'add' ? 'add' : op === 'remove' ? 'remove' : 'move';
    return this.writeDoc(doc, data, cur.body, `${verb} a ${f.noun} (${type.label})`);
  }

  // ------------------------------------------------------------------------------------------- collections

  private async slugs(dir: 'notable' | 'blog') {
    const ext = dir === 'notable' ? '.json' : '.mdoc';
    return (await this.store.list(`content/${dir}`)).filter((p) => p.endsWith(ext)).map((p) => p.split('/').pop()!.slice(0, -ext.length));
  }

  async listNotable(): Promise<{ slug: string; data: Data }[]> {
    const out = [];
    for (const slug of await this.slugs('notable')) out.push({ slug, data: (await this.readDoc(`notable:${slug}`)).data });
    return out.sort((a, b) => Number(a.data.order ?? 10) - Number(b.data.order ?? 10) || String(a.data.name).localeCompare(String(b.data.name)));
  }

  async createNotable(data: Data): Promise<SaveResult & { slug: string }> {
    const existing = await this.listNotable();
    const slug = uniqueSlug(slugify(String(data.name ?? '')), existing.map((c) => c.slug));
    const maxOrder = existing.reduce((m, c) => Math.max(m, Number(c.data.order ?? 0) || 0), 0);
    const clean: Data = {};
    for (const [k, f] of Object.entries(notableDoc.fields)) if (k in data) clean[k] = cleanDeep(f, data[k]);
    if (typeof clean.order !== 'number') clean.order = maxOrder + 10;
    const r = await this.writeDoc(`notable:${slug}`, clean, '', `add notable coin ${String(clean.name)}`);
    return { ...r, slug };
  }

  /** Move a notable coin one place up or down: the positions are renumbered 10, 20, 30… */
  async moveNotable(slug: string, dir: 'up' | 'down'): Promise<SaveResult[]> {
    const coins = await this.listNotable();
    const i = coins.findIndex((c) => c.slug === slug);
    if (i < 0) throw new EditError('That coin no longer exists.', 404);
    const j = dir === 'up' ? i - 1 : i + 1;
    if (j < 0 || j >= coins.length) return [];
    [coins[i], coins[j]] = [coins[j], coins[i]];
    const results: SaveResult[] = [];
    for (const [n, c] of coins.entries()) {
      const order = (n + 1) * 10;
      if (Number(c.data.order) !== order) results.push(await this.writeDoc(`notable:${c.slug}`, { ...c.data, order }, '', 'reorder notable coins'));
    }
    return results;
  }

  async listPosts(): Promise<{ slug: string; data: Data }[]> {
    const out = [];
    for (const slug of await this.slugs('blog')) out.push({ slug, data: (await this.readDoc(`post:${slug}`)).data });
    return out.sort((a, b) => String(b.data.date ?? '').localeCompare(String(a.data.date ?? '')));
  }

  async createPost(data: Data, body = ''): Promise<SaveResult & { slug: string }> {
    const slug = uniqueSlug(slugify(String(data.title ?? '')), await this.slugs('blog'));
    const clean: Data = {};
    for (const [k, f] of Object.entries(postDoc.fields)) if (k !== 'body' && k in data) clean[k] = cleanDeep(f, data[k]);
    if (!clean.date) clean.date = new Date().toISOString().slice(0, 10);
    if (typeof clean.draft !== 'boolean') clean.draft = false;
    const r = await this.writeDoc(`post:${slug}`, clean, String(cleanValue(postDoc.fields.body, body) ?? ''), `add journal post ${String(clean.title)}`);
    return { ...r, slug };
  }

  /** Delete a notable coin or a journal post (pages and settings can't be deleted). */
  async deleteDoc(doc: string): Promise<SaveResult> {
    const type = this.type(doc);
    if (type.type !== 'notable' && type.type !== 'post') throw new EditError('Only notable coins and journal posts can be deleted.');
    const file = docFile(doc);
    const before = await this.store.read(file);
    if (before === null) throw new EditError('That item no longer exists.', 404);
    await this.store.remove(file, `Studio: delete ${type.label.toLowerCase()} ${doc.split(':')[1]}`);
    return { file, before, doc };
  }

  /** Put a file back to the text it had before a save (the browser's "Undo last change"). */
  async restore(file: string, text: string | null): Promise<void> {
    assertWritable(file);
    const doc = fileDoc(file);
    if (!doc) throw new EditError('Only text changes can be undone this way.');
    if (text === null) {
      await this.store.remove(file, `Studio: undo (remove ${file})`);
      return;
    }
    const { data, body } = parseFile(file, text); // must still be a valid file
    const type = this.type(doc);
    await this.store.write(file, serializeFile(file, data, type.hasBody ? body : ''), `Studio: undo last change (${type.label})`);
  }

  // ------------------------------------------------------------------------------------------- photos

  async uploadImage(folder: string, filename: string, bytes: Uint8Array): Promise<string> {
    if (!IMAGE_FOLDERS.includes(folder as ImageFolder)) throw new EditError('Unknown photo folder.');
    if (bytes.byteLength === 0) throw new EditError('That file is empty.');
    if (bytes.byteLength > MAX_UPLOAD_BYTES) throw new EditError('That photo is too large (6 MB at most).', 413);
    const kind = sniffImage(bytes);
    if (!kind) throw new EditError('Only photos can be uploaded (JPEG, PNG or WebP).', 415);
    const base = slugify(filename.replace(/\.[a-z0-9]+$/i, ''), 50);
    const stamp = Date.now().toString(36).slice(-5);
    const path = `public/images/${folder}/${base}-${stamp}.${kind}`;
    if (!isWritable(path)) throw new EditError('That file name is not allowed.');
    await this.store.write(path, bytes, `Studio: upload photo ${base}.${kind}`);
    return path;
  }

  async photos(): Promise<Photo[]> {
    const files = (await this.store.list('public/images')).filter((p) => /\.(webp|jpe?g|png|gif|avif)$/i.test(p));
    const usage = await this.usage();
    return files.map((path) => {
      const src = path.slice('public'.length);
      const parts = path.split('/');
      return { path, src, folder: parts[2] ?? '', name: parts[parts.length - 1], usedBy: usage.get(src) ?? [] };
    });
  }

  /** photo address -> the labels of the documents that use it */
  private async usage(): Promise<Map<string, string[]>> {
    const map = new Map<string, string[]>();
    const files = (await this.store.list('content')).filter((p) => fileDoc(p));
    for (const f of files) {
      const text = (await this.store.read(f)) ?? '';
      const label = await this.labelFor(f, text);
      for (const m of text.matchAll(/\/images\/[A-Za-z0-9/_.-]+\.(?:webp|jpe?g|png|gif|avif)/gi)) {
        const list = map.get(m[0]) ?? [];
        if (!list.includes(label)) list.push(label);
        map.set(m[0], list);
      }
    }
    return map;
  }

  async deleteImage(path: string): Promise<void> {
    assertWritable(path);
    if (!path.startsWith('public/images/')) throw new EditError('Not a photo.');
    const used = (await this.usage()).get(path.slice('public'.length));
    if (used?.length) throw new EditError(`This photo is still used on: ${used.join(', ')}. Replace it there first.`, 409);
    await this.store.remove(path, `Studio: delete photo ${path.split('/').pop()}`);
  }

  // ------------------------------------------------------------------------------------------- changes, publish

  private async labelFor(path: string, text?: string | null): Promise<string> {
    const doc = fileDoc(path);
    if (!doc) return `Photo: ${path.split('/').pop()}`;
    const t = docType(doc);
    if (!t) return path;
    if (t.type === 'page') return `${t.label} page`;
    if (t.type === 'notable' || t.type === 'post') {
      let name = '';
      try {
        const src = text ?? (await this.store.read(path)) ?? (await this.store.readPublished(path));
        if (src) name = String(parseFile(path, src).data[t.type === 'notable' ? 'name' : 'title'] ?? '');
      } catch {
        /* label from the slug */
      }
      return `${t.type === 'notable' ? 'Notable coin' : 'Journal post'}: ${name || doc.split(':')[1]}`;
    }
    return t.label;
  }

  async changes(): Promise<ChangeView[]> {
    const out: ChangeView[] = [];
    for (const c of await this.store.changes()) {
      const doc = fileDoc(c.path);
      let href: string | undefined;
      if (doc?.startsWith('page:')) href = PAGES.find((p) => p.id === doc.slice(5))?.path;
      else if (doc?.startsWith('post:')) href = `/blog/${doc.slice(5)}`;
      else if (doc?.startsWith('notable:') || doc === 'gallery') href = '/';
      else if (doc === 'faq') href = '/faq';
      else if (doc === 'settings') href = '/contact';
      out.push({ ...c, doc, label: await this.labelFor(c.path), href });
    }
    return out;
  }

  undo(path: string) {
    return this.store.undo(path);
  }

  undoAll() {
    return this.store.undoAll();
  }

  async publish(): Promise<PublishResult> {
    const changes = await this.changes();
    const msg =
      changes.length === 1
        ? `Publish from Provident Studio: ${changes[0].label}`
        : `Publish from Provident Studio: ${changes.length} changes\n\n${changes.map((c) => `- ${c.label}`).join('\n')}`;
    return this.store.publish(msg);
  }

  // ------------------------------------------------------------------------------------------- preview

  /** Every content file, as the drafts have it, for the live preview. */
  async snapshot(): Promise<Snapshot> {
    const snap: Snapshot = { settings: {}, faq: {}, gallery: {}, pages: {}, notable: {}, posts: {} };
    const files = await this.store.list('content');
    await Promise.all(
      files.map(async (f) => {
        const doc = fileDoc(f);
        if (!doc) return;
        const text = await this.store.read(f);
        if (text === null) return;
        let parsed;
        try {
          parsed = parseFile(f, text);
        } catch {
          return; // a broken file shows as missing rather than breaking the whole preview
        }
        const [kind, id] = doc.split(':');
        if (doc === 'settings' || doc === 'faq' || doc === 'gallery') snap[doc] = parsed.data;
        else if (kind === 'page') snap.pages[id] = parsed;
        else if (kind === 'notable') snap.notable[id] = parsed.data;
        else if (kind === 'post') snap.posts[id] = parsed;
      }),
    );
    return snap;
  }
}

/** Clean every string in a value according to its field (lists and objects included). */
function cleanDeep(f: import('./schema').Field, v: unknown): unknown {
  if (f.kind === 'list' && Array.isArray(v)) return v.map((x) => cleanDeep(f.item, x));
  if (f.kind === 'object' && v && typeof v === 'object' && !Array.isArray(v)) {
    const out: Data = { ...(v as Data) };
    for (const [k, sub] of Object.entries(f.fields)) if (k in out) out[k] = cleanDeep(sub, out[k]);
    return out;
  }
  if (f.kind === 'number' && typeof v === 'string' && v.trim() !== '') return Number(v);
  return cleanValue(f, v);
}
