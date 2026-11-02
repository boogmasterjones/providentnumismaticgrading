/**
 * Population report: how many certificates exist for each coin type at each grade. Computed on the server from the
 * certificate database's full list (when it can provide one): see loadPopulation() in certs/verify.ts.
 */

export interface PopulationInput {
  year?: string | null;
  countryDenomination: string;
  grade: string;
  demo?: boolean;
}

export interface PopulationRow {
  coinType: string;
  counts: Record<string, number>;
  total: number;
}

export interface PopulationReport {
  /** Every grade that appears, best first. */
  grades: string[];
  rows: PopulationRow[];
  total: number;
  demoCount: number;
}

const clean = (s: string | null | undefined) => (s ?? '').replace(/\s+/g, ' ').trim();

/** Coin type = country/denomination plus year, e.g. "United States, Morgan dollar — 1921". */
export function coinTypeOf(c: PopulationInput): string {
  const type = clean(c.countryDenomination) || 'Unspecified';
  const year = clean(c.year);
  return year ? `${type} — ${year}` : type;
}

/** "MS 65" and "ms65" count as the same grade. */
export function normalizeGrade(grade: string): string {
  const g = clean(grade).toUpperCase();
  const m = g.match(/^([A-Z][A-Z\- ]*?)\s*(\d+(?:\.\d+)?)(\+?)(.*)$/);
  if (m) return `${m[1].trim()} ${m[2]}${m[3]}${m[4] ? ' ' + m[4].trim() : ''}`.trim();
  return g || 'Ungraded';
}

/** Highest number first; grades without a number sort after, alphabetically. "+" grades sit above the plain grade. */
export function compareGrades(a: string, b: string): number {
  const num = (g: string) => {
    const m = g.match(/(\d+(?:\.\d+)?)(\+?)/);
    return m ? parseFloat(m[1]) + (m[2] ? 0.5 : 0) : null;
  };
  const na = num(a);
  const nb = num(b);
  if (na !== null && nb !== null && na !== nb) return nb - na;
  if (na !== null && nb === null) return -1;
  if (na === null && nb !== null) return 1;
  return a.localeCompare(b);
}

export function computePopulation(certs: PopulationInput[]): PopulationReport {
  const byType = new Map<string, Record<string, number>>();
  const grades = new Set<string>();
  let demoCount = 0;
  for (const c of certs) {
    if (c.demo) demoCount++;
    const type = coinTypeOf(c);
    const grade = normalizeGrade(c.grade);
    grades.add(grade);
    const counts = byType.get(type) ?? {};
    counts[grade] = (counts[grade] ?? 0) + 1;
    byType.set(type, counts);
  }
  const rows: PopulationRow[] = [...byType.entries()]
    .map(([coinType, counts]) => ({
      coinType,
      counts,
      total: Object.values(counts).reduce((a, b) => a + b, 0),
    }))
    .sort((a, b) => a.coinType.localeCompare(b.coinType));
  return {
    grades: [...grades].sort(compareGrades),
    rows,
    total: certs.length,
    demoCount,
  };
}
