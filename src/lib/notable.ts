/**
 * Notable coins (Keystatic collection "Notable coins", one JSON file per coin in content/notable/).
 * Read at build time. Nothing here is ever invented: with no entries the home page shows marked placeholders.
 */
export interface NotableCoin {
  slug: string;
  name: string;
  obverse: string;
  reverse?: string | null;
  grade: string;
  cert: string;
  note?: string | null;
  order: number;
}

const files = import.meta.glob<{ default: Partial<NotableCoin> }>('../../content/notable/*.json', { eager: true });

/** Entries that have everything a showcase card needs, in the editor's order (then by name). */
export function notableCoins(): NotableCoin[] {
  return parseNotable(Object.entries(files).map(([path, mod]) => [path, mod.default] as const));
}

export function parseNotable(entries: readonly (readonly [string, Partial<NotableCoin>])[]): NotableCoin[] {
  return entries
    .map(([path, d]) => ({
      slug: path.split('/').pop()!.replace(/\.json$/, ''),
      name: String(d.name ?? '').trim(),
      obverse: String(d.obverse ?? '').trim(),
      reverse: d.reverse ? String(d.reverse) : null,
      grade: String(d.grade ?? '').trim(),
      cert: String(d.cert ?? '').trim(),
      note: d.note ? String(d.note).trim() : null,
      order: Number.isFinite(Number(d.order)) ? Number(d.order) : 10,
    }))
    .filter((c) => c.name && c.obverse && c.grade && c.cert)
    .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
}

/** The Verify page address for a certificate number. */
export const verifyHref = (cert: string) => `/verify?cert=${encodeURIComponent(cert)}`;

/** A long grade ("Ch XF, Strike 5/5, Surface 4/5") squeezed between the sprigs stacked into five lines: the grade
 * proper stays large between the sprigs, and what follows the first comma (subgrades, designations) sits on a
 * small line of its own under it. A long grade without a comma is set smaller instead. */
export function splitGrade(g: string): { main: string; sub: string; long: boolean } {
  const i = g.indexOf(',');
  const main = (i > 0 ? g.slice(0, i) : g).trim();
  const sub = i > 0 ? g.slice(i + 1).split(',').map((s) => s.trim()).filter(Boolean).join(' · ') : '';
  return { main, sub, long: main.length > 9 };
}
