/** Provident Studio: reading/writing content files, field rules and list editing. */
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { parseFile, serializeFile } from '../src/lib/studio/format';
import { cleanValue, getAt, listOp, newProblems, setAt, slugify, uniqueSlug, validateDoc } from '../src/lib/studio/ops';
import { docFile, docType, fieldAt, fileDoc, notableDoc, pageDoc, postDoc } from '../src/lib/studio/schema';
import { PAGES, pageForPath } from '../src/lib/studio/pages';
import { isWritable } from '../src/lib/studio/store';

describe('content file formats', () => {
  it('reads front matter and body, and writes them back in the same shape', () => {
    const text = "---\ntitle: 'A: b'\ndate: 2026-11-02\ndraft: false\nlist:\n  - one\n  - two\n---\nBody **text**.\n";
    const p = parseFile('content/blog/x.mdoc', text);
    expect(p.data).toEqual({ title: 'A: b', date: '2026-11-02', draft: false, list: ['one', 'two'] });
    expect(p.body).toBe('Body **text**.\n');
    expect(serializeFile('content/blog/x.mdoc', p.data, p.body)).toBe(text);
  });

  it('keeps paragraphs as readable blocks, long lines unwrapped, and drops empty values', () => {
    const out = serializeFile('content/pages/x.mdoc', { a: 'one\n\ntwo', b: 'x'.repeat(120), c: null, d: undefined }, '');
    expect(out).toBe(`---\na: |-\n  one\n\n  two\nb: ${'x'.repeat(120)}\n---\n`);
  });

  it('handles Windows line endings and a file without front matter', () => {
    expect(parseFile('content/pages/x.mdoc', '---\r\nheading: Hi\r\n---\r\nText\r\n')).toEqual({ data: { heading: 'Hi' }, body: 'Text\n' });
    expect(parseFile('content/pages/x.mdoc', 'Only text')).toEqual({ data: {}, body: 'Only text' });
  });

  it('writes JSON with two spaces and a final newline', () => {
    expect(serializeFile('content/faq.json', { items: [{ question: 'Q', answer: 'A' }] })).toBe(
      '{\n  "items": [\n    {\n      "question": "Q",\n      "answer": "A"\n    }\n  ]\n}\n',
    );
    expect(() => parseFile('content/faq.json', '[1]')).toThrow();
  });

  it('round-trips every page of the site without losing anything', () => {
    for (const f of readdirSync('content/pages')) {
      const path = `content/pages/${f}`;
      const p = parseFile(path, readFileSync(path, 'utf8'));
      const again = parseFile(path, serializeFile(path, p.data, p.body));
      expect(again).toEqual(p);
    }
  });
});

describe('field registry', () => {
  it('knows every page and maps documents to files and back', () => {
    for (const p of PAGES) {
      const doc = `page:${p.id}`;
      expect(docType(doc)?.label).toBe(p.label);
      expect(fileDoc(docFile(doc))).toBe(doc);
    }
    expect(fileDoc(docFile('notable:abc'))).toBe('notable:abc');
    expect(fileDoc(docFile('post:my-post'))).toBe('post:my-post');
    expect(docType('page:nope')).toBeNull();
    expect(docType('../etc/passwd')).toBeNull();
    expect(docType('post:../../x')).toBeNull();
    expect(pageForPath('/process/')?.id).toBe('process');
  });

  it('finds fields inside lists and objects', () => {
    const home = pageDoc('home');
    expect(fieldAt(home, 'grades.2.title')?.kind).toBe('line');
    expect(fieldAt(home, 'grades.0.points.1')?.kind).toBe('text');
    expect(fieldAt(home, 'carousel.0.image')?.kind).toBe('image');
    expect(fieldAt(pageDoc('about'), 'coda.links.0.href')?.kind).toBe('select');
    expect(fieldAt(home, 'nope')).toBeNull();
    expect(fieldAt(home, 'grades.title')).toBeNull();
  });

  it('every content file of the site passes its rules (one known older title is let through)', () => {
    const files = ['content/settings.json', 'content/faq.json', 'content/gallery.json', ...readdirSync('content/pages').map((f) => `content/pages/${f}`)];
    for (const f of files) {
      const doc = fileDoc(f)!;
      const { data, body } = parseFile(f, readFileSync(f, 'utf8'));
      const problems = validateDoc(docType(doc)!, data, body).filter((p) => !(doc === 'page:holder' && p.path === 'metaTitle'));
      expect(problems, f).toEqual([]);
    }
  });
});

describe('field rules', () => {
  it('requires, limits and checks kinds', () => {
    const t = notableDoc;
    expect(validateDoc(t, { name: '', grade: 'MS 65', cert: '1', obverse: '/images/notable/a.webp' }).map((p) => p.path)).toEqual(['name']);
    expect(validateDoc(t, { name: 'x'.repeat(121), grade: 'MS 65', cert: '1', obverse: '/images/notable/a.webp' })[0].message).toMatch(/too long: 121 characters, the limit is 120/);
    expect(validateDoc(t, { name: 'A', grade: 'B', cert: 'C', obverse: 'https://evil.example/x.png' })[0].path).toBe('obverse');
    expect(validateDoc(t, { name: 'A', grade: 'B', cert: 'C', obverse: '/images/../secret.png' })[0].path).toBe('obverse');
    expect(validateDoc(t, { name: 'A\nB', grade: 'B', cert: 'C', obverse: '/images/notable/a.webp' })[0].message).toMatch(/single line/);
    expect(validateDoc(t, { name: 'A', grade: 'B', cert: 'C', obverse: '/images/notable/a.webp', order: 'x' })[0].path).toBe('order');
    expect(validateDoc(postDoc, { title: 'T', date: '2026-13-45', description: 'D' }).map((p) => p.path)).toEqual(['date']);
  });

  it('checks emails, web addresses, switches and list sizes in Business info', () => {
    const s = docType('settings')!;
    const ok = { siteName: 'X', siteUrl: 'https://www.example.com' };
    expect(validateDoc(s, ok)).toEqual([]);
    expect(validateDoc(s, { ...ok, email: 'not-an-email' })[0].path).toBe('email');
    expect(validateDoc(s, { ...ok, siteUrl: 'javascript:alert(1)' })[0].path).toBe('siteUrl');
    expect(validateDoc(s, { ...ok, socialLinks: [{ label: 'IG', url: 'ftp://x' }] })[0].path).toBe('socialLinks.0.url');
    expect(validateDoc(s, { ...ok, launched: 'yes' })[0].path).toBe('launched');
    expect(validateDoc(s, { ...ok, socialLinks: Array.from({ length: 9 }, () => ({ label: 'a', url: 'https://a.co' })) })[0].message).toMatch(/8 at most/);
  });

  it('checks the symbol drop-down and the closing band links', () => {
    const about = pageDoc('about');
    const base = { metaTitle: 'T', metaDescription: 'D', heading: 'H' };
    expect(validateDoc(about, { ...base, sections: [{ title: 'S', mark: 'dragon' }] })[0].path).toBe('sections.0.mark');
    expect(validateDoc(about, { ...base, coda: { title: 'C', links: [{ label: 'X', href: 'https://evil.example' }] } })[0].path).toBe('coda.links.0.href');
    expect(validateDoc(about, { ...base, coda: { title: 'C', links: [{ label: 'X', href: '/contact' }] } })).toEqual([]);
  });

  it('only reports problems a save introduces, so older text never blocks an edit', () => {
    const t = pageDoc('holder');
    const before = { data: { metaTitle: 'x'.repeat(71), metaDescription: 'D', heading: 'H' }, body: '' };
    expect(newProblems(t, before, { ...before.data, heading: 'New' }, '')).toEqual([]);
    expect(newProblems(t, before, { ...before.data, metaTitle: 'y'.repeat(72) }, '')[0].path).toBe('metaTitle');
    expect(newProblems(t, null, before.data, '')[0].path).toBe('metaTitle');
  });

  it('tidies values as they are stored', () => {
    expect(cleanValue({ kind: 'line', label: 'x' }, '  A\n B  ')).toBe('A B');
    expect(cleanValue({ kind: 'text', label: 'x' }, 'a  \r\n\r\n\r\n\nb ')).toBe('a\n\nb');
    expect(cleanValue({ kind: 'rich', label: 'x' }, '# A\r\n\r\n')).toBe('# A\n');
  });
});

describe('editing values', () => {
  it('reads and writes nested values without touching the original', () => {
    const d = { a: [{ b: 1 }, { b: 2 }] };
    const e = setAt(d, 'a.1.b', 3);
    expect(getAt(e, 'a.1.b')).toBe(3);
    expect(d.a[1].b).toBe(2);
    expect(setAt({}, 'x.0.y', 'z')).toEqual({ x: [{ y: 'z' }] });
    expect(() => setAt({ a: [] }, 'a.5', 1)).toThrow(/no longer exists/);
  });

  it('adds, removes and moves list items', () => {
    const d = { l: ['a', 'b', 'c'] };
    expect(listOp(d, 'l', 'add', 0, 'x').l).toEqual(['a', 'x', 'b', 'c']);
    expect(listOp(d, 'l', 'add', -1, 'x').l).toEqual(['a', 'b', 'c', 'x']);
    expect(listOp(d, 'l', 'remove', 1).l).toEqual(['a', 'c']);
    expect(listOp(d, 'l', 'up', 2).l).toEqual(['a', 'c', 'b']);
    expect(listOp(d, 'l', 'down', 0).l).toEqual(['b', 'a', 'c']);
    expect(listOp(d, 'l', 'up', 0).l).toEqual(['a', 'b', 'c']);
    expect(() => listOp(d, 'l', 'remove', 7)).toThrow();
    expect(listOp({}, 'new', 'add', -1, 'first')).toEqual({ new: ['first'] });
  });

  it('makes safe, unique file names', () => {
    expect(slugify('1909-S VDB Lincoln Cent!')).toBe('1909-s-vdb-lincoln-cent');
    expect(slugify('Été à Rome')).toBe('ete-a-rome');
    expect(slugify('../../etc')).toBe('etc');
    expect(slugify('***')).toBe('item');
    expect(uniqueSlug('a', ['a', 'a-2'])).toBe('a-3');
  });

  it('lets Studio write content files and photos only', () => {
    expect(isWritable('content/pages/home.mdoc')).toBe(true);
    expect(isWritable('content/notable/a-coin.json')).toBe(true);
    expect(isWritable('public/images/notable/a-1.webp')).toBe(true);
    for (const p of ['src/pages/index.astro', 'package.json', 'netlify.toml', 'content/../package.json', 'public/images/notable/x.svg', 'public/images/certificates/a.webp', 'content/pages/Home.mdoc', '/content/faq.json', 'content\\faq.json'])
      expect(isWritable(p), p).toBe(false);
  });
});
