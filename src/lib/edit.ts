/**
 * Editing annotations for Provident Studio's visual editor.
 *
 * Templates call `const e = editor(Astro)` and spread `{...e('page:home', 'heading')}` on the element that shows a
 * field. On public pages `e()` returns {} (no attributes, no weight). Inside Studio's preview it returns data
 * attributes naming the document and field, its kind and its limits, which the overlay script
 * (src/scripts/studio-overlay.ts) turns into in-place editing.
 *
 *   data-sf        "doc|path"            the field (e.g. "page:home|grades.2.title")
 *   data-sf-k      line|text|rich|image|panel
 *   data-sf-label  plain-English name     data-sf-max  character limit     data-sf-req  "1" when required
 *   data-sf-links  "1": [text](link) links allowed in a text field
 *   data-sf-raw    the stored value, when the element shows it transformed (inscription capitals, numerals)
 *   data-sf-alt    "doc|path" of an image's description; data-sf-folder its upload folder; data-sf-rm "1" removable
 *   data-sf-item   "doc|listPath|index"  an item of a list (gets Move / Add / Remove controls)
 *   data-sf-add    "doc|listPath"        an "add the first one" spot for an empty list
 */
import type { AstroGlobal } from 'astro';
import { docType, fieldAt, type Field } from './studio/schema';

type Attrs = Record<string, string>;

export interface Editor {
  (doc: string, path: string, opts?: { raw?: string | null; panel?: boolean }): Attrs;
  /** an item of a list: `listPath` like "grades" (or "@notable" for the notable-coin files) */
  item(doc: string, listPath: string, index: number, count: number): Attrs;
  /** a spot that adds the first item to an empty list */
  add(doc: string, listPath: string, label: string): Attrs;
  on: boolean;
}

const none: Editor = Object.assign(() => ({}), { item: () => ({}), add: () => ({}), on: false });

function kindOf(f: Field): string {
  if (f.kind === 'line' || f.kind === 'text' || f.kind === 'rich' || f.kind === 'image') return f.kind;
  return 'panel';
}

export function editor(Astro: Pick<AstroGlobal, 'locals'>): Editor {
  if (!Astro.locals.studio?.edit) return none;
  const fn = (doc: string, path: string, opts: { raw?: string | null; panel?: boolean } = {}): Attrs => {
    const type = docType(doc);
    const f = type ? (path === 'body' ? type.fields.body : fieldAt(type, path)) : null;
    if (!type || !f) return {};
    const a: Attrs = { 'data-sf': `${doc}|${path}`, 'data-sf-k': opts.panel ? 'panel' : kindOf(f), 'data-sf-label': f.label };
    if ((f.kind === 'line' || f.kind === 'text') && f.max) a['data-sf-max'] = String(f.max);
    if (f.required) a['data-sf-req'] = '1';
    if (f.kind === 'text' && f.links) a['data-sf-links'] = '1';
    if (opts.raw !== undefined && opts.raw !== null) a['data-sf-raw'] = opts.raw;
    if (f.kind === 'image') {
      a['data-sf-folder'] = f.folder;
      if (!f.required) a['data-sf-rm'] = '1';
      if (f.altField) {
        const parent = path.split('.').slice(0, -1);
        a['data-sf-alt'] = `${doc}|${[...parent, f.altField].join('.')}`;
      }
    }
    return a;
  };
  const item = (doc: string, listPath: string, index: number, count: number): Attrs => {
    const a: Attrs = { 'data-sf-item': `${doc}|${listPath}|${index}`, 'data-sf-n': String(count) };
    if (listPath === '@notable') {
      a['data-sf-noun'] = 'coin';
      return a;
    }
    const type = docType(doc);
    const f = type ? fieldAt(type, listPath) : null;
    if (f?.kind === 'list') {
      a['data-sf-noun'] = f.noun;
      if (f.newItem) a['data-sf-new'] = '1';
      if (f.maxItems) a['data-sf-maxn'] = String(f.maxItems);
    }
    return a;
  };
  const add = (doc: string, listPath: string, label: string): Attrs => ({ 'data-sf-add': `${doc}|${listPath}`, 'data-sf-label': label });
  return Object.assign(fn, { item, add, on: true });
}
