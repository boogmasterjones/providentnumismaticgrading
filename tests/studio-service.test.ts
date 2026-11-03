/** Provident Studio: the content service (what every API route does), on an in-memory store. */
import { beforeEach, describe, expect, it } from 'vitest';
import { StudioService } from '../src/lib/studio/service';
import { EditError } from '../src/lib/studio/ops';
import { assertWritable, isTracked, type Change, type ContentStore, type PublishResult } from '../src/lib/studio/store';
import { parseFile } from '../src/lib/studio/format';

/** Drafts and live versions in memory, with the same path rules as the real stores. */
class MemoryStore implements ContentStore {
  readonly mode = 'local' as const;
  live = new Map<string, string | Uint8Array>();
  drafts = new Map<string, string | Uint8Array>();
  writes: string[] = [];
  constructor(files: Record<string, string>) {
    for (const [k, v] of Object.entries(files)) {
      this.live.set(k, v);
      this.drafts.set(k, v);
    }
  }
  async read(p: string) {
    const v = this.drafts.get(p);
    return v === undefined ? null : typeof v === 'string' ? v : Buffer.from(v).toString('utf8');
  }
  async readBinary(p: string) {
    const v = this.drafts.get(p);
    return v === undefined ? null : typeof v === 'string' ? new TextEncoder().encode(v) : v;
  }
  async list(dir: string) {
    return [...this.drafts.keys()].filter((k) => k.startsWith(dir.replace(/\/?$/, '/'))).sort();
  }
  async write(p: string, c: string | Uint8Array, message: string) {
    assertWritable(p);
    this.writes.push(message);
    this.drafts.set(p, c);
  }
  async remove(p: string) {
    assertWritable(p);
    this.drafts.delete(p);
  }
  async readPublished(p: string) {
    const v = this.live.get(p);
    return v === undefined ? null : String(v);
  }
  async changes(): Promise<Change[]> {
    const out: Change[] = [];
    for (const [k, v] of this.drafts) if (isTracked(k) && (!this.live.has(k) || this.live.get(k) !== v)) out.push({ path: k, status: this.live.has(k) ? 'modified' : 'added' });
    for (const k of this.live.keys()) if (!this.drafts.has(k)) out.push({ path: k, status: 'deleted' });
    return out.sort((a, b) => a.path.localeCompare(b.path));
  }
  async undo(p: string) {
    if (this.live.has(p)) this.drafts.set(p, this.live.get(p)!);
    else this.drafts.delete(p);
  }
  async undoAll() {
    this.drafts = new Map(this.live);
  }
  async publish(): Promise<PublishResult> {
    const changes = await this.changes();
    this.live = new Map(this.drafts);
    return { published: true, simulated: false, changes };
  }
}

const page = (fm: string, body = '') => `---\n${fm}---\n${body}`;
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const WEBP = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50, 0, 0]);

let store: MemoryStore;
let svc: StudioService;

beforeEach(() => {
  store = new MemoryStore({
    'content/settings.json': JSON.stringify({ siteName: 'Provident', siteUrl: 'https://www.example.com', phone: '1' }, null, 2) + '\n',
    'content/faq.json': JSON.stringify({ items: [{ question: 'Q1?', answer: 'A1' }, { question: 'Q2?', answer: 'A2' }] }, null, 2) + '\n',
    'content/pages/home.mdoc': page('metaTitle: Home\nmetaDescription: D\nheading: Hello\ncarousel: []\ngrades:\n  - title: US\n    text: Coins\n'),
    'content/pages/holder.mdoc': page(`metaTitle: ${'x'.repeat(71)}\nmetaDescription: D\nheading: Holder\n`, 'Body text.\n'),
    'content/notable/.gitkeep': '',
  });
  svc = new StudioService(store);
});

describe('saving fields', () => {
  it('changes one field and returns the text from before, for Undo', async () => {
    const r = await svc.saveField('page:home', 'heading', '  New heading \n');
    expect(r.file).toBe('content/pages/home.mdoc');
    expect(parseFile(r.file, (await store.read(r.file))!).data.heading).toBe('New heading');
    await svc.restore(r.file, r.before);
    expect(parseFile(r.file, (await store.read(r.file))!).data.heading).toBe('Hello');
  });

  it('changes a field inside a list and a formatted body', async () => {
    await svc.saveField('page:home', 'grades.0.title', 'United States');
    await svc.saveField('page:holder', 'body', '## Heading\n\nText');
    expect(parseFile('content/pages/home.mdoc', (await store.read('content/pages/home.mdoc'))!).data.grades).toEqual([{ title: 'United States', text: 'Coins' }]);
    expect((await store.read('content/pages/holder.mdoc'))!.endsWith('---\n## Heading\n\nText\n')).toBe(true);
  });

  it('refuses values that break the rules, and fields that do not exist', async () => {
    await expect(svc.saveField('page:home', 'heading', '')).rejects.toThrow(/can't be empty/);
    await expect(svc.saveField('page:home', 'metaTitle', 'x'.repeat(80))).rejects.toThrow(/too long/);
    await expect(svc.saveField('page:home', 'scripts', 'x')).rejects.toThrow(/can't be edited/);
    await expect(svc.saveField('page:nope', 'heading', 'x')).rejects.toBeInstanceOf(EditError);
    await expect(svc.saveField('../../package', 'x', 'x')).rejects.toBeInstanceOf(EditError);
  });

  it('lets older text that breaks a newer limit stay, while other fields are edited', async () => {
    await expect(svc.saveField('page:holder', 'heading', 'Protection')).resolves.toBeTruthy();
    await expect(svc.saveField('page:holder', 'metaTitle', 'y'.repeat(72))).rejects.toThrow(/too long/);
  });

  it('does not write when nothing changed', async () => {
    await svc.saveField('page:home', 'heading', 'Hello');
    expect(store.writes).toEqual([]);
  });

  it('saves whole forms but keeps fields the form does not know', async () => {
    await svc.saveDoc('settings', { phone: '(941) 555-0100', unknown: 'ignored' });
    const data = JSON.parse((await store.read('content/settings.json'))!);
    expect(data).toEqual({ siteName: 'Provident', siteUrl: 'https://www.example.com', phone: '(941) 555-0100' });
  });
});

describe('lists', () => {
  it('adds a new item with its starting value, moves and removes items', async () => {
    await svc.listChange('faq', 'items', 'add', 0);
    let items = JSON.parse((await store.read('content/faq.json'))!).items;
    expect(items.map((i: { question: string }) => i.question)).toEqual(['Q1?', 'New question?', 'Q2?']);
    await svc.listChange('faq', 'items', 'down', 1);
    await svc.listChange('faq', 'items', 'remove', 0);
    items = JSON.parse((await store.read('content/faq.json'))!).items;
    expect(items.map((i: { question: string }) => i.question)).toEqual(['Q2?', 'New question?']);
  });

  it('needs the photo before a slideshow slide can be added, and checks it', async () => {
    await expect(svc.listChange('page:home', 'carousel', 'add', -1)).rejects.toThrow(/needs its details/);
    await expect(svc.listChange('page:home', 'carousel', 'add', -1, { image: '/images/home/a.webp', alt: '' })).rejects.toThrow(/can't be empty/);
    await svc.listChange('page:home', 'carousel', 'add', -1, { image: '/images/home/a.webp', alt: 'Slab' });
    expect(parseFile('x.mdoc', (await store.read('content/pages/home.mdoc'))!).data.carousel).toEqual([{ image: '/images/home/a.webp', alt: 'Slab' }]);
  });

  it('respects a list maximum (two footage captions)', async () => {
    await svc.saveDoc('page:home', { film: [{ title: 'A' }, { title: 'B' }] });
    await expect(svc.listChange('page:home', 'film', 'add', -1)).rejects.toThrow(/2 at most/);
  });
});

describe('notable coins and journal posts', () => {
  const coin = { name: '1909-S VDB cent', grade: 'MS 65', cert: 'A1', obverse: '/images/notable/a.webp' };

  it('creates coins with unique file names and positions, reorders and deletes them', async () => {
    const a = await svc.createNotable(coin);
    const b = await svc.createNotable({ ...coin, cert: 'A2' });
    expect([a.slug, b.slug]).toEqual(['1909-s-vdb-cent', '1909-s-vdb-cent-2']);
    expect((await svc.listNotable()).map((c) => c.data.order)).toEqual([10, 20]);
    await svc.moveNotable(b.slug, 'up');
    expect((await svc.listNotable()).map((c) => c.slug)).toEqual([b.slug, a.slug]);
    const del = await svc.deleteDoc(`notable:${a.slug}`);
    expect((await svc.listNotable()).map((c) => c.slug)).toEqual([b.slug]);
    await svc.restore(del.file, del.before);
    expect((await svc.listNotable()).length).toBe(2);
  });

  it('refuses an incomplete coin', async () => {
    await expect(svc.createNotable({ ...coin, obverse: '' })).rejects.toThrow(/Photo: front can't be empty/);
  });

  it('creates, edits and deletes a journal post with a photo', async () => {
    const r = await svc.createPost({ title: 'How coins are imaged', description: 'Summary', cover: '/images/blog/c.webp', coverAlt: 'Cover', date: '2026-11-02' }, 'Text with ![A photo](/images/blog/p.webp)');
    expect(r.slug).toBe('how-coins-are-imaged');
    expect(await store.read('content/blog/how-coins-are-imaged.mdoc')).toBe(
      "---\ntitle: How coins are imaged\ndate: 2026-11-02\ndescription: Summary\ncover: /images/blog/c.webp\ncoverAlt: Cover\ndraft: false\n---\nText with ![A photo](/images/blog/p.webp)\n",
    );
    await svc.saveDoc(`post:${r.slug}`, { draft: true }, 'New text');
    expect(parseFile('x.mdoc', (await store.read('content/blog/how-coins-are-imaged.mdoc'))!)).toMatchObject({ data: { draft: true }, body: 'New text\n' });
    await svc.deleteDoc(`post:${r.slug}`);
    expect(await svc.listPosts()).toEqual([]);
  });

  it('only deletes coins and posts', async () => {
    await expect(svc.deleteDoc('page:home')).rejects.toThrow(/Only notable coins and journal posts/);
  });
});

describe('photos', () => {
  it('accepts real images only, names them safely, and caps the size', async () => {
    const p = await svc.uploadImage('notable', 'My Coin (front).PNG', PNG);
    expect(p).toMatch(/^public\/images\/notable\/my-coin-front-[a-z0-9]+\.png$/);
    expect(await svc.uploadImage('home', 'x.webp', WEBP)).toMatch(/\.webp$/);
    await expect(svc.uploadImage('notable', 'x.png', new TextEncoder().encode('<svg onload=alert(1)>'))).rejects.toThrow(/Only photos/);
    await expect(svc.uploadImage('../../src', 'x.png', PNG)).rejects.toThrow(/Unknown photo folder/);
    await expect(svc.uploadImage('home', 'x.png', new Uint8Array(7 * 1024 * 1024))).rejects.toThrow(/too large/);
  });

  it('knows where each photo is used and will not delete one that is in use', async () => {
    const p = await svc.uploadImage('home', 'slab.webp', WEBP);
    const src = p.slice('public'.length);
    await svc.listChange('page:home', 'carousel', 'add', -1, { image: src, alt: 'Slab' });
    expect((await svc.photos()).find((x) => x.path === p)?.usedBy).toEqual(['Home page']);
    await expect(svc.deleteImage(p)).rejects.toThrow(/still used on: Home page/);
    await svc.listChange('page:home', 'carousel', 'remove', 0);
    await svc.deleteImage(p);
    expect((await svc.photos()).length).toBe(0);
  });
});

describe('changes, undo and publish', () => {
  it('lists changes in plain words with where to see them', async () => {
    await svc.saveField('page:home', 'heading', 'Changed');
    await svc.createNotable({ name: 'Denarius', grade: 'VF', cert: 'D1', obverse: '/images/notable/d.webp' });
    await svc.saveField('settings', 'phone', '2');
    const c = await svc.changes();
    expect(c.map((x) => [x.label, x.status, x.href])).toEqual([
      ['Notable coin: Denarius', 'added', '/'],
      ['Home page', 'modified', '/'],
      ['Business info', 'modified', '/contact'],
    ]);
  });

  it('undoes one file or everything, and publishes all drafts at once', async () => {
    await svc.saveField('page:home', 'heading', 'Changed');
    await svc.saveField('settings', 'phone', '2');
    await svc.undo('content/settings.json');
    expect((await svc.changes()).map((x) => x.path)).toEqual(['content/pages/home.mdoc']);
    const r = await svc.publish();
    expect(r.published).toBe(true);
    expect(await svc.changes()).toEqual([]);
    await svc.saveField('page:home', 'heading', 'Again');
    await svc.undoAll();
    expect(await svc.changes()).toEqual([]);
  });

  it('builds the preview snapshot from the drafts', async () => {
    await svc.saveField('page:home', 'heading', 'Draft heading');
    const s = await svc.snapshot();
    expect(s.pages.home.data.heading).toBe('Draft heading');
    expect(s.pages.holder.body).toBe('Body text.\n');
    expect(s.settings.siteName).toBe('Provident');
    expect(s.faq.items).toHaveLength(2);
  });
});
