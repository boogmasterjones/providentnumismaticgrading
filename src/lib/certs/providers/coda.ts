/**
 * The owner's certificate database: a table in a Coda doc (coda.io, now also branded "Superhuman Docs").
 * THE ONLY PROVIDER-SPECIFIC FILE. Setup steps for the owner: docs/CODA_SETUP.md.
 *
 * API used (Coda API v1, https://coda.io/developers/apis/v1):
 *   GET {base}/docs/{docId}/tables/{table}/rows?query="Cert #":"12345"&useColumnNames=true&valueFormat=simpleWithArrays
 *   GET {base}/docs/{docId}/tables/{table}/rows?limit=500&pageToken=…   (population report, every row)
 *   Header  Authorization: Bearer {CODA_API_TOKEN}
 *
 * Facts from Coda's docs that shape this file:
 * - A token can be restricted to one doc (or one table) and to read access (GET only). We ask for exactly that.
 * - `query` is an exact match on one column, written `"Column name":<JSON value>`; a text value is quoted, a number
 *   is not. We try the quoted text first and, for an all-digit number, the bare number too (Number columns).
 * - A 404 from Coda means the DOC or TABLE wasn't found (a setup mistake), never "no such certificate": no matching
 *   row is a 200 with an empty list.
 * - Reads come from a snapshot that can lag edits by a few seconds. Fine for us (our own cache is minutes anyway).
 * - Rate limit: reading is 100 requests per 6 seconds per user; over it Coda answers 429. We retry briefly
 *   (honouring Retry-After when sent) and otherwise report "busy".
 * - Page size: Coda caps it and may change the cap, so we follow nextPageToken until it is absent.
 * - Image / attachment columns: with valueFormat=simpleWithArrays an image cell is a URL string (or a list of them;
 *   uploaded images live on codahosted.io). Rich objects ({ "@type": "ImageObject", url, status }) are handled too.
 *   Coda does not document whether codahosted.io links are public or permanent: test one in a private window
 *   before launch (docs/CODA_SETUP.md). Only https links ever reach the page (CertificateSchema).
 *
 * Rules this file keeps: the token is only ever sent in the Authorization header to the Coda API host; it never goes
 * into a URL, an error message, a log line or a reply. Logs carry status codes and setup hints only, never Coda's
 * reply body.
 */
import { CertAdapterError, type CertAdapter } from '../adapter';
import { normalizeCertNumber, type CertificateInput } from '../certificate';

// ---------------------------------------------------------------- configuration

/** Our certificate fields that can be read from a Coda column. */
export const CODA_FIELDS = [
  'certNumber',
  'coinDescription',
  'year',
  'countryDenomination',
  'grade',
  'strikeScore',
  'surfaceScore',
  'notes',
  'obverseUrl',
  'reverseUrl',
  'dateGraded',
] as const;
export type CodaField = (typeof CODA_FIELDS)[number];

/**
 * Which Coda column(s) feed each of our fields. A list of columns is joined with spaces for text (e.g. the
 * description built from "Year", "Denomination" and "Variety") and searched in order for photos.
 * If obverse and reverse name the same column (one "Photos" cell holding both), the 1st image is the obverse and
 * the 2nd the reverse.
 */
export type CodaColumnMap = Partial<Record<CodaField, string | string[]>> & { certNumber: string };

/** Used for any field CODA_COLUMN_MAP leaves out. Column names are matched exactly as written in Coda. */
export const DEFAULT_CODA_COLUMN_MAP: CodaColumnMap = {
  certNumber: 'Cert #',
  coinDescription: 'Coin',
  year: 'Year',
  countryDenomination: 'Country/Denomination',
  grade: 'Grade',
  strikeScore: 'Strike',
  surfaceScore: 'Surface',
  notes: 'Notes',
  obverseUrl: 'Obverse',
  reverseUrl: 'Reverse',
  dateGraded: 'Date Graded',
};

/** Coda's documented API address. The OpenAPI file also lists docs.superhuman.com (the rebrand); both answer. */
export const CODA_DEFAULT_API_BASE = 'https://coda.io/apis/v1';
/** The token may only ever be sent to these hosts, whatever CODA_API_BASE says. */
const CODA_API_HOSTS = new Set(['coda.io', 'docs.superhuman.com']);

export interface CodaEnv {
  CODA_DOC_ID?: string;
  CODA_TABLE_ID?: string;
  CODA_API_TOKEN?: string;
  CODA_COLUMN_MAP?: string;
  CODA_API_BASE?: string;
}

export interface CodaConfig {
  docId: string;
  table: string;
  token: string;
  columns: CodaColumnMap;
  apiBase: string;
}

/** Thrown for a setup mistake (bad doc id, column map, API address). The message never contains the token. */
export class CodaConfigError extends Error {}

/**
 * Accepts a bare doc id ("AbCDeFGH") or a doc's browser link ("https://coda.io/d/Certificates_dAbCDeFGH/Page_su…"):
 * the id is what follows the last "_d" in the /d/ part of the link.
 */
export function extractCodaDocId(raw: string): string {
  const v = raw.trim();
  const m = /\/d\/(?:[^/?#]*_d)?([A-Za-z0-9_-]+?)(?:[/?#]|$)/.exec(v);
  const id = m ? m[1] : v;
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(id)) throw new CodaConfigError('CODA_DOC_ID is not a doc id or doc link.');
  return id;
}

/** Parse CODA_COLUMN_MAP (JSON) on top of the defaults. Unknown keys are refused so typos show up at once. */
export function parseCodaColumnMap(raw: string | undefined): CodaColumnMap {
  if (!raw || !raw.trim()) return { ...DEFAULT_CODA_COLUMN_MAP };
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new CodaConfigError('CODA_COLUMN_MAP is not valid JSON.');
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new CodaConfigError('CODA_COLUMN_MAP must be a JSON object like {"certNumber":"Cert #"}.');
  }
  const out: Record<string, string | string[]> = { ...DEFAULT_CODA_COLUMN_MAP };
  for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
    if (!(CODA_FIELDS as readonly string[]).includes(k)) {
      throw new CodaConfigError(`CODA_COLUMN_MAP has an unknown field "${k}". Known: ${CODA_FIELDS.join(', ')}.`);
    }
    const ok = (s: unknown): s is string => typeof s === 'string' && s.trim().length > 0 && s.length <= 200;
    if (v === null || v === '') delete out[k];
    else if (ok(v)) out[k] = v.trim();
    else if (Array.isArray(v) && v.length > 0 && v.every(ok)) out[k] = v.map((s) => s.trim());
    else throw new CodaConfigError(`CODA_COLUMN_MAP field "${k}" must be a column name or a list of column names.`);
  }
  if (typeof out.certNumber !== 'string') throw new CodaConfigError('CODA_COLUMN_MAP needs one column for certNumber.');
  return out as CodaColumnMap;
}

function parseApiBase(raw: string | undefined): string {
  const v = (raw?.trim() || CODA_DEFAULT_API_BASE).replace(/\/+$/, '');
  let u: URL;
  try {
    u = new URL(v);
  } catch {
    throw new CodaConfigError('CODA_API_BASE is not a web address.');
  }
  if (u.protocol !== 'https:' || !CODA_API_HOSTS.has(u.hostname)) {
    throw new CodaConfigError('CODA_API_BASE must be https://coda.io/apis/v1 or https://docs.superhuman.com/apis/v1.');
  }
  return v;
}

/** True when any CODA_* setting is present: the site then uses Coda (and fails safely if a setting is missing). */
export function isCodaConfigured(env: CodaEnv): boolean {
  return !!(env.CODA_DOC_ID?.trim() || env.CODA_TABLE_ID?.trim() || env.CODA_API_TOKEN?.trim());
}

/** Read the settings. Missing token/doc/table are reported later, per request, as an "auth"/"upstream" error. */
export function readCodaConfig(env: CodaEnv): CodaConfig {
  return {
    docId: env.CODA_DOC_ID?.trim() ? extractCodaDocId(env.CODA_DOC_ID) : '',
    table: env.CODA_TABLE_ID?.trim() ?? '',
    token: env.CODA_API_TOKEN?.trim() ?? '',
    columns: parseCodaColumnMap(env.CODA_COLUMN_MAP),
    apiBase: parseApiBase(env.CODA_API_BASE),
  };
}

// ---------------------------------------------------------------- reading cell values

type Rec = Record<string, unknown>;
const isObj = (v: unknown): v is Rec => !!v && typeof v === 'object' && !Array.isArray(v);

/** Coda's rich format wraps plain text in ``` fences; take them off if a rich value ever reaches us. */
const unfence = (s: string) => s.replace(/^```([\s\S]*)```$/, '$1');

/** A cell as text: strings, numbers, lists (joined with ", "), lookups/people (their name), currency (amount). */
export function cellText(v: unknown): string | undefined {
  if (v == null) return undefined;
  if (typeof v === 'string') return unfence(v).trim() || undefined;
  if (typeof v === 'number') return Number.isFinite(v) ? String(v) : undefined;
  if (typeof v === 'boolean') return undefined;
  if (Array.isArray(v)) {
    const parts = v.map(cellText).filter((s): s is string => !!s);
    return parts.length ? parts.join(', ') : undefined;
  }
  if (isObj(v)) return cellText(v.name ?? v.amount);
  return undefined;
}

/** Every https image link in a cell: URL strings (one, several or a list) or ImageObjects that aren't deleted. */
export function cellPhotos(v: unknown): string[] {
  if (v == null) return [];
  if (typeof v === 'string') {
    return unfence(v)
      .split(/[\s,]+/)
      .map((s) => s.trim())
      .filter((s) => /^https:\/\/[^\s"'<>]+$/i.test(s));
  }
  if (Array.isArray(v)) return v.flatMap(cellPhotos);
  if (isObj(v)) {
    if (v.status === 'deleted' || v.status === 'failed') return [];
    return cellPhotos(v.url);
  }
  return [];
}

/** A Date column comes back as an ISO timestamp in the doc's time zone; show the calendar date only. */
function dateText(v: unknown): string | undefined {
  const t = cellText(v);
  const m = t && /^(\d{4}-\d{2}-\d{2})T[\d:.]+(Z|[+-]\d{2}:?\d{2})?$/.exec(t);
  return m ? m[1] : t;
}

const colsOf = (c: string | string[] | undefined) => (c === undefined ? [] : Array.isArray(c) ? c : [c]);

function textFrom(values: Rec, cols: string | string[] | undefined, read = cellText): string | undefined {
  const parts = colsOf(cols)
    .map((c) => read(values[c]))
    .filter((s): s is string => !!s);
  return parts.length ? parts.join(' ') : undefined;
}

/** Turn one Coda row's values (keyed by column name) into our certificate shape. Validation happens afterwards. */
export function mapCodaRow(values: Rec, columns: CodaColumnMap): CertificateInput | null {
  const certNumber = cellText(values[columns.certNumber]);
  const coinDescription = textFrom(values, columns.coinDescription);
  const grade = textFrom(values, columns.grade);
  if (!certNumber || !coinDescription || !grade) return null;

  const obvCols = colsOf(columns.obverseUrl);
  const revCols = colsOf(columns.reverseUrl);
  const firstPhoto = (cols: string[], index = 0) => {
    for (const c of cols) {
      const p = cellPhotos(values[c])[index];
      if (p) return p;
    }
    return undefined;
  };
  const sharedPhotoColumn = obvCols.length > 0 && obvCols.join('\n') === revCols.join('\n');

  return {
    certNumber,
    coinDescription,
    grade,
    year: textFrom(values, columns.year),
    countryDenomination: textFrom(values, columns.countryDenomination),
    strikeScore: textFrom(values, columns.strikeScore),
    surfaceScore: textFrom(values, columns.surfaceScore),
    notes: textFrom(values, columns.notes),
    obverseUrl: firstPhoto(obvCols),
    reverseUrl: sharedPhotoColumn ? firstPhoto(revCols, 1) : firstPhoto(revCols),
    dateGraded: textFrom(values, columns.dateGraded, dateText),
  };
}

// ---------------------------------------------------------------- HTTP

interface CodaRow {
  values: Rec;
  updatedAt?: string;
}

export interface CodaAdapterOptions {
  config: CodaConfig;
  fetch: typeof fetch;
  /** Setup hints and duplicate warnings. Never receives the token or Coda's reply body. */
  log?: (msg: string) => void;
  /** Injected in tests. */
  sleep?: (ms: number) => Promise<void>;
  timeoutMs?: number;
  /** Rows per page asked for; Coda may return fewer. */
  pageSize?: number;
  /** Safety stop for the population scan. */
  maxPages?: number;
}

/** How long to wait after a 429: Retry-After (seconds or an HTTP date) when sent, else an exponential step. */
export function retryDelayMs(res: Response, attempt: number, now = Date.now()): number {
  const h = res.headers.get('Retry-After');
  if (h) {
    const secs = Number(h);
    if (Number.isFinite(secs) && secs >= 0) return secs * 1000;
    const at = Date.parse(h);
    if (Number.isFinite(at)) return Math.max(0, at - now);
  }
  return 1000 * 2 ** attempt;
}

/** Short FNV-1a hash, so the cache key changes when the doc, table or column map changes. */
function shortHash(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193);
  return (h >>> 0).toString(36);
}

export function createCodaAdapter(opts: CodaAdapterOptions): CertAdapter {
  const { config } = opts;
  const log = opts.log ?? (() => {});
  const sleep = opts.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const rowsUrl = `${config.apiBase}/docs/${encodeURIComponent(config.docId)}/tables/${encodeURIComponent(config.table)}/rows`;

  function checkSetup() {
    if (!config.token) throw new CertAdapterError('auth', 'CODA_API_TOKEN is not set.');
    if (!config.docId || !config.table) throw new CertAdapterError('upstream', 'CODA_DOC_ID or CODA_TABLE_ID is not set.');
  }

  /**
   * One GET to Coda. 429 is retried while the total wait stays within budgetMs; 5xx is retried `serverRetries` times.
   * Every failure becomes a CertAdapterError whose message holds a status code and a hint, never the reply body.
   */
  async function get(params: URLSearchParams, budgetMs: number, serverRetries: number): Promise<Rec> {
    const url = `${rowsUrl}?${params.toString()}`;
    let waited = 0;
    for (let attempt = 0; ; attempt++) {
      let res: Response;
      try {
        res = await opts.fetch(url, {
          headers: { Accept: 'application/json', Authorization: `Bearer ${config.token}` },
          signal: AbortSignal.timeout(opts.timeoutMs ?? 8000),
        });
      } catch (e) {
        const name = (e as { name?: string })?.name;
        throw new CertAdapterError(
          name === 'TimeoutError' || name === 'AbortError' ? 'timeout' : 'upstream',
          'Coda did not answer.',
        );
      }
      if (res.status === 429) {
        const wait = retryDelayMs(res, attempt);
        if (waited + wait > budgetMs) {
          log('coda: rate limited (429), giving up for now');
          throw new CertAdapterError('busy', 'Rate limited by Coda.');
        }
        waited += wait;
        await sleep(wait);
        continue;
      }
      if (res.status >= 500 && attempt < serverRetries) {
        await sleep(1000 * 2 ** attempt);
        continue;
      }
      if (res.status === 401) {
        log('coda: token refused (401): the token is wrong, expired or deleted; create a new one (docs/CODA_SETUP.md)');
        throw new CertAdapterError('auth', 'Refused (401).');
      }
      if (res.status === 403) {
        log('coda: no access (403): the token is not allowed to read this doc/table');
        throw new CertAdapterError('auth', 'Refused (403).');
      }
      if (res.status === 404) {
        log('coda: doc or table not found (404): check CODA_DOC_ID and CODA_TABLE_ID');
        throw new CertAdapterError('upstream', 'Doc or table not found (404).');
      }
      if (res.status === 400) {
        log('coda: request refused (400): check the column names in CODA_COLUMN_MAP');
        throw new CertAdapterError('upstream', 'Bad request (400).');
      }
      if (!res.ok) {
        log(`coda: HTTP ${res.status}`);
        throw new CertAdapterError('upstream', `HTTP ${res.status}.`);
      }
      let body: unknown;
      try {
        body = await res.json();
      } catch {
        throw new CertAdapterError('upstream', 'Reply was not JSON.');
      }
      if (!isObj(body) || !Array.isArray(body.items)) throw new CertAdapterError('upstream', 'Reply had no rows list.');
      return body;
    }
  }

  const baseParams = () => new URLSearchParams({ useColumnNames: 'true', valueFormat: 'simpleWithArrays' });
  const toRows = (items: unknown[]): CodaRow[] =>
    items.filter(isObj).flatMap((r) => (isObj(r.values) ? [{ values: r.values, updatedAt: typeof r.updatedAt === 'string' ? r.updatedAt : undefined }] : []));

  async function queryRows(value: string | number): Promise<CodaRow[]> {
    const p = baseParams();
    p.set('query', `${JSON.stringify(config.columns.certNumber)}:${JSON.stringify(value)}`);
    p.set('limit', '10');
    // A visitor is waiting: allow at most ~3 s of rate-limit waiting and one 5xx retry.
    return toRows((await get(p, 3000, 1)).items as unknown[]);
  }

  let inFlight: Promise<CertificateInput[]> | null = null;

  async function scanAll(): Promise<CertificateInput[]> {
    const out: CertificateInput[] = [];
    let skipped = 0;
    let pageToken: string | undefined;
    const maxPages = opts.maxPages ?? 200;
    for (let page = 0; page < maxPages; page++) {
      // Coda ignores other parameters alongside pageToken, so the next page carries only the token.
      const p = pageToken ? new URLSearchParams({ pageToken }) : baseParams();
      if (!pageToken) p.set('limit', String(opts.pageSize ?? 500));
      const body = await get(p, 20_000, 2);
      for (const row of toRows(body.items as unknown[])) {
        const c = mapCodaRow(row.values, config.columns);
        if (c) out.push(c);
        else skipped++;
      }
      pageToken = typeof body.nextPageToken === 'string' && body.nextPageToken ? body.nextPageToken : undefined;
      if (!pageToken) {
        if (skipped) log(`coda: population skipped ${skipped} row(s) without a number, coin or grade`);
        return out;
      }
    }
    log(`coda: population stopped after ${maxPages} pages`);
    throw new CertAdapterError('upstream', 'Too many pages.');
  }

  return {
    id: `coda-${shortHash([config.apiBase, config.docId, config.table, JSON.stringify(config.columns)].join('|'))}`,
    mode: 'live',

    async getCertificate(certNumber) {
      checkSetup();
      let rows = await queryRows(certNumber);
      // A Number column only matches a bare JSON number, so try that too for all-digit numbers.
      if (rows.length === 0 && /^[1-9]\d{0,14}$/.test(certNumber)) rows = await queryRows(Number(certNumber));

      const matches = rows.filter((r) => normalizeCertNumber(cellText(r.values[config.columns.certNumber]) ?? '') === certNumber);
      if (matches.length === 0) return null;
      if (matches.length > 1) {
        log(`coda: ${matches.length} rows share certificate number ${certNumber}; showing the most recently updated one`);
        matches.sort((a, b) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? ''));
      }
      const mapped = mapCodaRow(matches[0].values, config.columns);
      if (!mapped) {
        log(`coda: certificate ${certNumber} is missing the coin or grade column value (check CODA_COLUMN_MAP)`);
        throw new CertAdapterError('upstream', 'Row is missing the number, description or grade.');
      }
      return mapped;
    },

    /** Every row, page by page. The caller (loadPopulation) caches the report for an hour in Netlify Blobs. */
    async listAll() {
      checkSetup();
      // Visitors arriving together while the cache is cold share one scan in this running copy.
      inFlight ??= scanAll().finally(() => {
        inFlight = null;
      });
      return inFlight;
    },
  };
}
