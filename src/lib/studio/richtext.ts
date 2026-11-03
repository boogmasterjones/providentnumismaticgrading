/**
 * Turning what was edited in the page back into the text the content files store. Works on anything shaped like a
 * DOM node (the browser's DOM in Studio; a tiny stand-in in the tests).
 *
 * - `plainText`: a one-line field, e.g. a heading.
 * - `paragraphText`: a plain text field; paragraphs (blank lines) and, where allowed, [text](/link) links.
 * - `htmlToMarkdown`: a formatted body (Markdoc): headings, bold, italic, links, lists, quotes and photos.
 */

export interface NodeLike {
  nodeType: number;
  nodeName: string;
  nodeValue: string | null;
  childNodes: ArrayLike<NodeLike>;
  getAttribute?(name: string): string | null;
}

const TEXT = 3;
const ELEMENT = 1;
const kids = (n: NodeLike) => Array.from(n.childNodes);
const tag = (n: NodeLike) => n.nodeName.toUpperCase();
const attr = (n: NodeLike, a: string) => (n.getAttribute ? n.getAttribute(a) : null) ?? '';
const BLOCKS = new Set(['P', 'DIV', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'UL', 'OL', 'LI', 'BLOCKQUOTE', 'PRE', 'HR', 'FIGURE', 'SECTION']);
const SKIP = new Set(['SCRIPT', 'STYLE', 'TEMPLATE', 'BUTTON']);

/** A link target Studio accepts: a page of this site, an #anchor, https, mailto or tel. Others are dropped. */
export function safeHref(href: string): string | null {
  let h = href.trim();
  if (typeof location !== 'undefined' && h.startsWith(location.origin)) h = h.slice(location.origin.length) || '/';
  h = h.replace(/^\/admin\/preview(?=\/|$)/, '') || h;
  if (h === '') return null;
  if (/^\/(?!\/)/.test(h) || h.startsWith('#') || /^https:\/\/[^\s]+$/i.test(h) || /^mailto:[^\s]+$/i.test(h) || /^tel:[+\d\s()-]+$/i.test(h)) return h;
  if (/^http:\/\/[^\s]+$/i.test(h)) return h;
  return null;
}

/** Preview photo addresses point at the drafts (/api/studio/media/images/…); the files keep /images/…. */
export function cleanSrc(src: string): string {
  let s = src.trim();
  if (typeof location !== 'undefined' && s.startsWith(location.origin)) s = s.slice(location.origin.length);
  return s.replace(/^\/api\/studio\/media(?=\/images\/)/, '');
}

const nbsp = (s: string) => s.replace(/ /g, ' ');

/** One line of text. */
export function plainText(el: NodeLike): string {
  const walk = (n: NodeLike): string => {
    if (n.nodeType === TEXT) return n.nodeValue ?? '';
    if (n.nodeType !== ELEMENT || SKIP.has(tag(n))) return '';
    if (tag(n) === 'BR') return ' ';
    return kids(n).map(walk).join('');
  };
  return nbsp(walk(el)).replace(/\s+/g, ' ').trim();
}

/** Plain text with paragraphs (blank line between) and, when `links`, [text](link). */
export function paragraphText(el: NodeLike, links: boolean): string {
  const walk = (n: NodeLike): string => {
    if (n.nodeType === TEXT) return (n.nodeValue ?? '').replace(/[ \t\r\n]+/g, ' ');
    if (n.nodeType !== ELEMENT || SKIP.has(tag(n))) return '';
    const t = tag(n);
    if (t === 'BR') return '\n';
    const inner = kids(n).map(walk).join('');
    if (t === 'A') {
      const href = safeHref(attr(n, 'href'));
      return links && href && inner.trim() ? `[${inner.trim()}](${href})` : inner;
    }
    if (BLOCKS.has(t)) return `\n\n${inner}\n\n`;
    return inner;
  };
  return nbsp(kids(el).map(walk).join(''))
    .split('\n')
    .map((l) => l.trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Characters that would otherwise turn into formatting. */
function esc(s: string): string {
  return s.replace(/([\\*_`[\]])/g, '\\$1');
}

function inlineMd(n: NodeLike): string {
  if (n.nodeType === TEXT) return esc((n.nodeValue ?? '').replace(/[ \t\r\n]+/g, ' '));
  if (n.nodeType !== ELEMENT || SKIP.has(tag(n))) return '';
  const t = tag(n);
  const inner = () => kids(n).map(inlineMd).join('');
  const wrap = (mark: string) => {
    const s = inner();
    const m = s.match(/^(\s*)([\s\S]*?)(\s*)$/)!;
    return m[2] ? `${m[1]}${mark}${m[2]}${mark}${m[3]}` : s;
  };
  switch (t) {
    case 'BR':
      return '\n';
    case 'STRONG':
    case 'B':
      return wrap('**');
    case 'EM':
    case 'I':
      return wrap('_');
    case 'CODE':
      return '`' + (kids(n).map((k) => k.nodeValue ?? '').join('')) + '`';
    case 'A': {
      const href = safeHref(attr(n, 'href'));
      const s = inner().trim();
      return href && s ? `[${s}](${href})` : s;
    }
    case 'IMG': {
      const src = cleanSrc(attr(n, 'src'));
      return src ? `![${esc(attr(n, 'alt'))}](${src})` : '';
    }
    default:
      return BLOCKS.has(t) ? blockMd(n, '') : inner();
  }
}

function blockMd(n: NodeLike, indent: string): string {
  const t = tag(n);
  const inlineOf = (x: NodeLike) =>
    kids(x)
      .filter((k) => !(k.nodeType === ELEMENT && (tag(k) === 'UL' || tag(k) === 'OL')))
      .map(inlineMd)
      .join('')
      .replace(/\s*\n\s*/g, '\n')
      .trim();
  if (/^H[1-6]$/.test(t)) {
    const level = Math.max(2, Number(t[1])); // the page has its own h1
    const s = inlineOf(n).replace(/\n/g, ' ');
    return s ? `${'#'.repeat(level)} ${s}` : '';
  }
  if (t === 'UL' || t === 'OL') {
    const items = kids(n).filter((k) => k.nodeType === ELEMENT && tag(k) === 'LI');
    return items
      .map((li, i) => {
        const bullet = t === 'OL' ? `${i + 1}. ` : '- ';
        const text = inlineOf(li).replace(/\n/g, `\n${indent}${' '.repeat(bullet.length)}`);
        const nested = kids(li)
          .filter((k) => k.nodeType === ELEMENT && (tag(k) === 'UL' || tag(k) === 'OL'))
          .map((k) => blockMd(k, indent + '  '))
          .join('\n');
        return `${indent}${bullet}${text}${nested ? '\n' + nested : ''}`;
      })
      .join('\n');
  }
  if (t === 'BLOCKQUOTE') {
    const inner = blocks(n).join('\n\n');
    return inner.split('\n').map((l) => (l ? `> ${l}` : '>')).join('\n');
  }
  if (t === 'HR') return '---';
  if (t === 'PRE') return '```\n' + kids(n).map((k) => (k.nodeType === TEXT ? k.nodeValue : plainText(k))).join('') + '\n```';
  // P, DIV, FIGURE, SECTION, LI outside a list: paragraphs (a div holding blocks is unwrapped)
  if (kids(n).some((k) => k.nodeType === ELEMENT && BLOCKS.has(tag(k)))) return blocks(n).join('\n\n');
  return inlineOf(n);
}

/** The block-level pieces of an element; loose inline content is gathered into paragraphs. */
function blocks(el: NodeLike): string[] {
  const out: string[] = [];
  let run: NodeLike[] = [];
  const flush = () => {
    const s = run.map(inlineMd).join('').replace(/\s*\n\s*/g, '\n').trim();
    if (s) out.push(s);
    run = [];
  };
  for (const k of kids(el)) {
    if (k.nodeType === ELEMENT && BLOCKS.has(tag(k))) {
      flush();
      const b = blockMd(k, '');
      if (b.trim()) out.push(b);
    } else run.push(k);
  }
  flush();
  return out;
}

/** A formatted body as Markdoc (Markdown) text. */
export function htmlToMarkdown(el: NodeLike): string {
  const md = blocks(el).join('\n\n').replace(/\n{3,}/g, '\n\n').trim();
  return md ? md + '\n' : '';
}
