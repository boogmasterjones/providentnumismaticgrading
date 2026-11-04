/**
 * Provident Studio's in-page editor. Loaded only inside Studio's preview (/admin/preview/…, signed in), never on the
 * public site (src/components/StudioOverlay.astro is rendered only when Astro.locals.studio is set).
 *
 * It reads the data attributes written by src/lib/edit.ts:
 * - hovering outlines anything editable and names it;
 * - clicking text edits it in place (one-line, paragraph or formatted text, with the field's limits);
 * - clicking a photo, or something edited in a form, asks Studio (the parent window) to open its panel;
 * - lists get Move up / Move down / Add / Details / Remove controls.
 * Saving is done by the parent window (postMessage, same origin only), which owns the API calls, toasts and undo.
 */
import { htmlToMarkdown, paragraphText, plainText, safeHref } from '../lib/studio/richtext';

type Kind = 'line' | 'text' | 'rich' | 'image' | 'panel';
type Msg = Record<string, unknown> & { t: string };

const parentWin = window.parent !== window ? window.parent : null;
const ORIGIN = location.origin;
const post = (m: Msg) => parentWin?.postMessage({ source: 'studio-overlay', ...m }, ORIGIN);
const publicPath = () => location.pathname.replace(/^\/admin\/preview/, '') || '/';
const SCROLL_KEY = () => `sf-scroll:${location.pathname}`;
const touch = matchMedia('(hover: none)').matches;

let seq = 0;
const pending = new Map<string, (r: { ok: boolean; error?: string }) => void>();

// ------------------------------------------------------------------------------------------------ styles

const css = `
html.sf-on [data-sf] { cursor: text; outline: 1px dashed transparent; outline-offset: 4px; transition: outline-color .15s, background-color .15s; border-radius: 2px; }
html.sf-on [data-sf][data-sf-k="image"], html.sf-on [data-sf][data-sf-k="panel"] { cursor: pointer; }
html.sf-on [data-sf]:hover, html.sf-on [data-sf].sf-hot { outline-color: rgba(227,203,148,.85); background-color: rgba(201,164,92,.06); }
html.sf-on img[data-sf]:hover { outline: 2px solid rgba(227,203,148,.9); outline-offset: 3px; }
html.sf-on [data-sf]:empty::before { content: '+ ' attr(data-sf-label); color: rgba(227,203,148,.6); font: italic 400 1rem/1.4 var(--font-body, system-ui); }
html.sf-on .prose[data-sf]:empty, html.sf-on div[data-sf][data-sf-k="rich"]:empty { min-height: 3.5em; display: block; border: 1px dashed rgba(201,164,92,.35); padding: 1rem; }
html.sf-on [data-sf].sf-editing { outline: 2px solid #e3cb94 !important; outline-offset: 6px; background-color: rgba(10,10,11,.55) !important; cursor: text; -webkit-text-fill-color: currentColor !important; caret-color: #e3cb94; }
html.sf-on .metal[data-sf].sf-editing, html.sf-on .rake-t[data-sf].sf-editing { color: #e3cb94 !important; background-image: none !important; }
html.sf-on [data-sf].sf-saving { opacity: .55; }
html.sf-on [data-sf].sf-error { outline-color: #eeb59f !important; }
html.sf-on [data-sf-item].sf-item-hot { box-shadow: 0 0 0 1px rgba(201,164,92,.35); border-radius: 3px; }
html.sf-on .sf-wrap { display: inline-flex; }
html.sf-on .sf-empty-img { border: 1px dashed rgba(201,164,92,.5); padding: 2.5rem 1rem; text-align: center; color: rgba(227,203,148,.8); font: 500 .9rem/1.3 var(--font-body, system-ui); }
html.sf-on .sf-badge { font: 600 .7rem/1 var(--font-body, system-ui); letter-spacing: .08em; text-transform: uppercase; color: #15110a; background: #c9a45c; padding: .25em .5em; border-radius: 2px; vertical-align: middle; margin-left: .5em; }
html.sf-on .rv, html.sf-on .hero-in { opacity: 1 !important; transform: none !important; }
.sf-ui { all: initial; position: absolute; z-index: 2147483000; font: 500 13px/1.2 Inter, 'Segoe UI', system-ui, sans-serif; color: #ebe5d8; }
.sf-ui * { box-sizing: border-box; font: inherit; color: inherit; }
.sf-tag { pointer-events: none; background: #c9a45c; color: #15110a; padding: 4px 8px; border-radius: 3px 3px 3px 0; font-weight: 600; font-size: 11.5px; letter-spacing: .02em; white-space: nowrap; box-shadow: 0 6px 18px -6px rgba(0,0,0,.7); }
.sf-bar { display: flex; flex-wrap: wrap; gap: 4px; align-items: center; background: #141416; border: 1px solid rgba(201,164,92,.45); border-radius: 6px; padding: 4px; box-shadow: 0 18px 40px -16px rgba(0,0,0,.9); max-width: calc(100vw - 16px); }
.sf-bar button { all: unset; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; min-height: 32px; min-width: 32px; justify-content: center; padding: 0 9px; border-radius: 4px; color: #ebe5d8; font-weight: 500; font-size: 13px; }
.sf-bar button:hover { background: rgba(201,164,92,.16); }
.sf-bar button:focus-visible { outline: 2px solid #e9d3a0; outline-offset: 1px; }
.sf-bar button[disabled] { opacity: .35; cursor: default; background: none; }
.sf-bar button.sf-primary { background: #c9a45c; color: #15110a; font-weight: 600; }
.sf-bar button.sf-primary:hover { background: #e3cb94; }
.sf-bar button.sf-danger:hover { background: rgba(230,150,120,.18); color: #eeb59f; }
.sf-bar .sf-sep { width: 1px; align-self: stretch; background: rgba(235,229,216,.14); margin: 2px 2px; }
.sf-bar .sf-count { padding: 0 8px; color: #948d80; font-variant-numeric: tabular-nums; font-size: 12px; }
.sf-bar .sf-count.sf-over { color: #eeb59f; font-weight: 600; }
.sf-bar .sf-label { padding: 0 8px; color: #e3cb94; font-weight: 600; font-size: 12px; max-width: 220px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.sf-msg { margin-top: 6px; background: #2a1814; border: 1px solid rgba(230,150,120,.5); color: #eeb59f; padding: 7px 10px; border-radius: 5px; font-size: 12.5px; max-width: 360px; }
.sf-link { display: flex; gap: 6px; margin-top: 6px; background: #141416; border: 1px solid rgba(201,164,92,.45); border-radius: 6px; padding: 6px; }
.sf-link input { all: unset; flex: 1; min-width: 220px; background: #0c0c0e; border: 1px solid rgba(235,229,216,.18); border-radius: 4px; padding: 7px 9px; font-size: 13px; color: #ebe5d8; }
.sf-link input:focus { border-color: #c9a45c; }
.sf-addbtn { all: unset; position: relative; z-index: 5; cursor: pointer; display: inline-flex; align-items: center; gap: 8px; margin: 1rem auto; padding: 12px 18px; border: 1px dashed rgba(227,203,148,.7); border-radius: 6px; background: rgba(10,10,11,.75); color: #e3cb94; font: 600 14px/1.2 Inter, system-ui, sans-serif; }
.sf-addbtn:hover, .sf-addbtn:focus-visible { background: rgba(201,164,92,.18); outline: none; }
.sf-addwrap { display: flex; justify-content: center; width: 100%; }
`;

function addStyles() {
  const s = document.createElement('style');
  s.textContent = css;
  document.head.append(s);
  document.documentElement.classList.add('sf-on');
}

// ------------------------------------------------------------------------------------------------ helpers

function ui<K extends keyof HTMLElementTagNameMap>(tagName: K, cls: string, html = ''): HTMLElementTagNameMap[K] {
  const el = document.createElement(tagName);
  el.className = cls;
  if (html) el.innerHTML = html;
  return el;
}

function place(box: HTMLElement, target: Element, where: 'above' | 'below' | 'corner' = 'above') {
  const r = target.getBoundingClientRect();
  document.body.append(box);
  const w = box.offsetWidth;
  const h = box.offsetHeight;
  let top = where === 'below' ? r.bottom + 8 : where === 'corner' ? r.top + 6 : r.top - h - 10;
  if (where === 'above' && top < 8) top = r.bottom + 10;
  let left = where === 'corner' ? r.right - w - 6 : r.left;
  left = Math.max(8, Math.min(left, innerWidth - w - 8));
  top = Math.max(8, Math.min(top, innerHeight - h - 8));
  box.style.top = `${top + scrollY}px`;
  box.style.left = `${left + scrollX}px`;
}

function parseRef(v: string) {
  const [doc, path] = v.split('|');
  return { doc, path };
}

function field(el: Element) {
  const { doc, path } = parseRef(el.getAttribute('data-sf') ?? '');
  return {
    doc,
    path,
    kind: (el.getAttribute('data-sf-k') ?? 'line') as Kind,
    label: el.getAttribute('data-sf-label') ?? 'Text',
    max: Number(el.getAttribute('data-sf-max') ?? 0) || 0,
    required: el.getAttribute('data-sf-req') === '1',
    links: el.getAttribute('data-sf-links') === '1',
    raw: el.getAttribute('data-sf-raw'),
  };
}

function request(m: Msg): Promise<{ ok: boolean; error?: string }> {
  const id = `r${++seq}`;
  return new Promise((resolve) => {
    pending.set(id, resolve);
    post({ ...m, id });
  });
}

function saveScroll() {
  try {
    sessionStorage.setItem(SCROLL_KEY(), JSON.stringify({ y: scrollY, at: Date.now() }));
  } catch {
    /* private mode */
  }
}

function saveScrollAndReload() {
  saveScroll();
  location.reload();
}

// ------------------------------------------------------------------------------------------------ hover tag

const tag = ui('div', 'sf-ui sf-tag');
let hot: Element | null = null;
function showTag(el: Element | null) {
  if (hot === el) return;
  hot?.classList.remove('sf-hot');
  hot = el;
  if (!el || editing?.el === el) {
    tag.remove();
    return;
  }
  el.classList.add('sf-hot');
  const k = el.getAttribute('data-sf-k');
  const verb = k === 'image' ? 'Change photo' : k === 'panel' ? 'Edit' : 'Edit text';
  tag.textContent = `${verb} · ${el.getAttribute('data-sf-label') ?? ''}`;
  place(tag, el, 'above');
}

// ------------------------------------------------------------------------------------------------ list controls

const itemBar = ui('div', 'sf-ui sf-bar sf-itembar');
itemBar.setAttribute('role', 'toolbar');
let activeItem: HTMLElement | null = null;

const ICON = {
  up: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M8 13V3M3.5 7.5 8 3l4.5 4.5"/></svg>',
  down: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M8 3v10M3.5 8.5 8 13l4.5-4.5"/></svg>',
  add: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M8 3v10M3 8h10"/></svg>',
  edit: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M11 2.5 13.5 5 6 12.5 3 13l.5-3z"/></svg>',
  del: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 4.5h10M6.5 4.5V3h3v1.5M4.5 4.5l.7 8.5h5.6l.7-8.5"/></svg>',
};

function itemInfo(el: Element) {
  const [doc, listPath, idx] = (el.getAttribute('data-sf-item') ?? '').split('|');
  return {
    doc,
    listPath,
    index: Number(idx),
    count: Number(el.getAttribute('data-sf-n') ?? 0),
    noun: el.getAttribute('data-sf-noun') ?? 'item',
    canNew: el.getAttribute('data-sf-new') === '1',
    max: Number(el.getAttribute('data-sf-maxn') ?? 0) || 0,
  };
}

function showItemBar(el: HTMLElement | null) {
  if (activeItem === el) return;
  activeItem?.classList.remove('sf-item-hot');
  activeItem = el;
  if (!el || editing) {
    itemBar.remove();
    return;
  }
  el.classList.add('sf-item-hot');
  const i = itemInfo(el);
  const full = i.max > 0 && i.count >= i.max;
  itemBar.innerHTML = '';
  const b = (html: string, label: string, fn: () => void, opts: { disabled?: boolean; cls?: string } = {}) => {
    const btn = ui('button', opts.cls ?? '', html);
    btn.type = 'button';
    btn.title = label;
    btn.setAttribute('aria-label', label);
    if (opts.disabled) btn.disabled = true;
    btn.addEventListener('mousedown', (e) => e.preventDefault());
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      fn();
    });
    itemBar.append(btn);
  };
  const lab = ui('span', 'sf-label');
  lab.textContent = `${i.noun[0].toUpperCase()}${i.noun.slice(1)} ${i.index + 1} of ${i.count}`;
  itemBar.append(lab);
  b(ICON.up, `Move this ${i.noun} up`, () => listAction(el, 'up'), { disabled: i.index === 0 });
  b(ICON.down, `Move this ${i.noun} down`, () => listAction(el, 'down'), { disabled: i.index >= i.count - 1 });
  b(`${ICON.add}<span>Add</span>`, full ? `No more room: ${i.max} at most` : `Add a ${i.noun} after this one`, () => listAction(el, 'add'), { disabled: full });
  b(`${ICON.edit}<span>Details</span>`, `All the details of this ${i.noun}`, () =>
    post(i.listPath === '@notable' ? { t: 'panel', doc: i.doc, path: '' } : { t: 'panel', doc: i.doc, path: `${i.listPath}.${i.index}` }),
  );
  b(ICON.del, `Remove this ${i.noun}`, () => listAction(el, 'remove'), { cls: 'sf-danger' });
  place(itemBar, el, 'corner');
}

function listAction(el: Element, op: 'up' | 'down' | 'add' | 'remove') {
  const i = itemInfo(el);
  post({ t: 'list', doc: i.doc, path: i.listPath, op, index: i.index, noun: i.noun, canNew: i.canNew });
}

// ------------------------------------------------------------------------------------------------ inline editing

interface Editing {
  el: HTMLElement;
  f: ReturnType<typeof field>;
  original: string;
  originalValue: string;
  bar: HTMLDivElement;
  count: HTMLSpanElement | null;
  msg: HTMLDivElement | null;
}
let editing: Editing | null = null;

function valueOf(el: HTMLElement, f: ReturnType<typeof field>): string {
  if (f.kind === 'line') return plainText(el);
  if (f.kind === 'text') return paragraphText(el, f.links);
  return htmlToMarkdown(el);
}

function caretAt(x: number, y: number) {
  const d = document as Document & { caretPositionFromPoint?(x: number, y: number): { offsetNode: Node; offset: number } | null };
  const sel = getSelection();
  if (!sel) return;
  let range: Range | null = null;
  if (d.caretPositionFromPoint) {
    const p = d.caretPositionFromPoint(x, y);
    if (p) {
      range = document.createRange();
      range.setStart(p.offsetNode, p.offset);
    }
  } else if (document.caretRangeFromPoint) range = document.caretRangeFromPoint(x, y);
  if (range) {
    range.collapse(true);
    sel.removeAllRanges();
    sel.addRange(range);
  }
}

function startEdit(el: HTMLElement, at?: { x: number; y: number }) {
  if (editing?.el === el) return;
  if (editing) void commit();
  showItemBar(null);
  showTag(null);
  const f = field(el);
  const original = el.innerHTML;
  if (f.raw !== null && f.kind === 'line') el.textContent = f.raw; // e.g. inscription capitals shown as "WHAT · WE · GRADE"
  const originalValue = f.raw ?? valueOf(el, f);
  try {
    el.contentEditable = f.kind === 'line' ? 'plaintext-only' : 'true';
  } catch {
    el.contentEditable = 'true'; // browsers without plaintext-only
  }
  el.classList.add('sf-editing');
  el.spellcheck = true;
  if (f.kind === 'rich') document.execCommand('defaultParagraphSeparator', false, 'p');
  el.focus({ preventScroll: true });
  if (at && f.raw === null) caretAt(at.x, at.y);
  else {
    const r = document.createRange();
    r.selectNodeContents(el);
    r.collapse(false);
    getSelection()?.removeAllRanges();
    getSelection()?.addRange(r);
  }

  const bar = ui('div', 'sf-ui sf-bar sf-editbar');
  bar.setAttribute('role', 'toolbar');
  bar.setAttribute('aria-label', `Editing ${f.label}`);
  const lab = ui('span', 'sf-label');
  lab.textContent = f.label;
  bar.append(lab);
  const btn = (html: string, label: string, fn: () => void, cls = '') => {
    const b = ui('button', cls, html);
    b.type = 'button';
    b.title = label;
    b.setAttribute('aria-label', label);
    b.addEventListener('mousedown', (e) => e.preventDefault()); // keep the text selection
    b.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      fn();
    });
    bar.append(b);
    return b;
  };
  if (f.kind === 'rich') {
    btn('<b>B</b>', 'Bold (Ctrl+B)', () => document.execCommand('bold'));
    btn('<i style="font-style:italic;font-family:Georgia,serif">I</i>', 'Italic (Ctrl+I)', () => document.execCommand('italic'));
    btn('Heading', 'Make this paragraph a heading', () => toggleBlock('h2'));
    btn('Subheading', 'Make this paragraph a smaller heading', () => toggleBlock('h3'));
    btn('• List', 'Bulleted list', () => document.execCommand('insertUnorderedList'));
    btn('Link', 'Link the selected words', () => linkPrompt(bar));
    btn('Photo', 'Insert a photo here', () => insertPhoto());
  } else if (f.kind === 'text' && f.links) {
    btn('Link', 'Link the selected words', () => linkPrompt(bar));
  }
  const sep = ui('span', 'sf-sep');
  bar.append(sep);
  const count = f.max ? (ui('span', 'sf-count') as HTMLSpanElement) : null;
  if (count) bar.append(count);
  btn('Cancel', 'Cancel (Esc)', () => cancel());
  btn('<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2"><path d="m3 8.5 3.2 3L13 4.5"/></svg><span>Done</span>', f.kind === 'line' ? 'Save (Enter)' : 'Save (Ctrl+Enter)', () => void commit(), 'sf-primary');
  editing = { el, f, original, originalValue, bar, count, msg: null };
  place(bar, el, 'above');
  updateCount();
}

function toggleBlock(tagName: 'h2' | 'h3') {
  const sel = getSelection();
  const node = sel?.anchorNode;
  const block = (node instanceof Element ? node : node?.parentElement)?.closest('h2,h3,p,li,div');
  const current = block?.tagName.toLowerCase();
  document.execCommand('formatBlock', false, current === tagName ? 'p' : tagName);
}

function linkPrompt(bar: HTMLElement) {
  bar.parentElement?.querySelector('.sf-link')?.remove();
  const sel = getSelection();
  const range = sel && sel.rangeCount ? sel.getRangeAt(0).cloneRange() : null;
  if (!range || range.collapsed) {
    showMsg('First select the words to link, then press Link.');
    return;
  }
  const box = ui('form', 'sf-link');
  box.innerHTML = '<input type="text" aria-label="Link address" placeholder="A page like /contact, or https://…" /><button type="submit" class="sf-primary">Link</button><button type="button" data-unlink>Remove link</button>';
  const wrap = ui('div', 'sf-ui');
  wrap.append(box);
  const input = box.querySelector('input')!;
  const anchor = (range.commonAncestorContainer instanceof Element ? range.commonAncestorContainer : range.commonAncestorContainer.parentElement)?.closest('a');
  input.value = anchor?.getAttribute('href') ?? '';
  box.addEventListener('submit', (e) => {
    e.preventDefault();
    const href = safeHref(input.value);
    if (!href) {
      input.setCustomValidity('Use a page of this site (/contact), or an address starting with https://');
      input.reportValidity();
      return;
    }
    sel!.removeAllRanges();
    sel!.addRange(range);
    document.execCommand('createLink', false, href);
    wrap.remove();
    editing?.el.focus();
    updateCount();
  });
  box.querySelector('[data-unlink]')!.addEventListener('click', () => {
    sel!.removeAllRanges();
    sel!.addRange(range);
    document.execCommand('unlink');
    wrap.remove();
    editing?.el.focus();
  });
  input.addEventListener('input', () => input.setCustomValidity(''));
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      wrap.remove();
      editing?.el.focus();
    }
  });
  place(wrap, bar, 'below');
  input.focus();
}

async function insertPhoto() {
  if (!editing) return;
  const sel = getSelection();
  const range = sel && sel.rangeCount ? sel.getRangeAt(0).cloneRange() : null;
  const id = `r${++seq}`;
  const result = await new Promise<{ ok: boolean; src?: string; alt?: string }>((resolve) => {
    pending.set(id, resolve as (r: { ok: boolean }) => void);
    post({ t: 'pickImage', id, folder: editing!.f.doc.startsWith('post:') ? 'blog' : 'pages' });
  });
  if (!result.ok || !result.src || !editing) return;
  editing.el.focus();
  if (range && editing.el.contains(range.startContainer)) {
    sel!.removeAllRanges();
    sel!.addRange(range);
  }
  const img = document.createElement('img');
  img.src = result.src;
  img.alt = result.alt ?? '';
  const p = document.createElement('p');
  p.append(img);
  const block = (range?.startContainer instanceof Element ? range.startContainer : range?.startContainer.parentElement)?.closest('p,h2,h3,ul,ol,blockquote');
  if (block && editing.el.contains(block)) block.after(p);
  else editing.el.append(p);
  updateCount();
}

function showMsg(text: string) {
  if (!editing) return;
  editing.msg?.remove();
  const m = ui('div', 'sf-msg') as HTMLDivElement;
  m.textContent = text;
  m.setAttribute('role', 'alert');
  editing.bar.append(m);
  editing.msg = m;
}

function updateCount() {
  if (!editing?.count) return;
  const n = valueOf(editing.el, editing.f).length;
  editing.count.textContent = `${n} / ${editing.f.max}`;
  editing.count.classList.toggle('sf-over', n > editing.f.max);
}

function endEdit(restore: boolean) {
  if (!editing) return;
  const { el, bar, original } = editing;
  el.contentEditable = 'false';
  el.removeAttribute('contenteditable');
  el.classList.remove('sf-editing', 'sf-error');
  if (restore) el.innerHTML = original;
  bar.remove();
  document.querySelectorAll('.sf-link').forEach((n) => n.parentElement?.remove());
  editing = null;
}

function cancel() {
  endEdit(true);
}

async function commit(): Promise<void> {
  if (!editing) return;
  const ed = editing;
  const value = valueOf(ed.el, ed.f);
  if (value === ed.originalValue || (ed.f.kind !== 'rich' && value.trim() === ed.originalValue.trim())) {
    endEdit(ed.f.raw !== null);
    return;
  }
  if (ed.f.required && !value.trim()) {
    showMsg(`${ed.f.label} can't be empty.`);
    ed.el.classList.add('sf-error');
    return;
  }
  if (ed.f.max && value.length > ed.f.max) {
    showMsg(`Too long: ${value.length} characters, the limit is ${ed.f.max}. Shorten it a little.`);
    ed.el.classList.add('sf-error');
    return;
  }
  ed.el.classList.add('sf-saving');
  const r = await request({ t: 'save', doc: ed.f.doc, path: ed.f.path, value, label: ed.f.label });
  ed.el.classList.remove('sf-saving');
  if (!r.ok) {
    showMsg(r.error ?? 'Could not save. Try again.');
    ed.el.classList.add('sf-error');
    return;
  }
  const reload = ed.f.raw !== null || ed.f.kind === 'rich' || /^(settings\|siteName)$/.test(`${ed.f.doc}|${ed.f.path}`);
  endEdit(false);
  if (reload) saveScrollAndReload();
}

// ------------------------------------------------------------------------------------------------ events

// Where the pointer went down: some page scripts capture the pointer (the slideshow's drag), which turns the click's
// target into their container; the element really clicked is the one under the pointer at pointerdown.
let downTarget: Element | null = null;

function onClick(e: MouseEvent) {
  let t = e.target as Element | null;
  if (downTarget && t && t !== downTarget && t.contains(downTarget)) t = downTarget;
  downTarget = null;
  if (!t || t.closest('.sf-ui')) return;
  if (editing && editing.el.contains(t)) {
    // inside the text being edited: links don't navigate; a photo in formatted text opens the photo panel
    if (t.closest('a')) e.preventDefault();
    if (t instanceof HTMLImageElement && editing.f.kind === 'rich') {
      e.preventDefault();
      void editInlinePhoto(t);
    }
    return;
  }
  const addSpot = t.closest('.sf-addbtn');
  if (addSpot) return;
  const el = t.closest<HTMLElement>('[data-sf]');
  if (el) {
    e.preventDefault();
    e.stopPropagation();
    const f = field(el);
    if (f.kind === 'image') {
      if (editing) void commit();
      const img = el instanceof HTMLImageElement ? el : null;
      post({ t: 'image', doc: f.doc, path: f.path, label: f.label, folder: el.getAttribute('data-sf-folder'), alt: el.getAttribute('data-sf-alt'), removable: el.getAttribute('data-sf-rm') === '1', src: img?.getAttribute('src') ?? '' });
      return;
    }
    if (f.kind === 'panel') {
      if (editing) void commit();
      post({ t: 'panel', doc: f.doc, path: f.path });
      return;
    }
    startEdit(el, { x: e.clientX, y: e.clientY });
    return;
  }
  if (editing) void commit();
  const item = t.closest<HTMLElement>('[data-sf-item]');
  if (touch) showItemBar(item);
  const a = t.closest('a');
  if (a) {
    e.preventDefault();
    const href = a.getAttribute('href') ?? '';
    if (href.startsWith('#')) {
      document.querySelector(href)?.scrollIntoView({ behavior: 'smooth' });
      return;
    }
    let u: URL;
    try {
      u = new URL(href, location.href);
    } catch {
      return;
    }
    if (u.origin === ORIGIN && !u.pathname.startsWith('/api/') && !u.pathname.startsWith('/admin')) {
      post({ t: 'navigate', path: u.pathname });
      return;
    }
    post({ t: 'toast', msg: 'Links to other websites, email and phone are paused while you edit.' });
  }
}

async function editInlinePhoto(img: HTMLImageElement) {
  const id = `r${++seq}`;
  const r = await new Promise<{ ok: boolean; src?: string; alt?: string; remove?: boolean }>((resolve) => {
    pending.set(id, resolve as (r: { ok: boolean }) => void);
    post({ t: 'pickImage', id, src: img.getAttribute('src'), alt: img.getAttribute('alt') ?? '', removable: true, folder: editing?.f.doc.startsWith('post:') ? 'blog' : 'pages' });
  });
  if (!r.ok) return;
  if (r.remove) img.remove();
  else {
    if (r.src) img.src = r.src;
    img.alt = r.alt ?? '';
  }
}

function onKey(e: KeyboardEvent) {
  if (!editing) return;
  const { f } = editing;
  if (e.key === 'Escape') {
    e.preventDefault();
    cancel();
    return;
  }
  if (e.key === 'Enter') {
    if (f.kind === 'line' || e.ctrlKey || e.metaKey) {
      e.preventDefault();
      void commit();
      return;
    }
    if (f.kind === 'text') {
      // a new paragraph (a blank line in the stored text)
      e.preventDefault();
      // marked so the paragraph break survives even when the browser later drops the second line break
      document.execCommand('insertHTML', false, e.shiftKey ? '<br>' : '<br data-sf-p="1"><br>');
    }
    return;
  }
  if ((e.ctrlKey || e.metaKey) && ['b', 'i', 'u'].includes(e.key.toLowerCase()) && f.kind !== 'rich') e.preventDefault();
}

function onPaste(e: ClipboardEvent) {
  if (!editing || !editing.el.contains(e.target as Node)) return;
  e.preventDefault();
  let text = e.clipboardData?.getData('text/plain') ?? '';
  if (editing.f.kind === 'line') text = text.replace(/\s+/g, ' ');
  if (editing.f.kind === 'line') document.execCommand('insertText', false, text);
  else {
    const html = text
      .replace(/\r\n?/g, '\n')
      .split(/\n{2,}/)
      .map((p) => p.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]!).replace(/\n/g, '<br>'))
      .join(editing.f.kind === 'rich' ? '</p><p>' : '<br><br>');
    document.execCommand('insertHTML', false, editing.f.kind === 'rich' ? `<p>${html}</p>` : html);
  }
}

function onFocusOut(e: FocusEvent) {
  if (!editing) return;
  const to = e.relatedTarget as Element | null;
  if (to && (editing.el.contains(to) || to.closest('.sf-ui'))) return;
  // give toolbar clicks a moment; commit when focus really left
  setTimeout(() => {
    if (!editing) return;
    const a = document.activeElement;
    if (a && (editing.el.contains(a) || a.closest('.sf-ui'))) return;
    void commit();
  }, 120);
}

function onMove(e: MouseEvent) {
  if (touch) return;
  const t = e.target as Element | null;
  if (!t) return;
  if (t.closest('.sf-ui')) return;
  showTag(editing ? null : t.closest('[data-sf]'));
  showItemBar(editing ? null : t.closest<HTMLElement>('[data-sf-item]'));
}

function onMessage(e: MessageEvent) {
  if (e.origin !== ORIGIN || e.source !== parentWin) return;
  const m = e.data as Msg;
  if (!m || typeof m !== 'object' || m.source !== 'studio-app') return;
  if (m.t === 'result' && typeof m.id === 'string') {
    const fn = pending.get(m.id);
    pending.delete(m.id);
    fn?.(m as unknown as { ok: boolean });
  } else if (m.t === 'reload') {
    saveScrollAndReload();
  }
}

function addSpots() {
  for (const el of document.querySelectorAll<HTMLElement>('[data-sf-add]')) {
    const [doc, path] = (el.getAttribute('data-sf-add') ?? '').split('|');
    const wrap = ui('div', 'sf-ui sf-addwrap');
    wrap.style.position = 'relative';
    const b = ui('button', 'sf-addbtn', `${ICON.add}<span></span>`);
    b.type = 'button';
    b.querySelector('span')!.textContent = el.getAttribute('data-sf-label') ?? 'Add';
    b.addEventListener('click', (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      post({ t: 'add', doc, path });
    });
    wrap.append(b);
    if (el.tagName === 'UL' || el.tagName === 'OL') el.after(wrap);
    else el.prepend(wrap);
  }
}

function restoreScroll() {
  // back to where the editor was when the page reloads after a change (only a recent position, not an old visit)
  let saved: { y: number; at: number } | null = null;
  try {
    saved = JSON.parse(sessionStorage.getItem(SCROLL_KEY()) ?? 'null') as { y: number; at: number } | null;
  } catch {
    /* private mode */
  }
  if (!saved || Date.now() - saved.at > 15_000) return;
  const to = saved.y;
  const go = () => scrollTo({ top: to, behavior: 'instant' as ScrollBehavior });
  go();
  requestAnimationFrame(go);
  addEventListener('load', go, { once: true });
  setTimeout(go, 400);
}

function init() {
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  addStyles();
  addSpots();
  restoreScroll();
  document.addEventListener('pointerdown', (e) => (downTarget = e.target as Element), true);
  document.addEventListener('click', onClick, true);
  document.addEventListener('keydown', onKey, true);
  document.addEventListener('paste', onPaste, true);
  document.addEventListener('focusout', onFocusOut, true);
  document.addEventListener('input', updateCount, true);
  document.addEventListener('mousemove', onMove, { passive: true });
  document.addEventListener('submit', (e) => {
    e.preventDefault();
    post({ t: 'toast', msg: 'Forms are not sent while you edit.' });
  }, true);
  let st = 0;
  addEventListener('scroll', () => {
    clearTimeout(st);
    st = window.setTimeout(saveScroll, 200);
    if (editing) place(editing.bar, editing.el, 'above');
    else if (activeItem) place(itemBar, activeItem, 'corner');
    if (hot) place(tag, hot, 'above');
  }, { passive: true });
  addEventListener('message', onMessage);
  addEventListener('pagehide', saveScroll);
  post({ t: 'ready', path: publicPath(), title: document.title });
}

if (parentWin) init();
