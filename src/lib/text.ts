/** Escape text for HTML. */
export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);
}

/**
 * Plain editor text to safe HTML: everything is escaped, then Markdown-style links [text](/path) become <a> tags.
 * Only site paths (/...), #anchors, https: and mailto:/tel: links are allowed.
 */
export function inlineLinks(s: string): string {
  return escapeHtml(s).replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, label: string, href: string) => {
    const h = href.replace(/&amp;/g, '&');
    if (!/^(\/(?!\/)|#|https:\/\/|mailto:|tel:)/.test(h)) return m;
    return `<a href="${escapeHtml(h)}">${label}</a>`;
  });
}

/** 1 -> "I", 9 -> "IX" (for numbering steps the way a medal or a clock face would). */
export function roman(n: number): string {
  const map: [number, string][] = [[1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
  let out = '';
  for (const [v, s] of map) while (n >= v) { out += s; n -= v; }
  return out;
}
