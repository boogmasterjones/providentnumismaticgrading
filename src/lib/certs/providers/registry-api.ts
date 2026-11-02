/**
 * Alex's certificate database: THE ONLY PROVIDER-SPECIFIC FILE.
 *
 * We don't know yet which software or service Alex keeps his certificates in. Until we do, this file assumes a
 * plain JSON web API, which is the most common shape:
 *
 *   GET  {CERT_API_URL}/certificates/{certNumber}
 *   Header  Authorization: Bearer {CERT_API_KEY}      (a READ-ONLY key)
 *   200  one certificate as JSON (bare, or wrapped in "data" / "certificate" / "record" / "fields")
 *   404  no such certificate
 *
 * TODO(once Alex tells us the system): replace the address, the login header and mapRecord() below with that
 * system's real ones (its API docs), and implement listAll() if it can list every certificate (population report).
 * Nothing else in the site needs to change: the rest only sees the CertAdapter interface and the Certificate shape.
 *
 * Rules this file must keep: the key is only ever sent in the request to Alex's database; it never goes into a
 * URL that could be logged, an error message, or a reply to the browser.
 */
import { CertAdapterError, type CertAdapter } from '../adapter';
import type { CertificateInput } from '../certificate';

export interface RegistryApiOptions {
  baseUrl: string;
  apiKey: string;
  fetch: typeof fetch;
  timeoutMs?: number;
}

type Rec = Record<string, unknown>;
const isObj = (v: unknown): v is Rec => !!v && typeof v === 'object' && !Array.isArray(v);

/** First field present under any of the given names (databases spell the same thing many ways). */
function pick(r: Rec, ...names: string[]): unknown {
  const lower = new Map(Object.keys(r).map((k) => [k.toLowerCase().replace(/[\s_-]/g, ''), k]));
  for (const n of names) {
    const k = lower.get(n.toLowerCase().replace(/[\s_-]/g, ''));
    if (k !== undefined && r[k] != null && r[k] !== '') return r[k];
  }
  return undefined;
}

const asText = (v: unknown): string | undefined =>
  typeof v === 'string' ? v : typeof v === 'number' && Number.isFinite(v) ? String(v) : undefined;

/** A photo field may be a plain link or an attachment list like [{ url: "https://…" }]. */
function asPhoto(v: unknown): string | undefined {
  if (typeof v === 'string') return v;
  if (Array.isArray(v)) return asPhoto(v[0]);
  if (isObj(v)) return asText(pick(v, 'url', 'href', 'src'));
  return undefined;
}

/** Unwrap common envelopes: { data: {...} }, { certificate: {...} }, { records: [{ fields: {...} }] }. */
function unwrap(body: unknown): Rec | null {
  let v: unknown = body;
  for (let i = 0; i < 3; i++) {
    if (Array.isArray(v)) v = v[0];
    else if (isObj(v)) {
      const inner = pick(v, 'data', 'certificate', 'record', 'records', 'fields', 'result', 'items');
      if (inner !== undefined && (isObj(inner) || Array.isArray(inner))) v = inner;
      else break;
    }
  }
  return isObj(v) ? v : null;
}

/** Turn the database's field names into ours. The result is validated by CertificateSchema afterwards. */
export function mapRecord(body: unknown): CertificateInput | null {
  const r = unwrap(body);
  if (!r) return null;
  const certNumber = asText(pick(r, 'certNumber', 'certificateNumber', 'cert', 'certNo', 'serial', 'number'));
  const coinDescription = asText(pick(r, 'coinDescription', 'description', 'coin', 'name', 'title'));
  const grade = asText(pick(r, 'grade', 'finalGrade'));
  if (!certNumber || !coinDescription || !grade) return null;
  return {
    certNumber,
    coinDescription,
    grade,
    year: asText(pick(r, 'year', 'date', 'dateOfIssue')),
    countryDenomination: asText(pick(r, 'countryDenomination', 'denomination', 'country', 'type')),
    strikeScore: asText(pick(r, 'strikeScore', 'strike')),
    surfaceScore: asText(pick(r, 'surfaceScore', 'surface')),
    notes: asText(pick(r, 'notes', 'comments', 'remarks')),
    obverseUrl: asPhoto(pick(r, 'obverseUrl', 'obverse', 'obverseImage', 'obversePhoto', 'front', 'frontImage')),
    reverseUrl: asPhoto(pick(r, 'reverseUrl', 'reverse', 'reverseImage', 'reversePhoto', 'back', 'backImage')),
    dateGraded: asText(pick(r, 'dateGraded', 'gradedOn', 'gradedDate', 'gradedAt', 'createdAt')),
  };
}

export function createRegistryApiAdapter(opts: RegistryApiOptions): CertAdapter {
  const base = opts.baseUrl.replace(/\/+$/, '');
  return {
    id: 'registry-api',
    mode: 'live',
    async getCertificate(certNumber) {
      if (!opts.apiKey) throw new CertAdapterError('auth', 'CERT_API_KEY is not set.');
      const url = `${base}/certificates/${encodeURIComponent(certNumber)}`;
      let res: Response;
      try {
        res = await opts.fetch(url, {
          headers: { Accept: 'application/json', Authorization: `Bearer ${opts.apiKey}` },
          signal: AbortSignal.timeout(opts.timeoutMs ?? 8000),
        });
      } catch (e) {
        const name = (e as { name?: string })?.name;
        throw new CertAdapterError(
          name === 'TimeoutError' || name === 'AbortError' ? 'timeout' : 'upstream',
          'Certificate database did not answer.',
        );
      }
      if (res.status === 404) return null;
      if (res.status === 401 || res.status === 403) throw new CertAdapterError('auth', `Refused (${res.status}).`);
      if (res.status === 429) throw new CertAdapterError('busy', 'Rate limited by the certificate database.');
      if (!res.ok) throw new CertAdapterError('upstream', `HTTP ${res.status}.`);
      let body: unknown;
      try {
        body = await res.json();
      } catch {
        throw new CertAdapterError('upstream', 'Reply was not JSON.');
      }
      // An empty answer means "no such certificate"; a record we can't read is an error, never "not found".
      if (body == null || (Array.isArray(body) && body.length === 0) || unwrap(body) === null) return null;
      const mapped = mapRecord(body);
      if (!mapped) throw new CertAdapterError('upstream', 'Record is missing the number, description or grade.');
      return mapped;
    },
    // listAll: not implemented until we know whether Alex's database can list every certificate (see README).
  };
}
