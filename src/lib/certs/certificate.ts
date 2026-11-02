/**
 * The certificate shape the website shows. Whatever Alex's certificate database sends is turned into this shape by
 * the adapter (src/lib/certs/providers/registry-api.ts) and then checked against CertificateSchema here, so a
 * surprise from the database can never put odd data on the page.
 */
import { z } from 'astro/zod';

const text = (max: number) => z.string().trim().min(1).max(max);
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((v) => (v ? v : undefined));
/** Photos must be https links (no http, data: or javascript: addresses). */
const photoUrl = z
  .string()
  .trim()
  .max(2000)
  .nullish()
  .transform((v) => (v && /^https:\/\/[^\s"'<>]+$/i.test(v) ? v : undefined));

export const CertificateSchema = z.object({
  certNumber: text(64),
  coinDescription: text(300),
  year: optionalText(60),
  countryDenomination: optionalText(200),
  grade: text(60),
  strikeScore: optionalText(30),
  surfaceScore: optionalText(30),
  notes: optionalText(2000),
  obverseUrl: photoUrl,
  reverseUrl: photoUrl,
  /** As sent by the database, e.g. 2026-11-01. */
  dateGraded: optionalText(40),
  /** True only for the made-up DEMO records of the mock adapter. */
  demo: z.boolean().optional(),
});

export type Certificate = z.output<typeof CertificateSchema>;
/** What an adapter hands over before validation (photo/optional fields may be null or missing). */
export type CertificateInput = z.input<typeof CertificateSchema>;

/** Validate one record. Returns null when it doesn't have what we need to show it. */
export function parseCertificate(raw: unknown): Certificate | null {
  const r = CertificateSchema.safeParse(raw);
  return r.success ? r.data : null;
}

/**
 * Normalise what a visitor types (or what is stored) so small differences don't matter:
 * case, spaces, and a leading "Cert", "#" or "No." are ignored. Letters, digits and dashes are kept.
 */
export function normalizeCertNumber(raw: string): string {
  return raw
    .trim()
    .toUpperCase()
    .replace(/^CERT(IFICATE)?(\s*(NO\.|#)\s*|\s+)/, '')
    .replace(/^(NO\.|#)\s*/, '')
    .replace(/[^A-Z0-9-]/g, '');
}

/** A certificate number we are willing to send to the database: 1–32 letters, digits or dashes. */
export function isPlausibleCertNumber(normalized: string): boolean {
  return /^[A-Z0-9][A-Z0-9-]{0,31}$/.test(normalized);
}
