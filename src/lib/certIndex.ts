/**
 * Certificate lookup index. Built once at build time from the certificate records and published as
 * /verify/certificates.json; the Verify page loads it in the browser and looks the typed number up. No database.
 */

export interface CertIndexInput {
  /** Entry id = file name in content/certificates (also the URL slug). */
  id: string;
  certNumber: string;
  sample?: boolean;
}

export interface CertIndexEntry {
  /** Certificate number as printed. */
  n: string;
  /** Page address. */
  u: string;
  /** Sample record. */
  s?: true;
}

export interface CertIndex {
  version: 1;
  count: number;
  certs: Record<string, CertIndexEntry>;
}

/**
 * Normalise what a visitor types (or what is stored) so small differences don't matter:
 * case, spaces, and a leading "#" or "No." are ignored. Letters, digits and dashes are kept.
 */
export function normalizeCertNumber(raw: string): string {
  return raw
    .trim()
    .toUpperCase()
    .replace(/^(CERT(IFICATE)?\s*)?(NO\.?|#)\s*/, '')
    .replace(/[^A-Z0-9-]/g, '');
}

export function certPath(id: string): string {
  return `/verify/${encodeURIComponent(id)}/`;
}

export function buildCertIndex(certs: CertIndexInput[]): CertIndex {
  const out: Record<string, CertIndexEntry> = {};
  for (const c of certs) {
    const key = normalizeCertNumber(c.certNumber);
    if (!key) continue;
    if (out[key]) {
      throw new Error(`Duplicate certificate number "${c.certNumber}" (files ${out[key].u} and ${c.id}).`);
    }
    out[key] = { n: c.certNumber, u: certPath(c.id), ...(c.sample ? { s: true as const } : {}) };
  }
  return { version: 1, count: Object.keys(out).length, certs: out };
}

export function lookupCert(index: CertIndex, typed: string): CertIndexEntry | null {
  const key = normalizeCertNumber(typed);
  if (!key) return null;
  return index.certs[key] ?? null;
}
