/**
 * Ancient-Rome accents (client, 2026-11-02: "a sort of ancient Rome type of feel for the accents", kept simple and
 * modern). Small geometry helpers for the laurel drawings and the inscription lettering. Everything is drawn as
 * inline SVG; there are no image files. Styles: src/styles/roman.css.
 */

const f = (n: number) => +n.toFixed(2);

/** One almond-shaped leaf, base at the origin, pointing along +x. */
const leafPath = (len: number, w: number) => `M0 0Q${f(len / 2)} ${f(-w)} ${f(len)} 0Q${f(len / 2)} ${f(w)} 0 0Z`;

export interface WreathOptions {
  cx: number;
  cy: number;
  /** radius of the stem */
  r: number;
  /** the branch runs from the bottom (from) up the left side to (to), in degrees, SVG angles (90 = bottom) */
  from?: number;
  to?: number;
  leaves?: number;
  leafLen?: number;
  leafW?: number;
  stroke?: number;
}

/**
 * A laurel wreath: two branches rising from the bottom around a circle, mirrored, leaving the top open (like the
 * wreath on an imperial coin). Returns SVG markup (paths in currentColor); leaves are filled, the stems hairline.
 */
export function wreathSvg(o: WreathOptions): string {
  const { cx, cy, r, from = 104, to = 244, leaves = 8, leafLen = 4.6, leafW = 1.35, stroke = 0.45 } = o;
  const rad = (d: number) => (d * Math.PI) / 180;
  const pt = (a: number, rr = r) => [cx + rr * Math.cos(rad(a)), cy + rr * Math.sin(rad(a))];
  const [x0, y0] = pt(from);
  const [x1, y1] = pt(to);
  const stem = `<path d="M${f(x0)} ${f(y0)}A${r} ${r} 0 0 1 ${f(x1)} ${f(y1)}" fill="none" stroke="currentColor" stroke-width="${stroke}"/>`;
  const leafD = leafPath(leafLen, leafW);
  const parts: string[] = [];
  for (let i = 0; i < leaves; i++) {
    const a = from + 6 + ((to - from - 10) * i) / Math.max(1, leaves - 1);
    const [x, y] = pt(a);
    const tangent = a + 90; // the direction the branch grows (clockwise in SVG = up the left side)
    // a pair: one leaf leaning outwards, one inwards, the inner one a little smaller
    parts.push(`<path d="${leafD}" transform="translate(${f(x)} ${f(y)}) rotate(${f(tangent - 32)})"/>`);
    parts.push(`<path d="${leafD}" transform="translate(${f(x)} ${f(y)}) rotate(${f(tangent + 30)}) scale(.82)"/>`);
  }
  // a single leaf at the tip
  const [tx, ty] = pt(to);
  parts.push(`<path d="${leafD}" transform="translate(${f(tx)} ${f(ty)}) rotate(${f(to + 90)})"/>`);
  const branch = `${stem}<g fill="currentColor">${parts.join('')}</g>`;
  return `<g class="wreath-l">${branch}</g><g class="wreath-r" transform="matrix(-1 0 0 1 ${f(2 * cx)} 0)">${branch}</g>`;
}

/**
 * A straight laurel sprig as a standalone SVG document (for CSS backgrounds: dividers, the flanks of a grade).
 * Points right; mirror it in CSS (scaleX(-1)) for the left side.
 */
export function sprigSvg(color = '#c9a45c', opacity = 0.75): string {
  const leafD = leafPath(5.2, 1.5);
  const leaves: string[] = [];
  const n = 5;
  for (let i = 0; i < n; i++) {
    const x = 3 + i * 4.6;
    const y = 6 + Math.sin((x / 26) * Math.PI) * -0.8; // a slight arch
    leaves.push(`<path d="${leafD}" transform="translate(${f(x)} ${f(y)}) rotate(-34)"/>`);
    leaves.push(`<path d="${leafD}" transform="translate(${f(x + 1.4)} ${f(y)}) rotate(34) scale(.86)"/>`);
  }
  leaves.push(`<path d="${leafD}" transform="translate(25.5 5.6) rotate(-4)"/>`);
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="12" viewBox="0 0 32 12">` +
    `<path d="M1 6.2Q14 4.8 27 5.6" fill="none" stroke="${color}" stroke-opacity="${opacity}" stroke-width=".5"/>` +
    `<g fill="${color}" fill-opacity="${opacity}">${leaves.join('')}</g></svg>`
  );
}

/** A string as a CSS url() data URI. */
export const cssUrl = (svg: string) => `url("data:image/svg+xml,${encodeURIComponent(svg).replace(/'/g, '%27')}")`;

/**
 * Words of a short label, for inscription lettering with interpuncts ("WHAT · WE · GRADE"), the way words were
 * separated on Roman monuments; commas and full stops give way to the dots ("Venice, Florida" -> VENICE · FLORIDA).
 * Long labels (more than five words) stay as one run of text, as written.
 */
export function inscriptionWords(text: string): string[] {
  const raw = text.trim().split(/\s+/).filter(Boolean);
  if (raw.length > 5) return [raw.join(' ')];
  return raw.map((w) => w.replace(/[,.;:]+$/, '')).filter(Boolean);
}

/** Initials of the company name for the seal ("Provident Numismatic Authentication" -> "PNA"). */
export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter((w) => /^[A-Za-z]/.test(w))
    .map((w) => w[0].toUpperCase())
    .join('');
}
