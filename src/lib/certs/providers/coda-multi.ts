/**
 * The owner's real layout in Coda: one doc per series, one table per batch.
 *
 *   certificate number  A400107-133   =  prefix "A"  +  batch "400107"  +  "-"  +  line "133"
 *   prefix → doc        CODA_DOCS, e.g. {"A":"<Roman doc>","U":"<US doc>","W":"<World doc>","M":"<Medals doc>"}
 *   batch  → table      the table named exactly "A400107" in that doc (looked up by name; the list is cached ~1 h)
 *   row                 the row whose "Invoice Num1" is the certificate number
 *
 * PRIVACY (strict). The owner's tables also hold purchase and sale prices ("Pur Price", "+ 20%", "Sell Price"),
 * private notes ("Notes": e.g. where a coin was bought) and source links ("Link", "Image URL", "2nd Link", "Web
 * Link": auction lots). Coda's API cannot leave columns out, so every row is cut down to PUBLIC_COLUMNS the moment
 * the reply is parsed (pickPublic). Nothing else is ever mapped, cached, logged or returned. Logs carry status codes,
 * batch names and counts only.
 *
 * Photos: only the "Image" column (pictures uploaded into Coda, hosted on codahosted.io), plus "Image URL" when it
 * points at codahosted.io. Other links in "Image URL" are auction pages, so they are never used.
 *
 * Blank placeholder rows (a number but no coin and no grade yet) are "not found".
 */
import { CertAdapterError, type CertAdapter } from '../adapter';
import { normalizeCertNumber, type CertificateInput } from '../certificate';
import type { KVStore } from '../verify';
import { cellPhotos, cellText, CodaConfigError, createCodaClient, extractCodaDocId, parseApiBase, shortHash } from './coda';

// ------------------------------------------------------------------------------------------------ numbers

/** Prefix letter, six-digit batch, line. Spaces, lower case and a missing dash are tolerated (after normalising). */
const CERT_RE = /^([A-Z])(\d{6})-?(\d{1,4})$/;

export interface ParsedCert {
  prefix: string;
  batch: string; // e.g. A400107 (also the table name)
  line: string; // as typed, e.g. "1" or "001"
}

export function parseCertNumber(raw: string): ParsedCert | null {
  const m = CERT_RE.exec(normalizeCertNumber(raw));
  if (!m) return null;
  return { prefix: m[1], batch: `${m[1]}${m[2]}`, line: m[3] };
}

/** One spelling per certificate: A400107-133, U102703-1 (leading zeros of the line dropped). */
export function canonicalCertNumber(raw: string): string {
  const p = parseCertNumber(raw);
  if (!p) return normalizeCertNumber(raw);
  return `${p.batch}-${String(Number(p.line))}`;
}

/** The spellings to ask Coda for, in order: as typed, then padded to 3 digits ("001"), then unpadded. */
export function lineCandidates(p: ParsedCert): string[] {
  const n = String(Number(p.line));
  return [...new Set([p.line, n.padStart(3, '0'), n])].map((l) => `${p.batch}-${l}`);
}

// ------------------------------------------------------------------------------------------------ settings

export type DocLayout = 'roman' | 'label';
/** Roman doc has its own columns (EMPEROR, ST, SR, RIC…); US, World and Medals share the label layout. */
const LAYOUT_BY_PREFIX: Record<string, DocLayout> = { A: 'roman' };

export interface CodaMultiConfig {
  docs: Record<string, string>; // prefix → doc id
  token: string;
  apiBase: string;
}

export function parseCodaDocs(raw: string): Record<string, string> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new CodaConfigError('CODA_DOCS is not valid JSON (e.g. {"A":"docId","U":"docId"}).');
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new CodaConfigError('CODA_DOCS must be a JSON object.');
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
    if (!/^[A-Z]$/.test(k)) throw new CodaConfigError(`CODA_DOCS key "${k}" must be one capital letter (the certificate prefix).`);
    if (typeof v !== 'string' || !v.trim()) throw new CodaConfigError(`CODA_DOCS "${k}" must be a doc id or doc link.`);
    out[k] = extractCodaDocId(v);
  }
  if (Object.keys(out).length === 0) throw new CodaConfigError('CODA_DOCS is empty.');
  return out;
}

export function readCodaMultiConfig(env: { CODA_DOCS?: string; CODA_API_TOKEN?: string; CODA_API_BASE?: string }): CodaMultiConfig {
  return { docs: parseCodaDocs(env.CODA_DOCS ?? ''), token: env.CODA_API_TOKEN?.trim() ?? '', apiBase: parseApiBase(env.CODA_API_BASE) };
}

// ------------------------------------------------------------------------------------------------ privacy

/**
 * The only columns ever read from a row. Everything else (prices, Notes, links, created dates, internal columns)
 * is dropped by pickPublic as soon as the reply is parsed.
 */
export const PUBLIC_COLUMNS: Record<DocLayout, readonly string[]> = {
  roman: ['Invoice Num1', 'TITLE', 'DATE', 'METAL', 'DENOMINATION', 'EMPEROR', 'LINE4', 'LINE5', 'RIC_NUM2', 'RIC_NUMBER', 'CRAW_NUM 2', 'RPC_NUMBER', 'Weight Full', 'WEIGHT', 'mm full', 'GRADE', 'ST', 'SR', 'COM1', 'COM2', 'STYLE', 'Image', 'Image URL'],
  label: ['Invoice Num1', 'TITLE', 'DATE', 'METAL', 'DENOMINATION', 'LINE4', 'LINE5', 'LINE6', 'Top Line', 'Attribution', '2nd Attr', 'MINT MARK', 'WEIGHT', 'GRADE', 'STRIKE', 'COM1', 'COM2', 'STYLE', 'Image', 'Image URL'],
};

/** Never read, whatever happens to PUBLIC_COLUMNS. Tests check none of these can reach a certificate. */
export const PRIVATE_COLUMNS = ['Pur Price', '+ 20%', 'Sell Price', 'Notes', 'Link', '2nd Link', 'Web Link', 'Created on', 'Line Num2', 'Purity', 'SG'] as const;

type Rec = Record<string, unknown>;

export function pickPublic(values: Rec, layout: DocLayout): Rec {
  const out: Rec = {};
  for (const k of PUBLIC_COLUMNS[layout]) if (Object.hasOwn(values, k) && !(PRIVATE_COLUMNS as readonly string[]).includes(k)) out[k] = values[k];
  return out;
}

// ------------------------------------------------------------------------------------------------ mapping

const t = (v: unknown) => cellText(v);
const join = (sep: string, ...parts: (string | undefined)[]) => {
  const p = parts.map((s) => s?.trim()).filter((s): s is string => !!s);
  return p.length ? p.join(sep) : undefined;
};
/** Template leftovers such as "RIC-", "Craw-", "mm" or "g" with no number are not a value. */
const real = (v: unknown, empty: RegExp) => {
  const s = t(v);
  return s && !empty.test(s) ? s : undefined;
};
const score = (v: unknown) => {
  const s = t(v);
  return s && /^[1-5]$/.test(s) ? `${s}/5` : s;
};

function photos(v: Rec): string[] {
  const uploaded = cellPhotos(v.Image);
  const linked = cellPhotos(v['Image URL']).filter((u) => {
    try {
      const h = new URL(u).hostname;
      return h === 'codahosted.io' || h.endsWith('.codahosted.io');
    } catch {
      return false;
    }
  });
  return [...uploaded, ...linked];
}

/** A public row (after pickPublic) as a certificate, or null for a blank placeholder. */
export function mapPublicRow(v: Rec, layout: DocLayout): CertificateInput | null {
  const certNumber = t(v['Invoice Num1']);
  const grade = t(v.GRADE);
  if (!certNumber || !grade) return null;
  const [obverseUrl, reverseUrl] = photos(v);

  if (layout === 'roman') {
    if (!t(v.TITLE) && !t(v.DENOMINATION) && !t(v.EMPEROR)) return null;
    const refs = join(', ', real(v.RIC_NUM2, /^RIC-?$/i) ?? (t(v.RIC_NUMBER) ? `RIC ${t(v.RIC_NUMBER)}` : undefined), real(v['CRAW_NUM 2'], /^Craw-?$/i), t(v.RPC_NUMBER));
    const weight = real(v['Weight Full'], /^g$/i) ?? (t(v.WEIGHT) ? `${t(v.WEIGHT)}g` : undefined);
    return {
      certNumber,
      coinDescription: join(', ', t(v.EMPEROR), t(v.DENOMINATION)) ?? join(', ', t(v.TITLE), t(v.DENOMINATION))!,
      year: t(v.DATE),
      countryDenomination: join(', ', t(v.TITLE), join(' ', t(v.METAL), t(v.DENOMINATION))),
      grade,
      strikeScore: score(v.ST),
      surfaceScore: score(v.SR),
      notes: join(' · ', t(v.LINE4), t(v.LINE5) ? `Mint: ${t(v.LINE5)}` : undefined, refs, weight, real(v['mm full'], /^mm$/i), t(v.COM1), t(v.COM2), t(v.STYLE)),
      obverseUrl,
      reverseUrl,
    };
  }

  if (!t(v.TITLE) && !t(v.DENOMINATION)) return null;
  const weight = t(v.WEIGHT);
  return {
    certNumber,
    coinDescription: join(' ', t(v.TITLE), t(v.DATE), t(v['MINT MARK']), t(v.DENOMINATION))!,
    year: t(v.DATE),
    countryDenomination: join(', ', t(v.TITLE), t(v.DENOMINATION)),
    grade,
    strikeScore: t(v.STRIKE),
    notes: join(' · ', t(v['Top Line']), t(v.LINE4), t(v.LINE5), t(v.LINE6), t(v.Attribution), t(v['2nd Attr']), t(v.METAL), weight ? (/^[\d.]+$/.test(weight) ? `${weight}g` : weight) : undefined, t(v.COM1), t(v.COM2), t(v.STYLE)),
    obverseUrl,
    reverseUrl,
  };
}

// ------------------------------------------------------------------------------------------------ adapter

export interface CodaMultiOptions {
  config: CodaMultiConfig;
  fetch: typeof fetch;
  /** Caches each doc's table list (names and ids only). */
  kv?: KVStore;
  log?: (msg: string) => void;
  sleep?: (ms: number) => Promise<void>;
  timeoutMs?: number;
  now?: () => number;
}

/** Table list kept this long; an unknown batch refreshes it, at most once per TABLES_REFRESH_MS per doc. */
export const TABLES_TTL_MS = 60 * 60 * 1000;
export const TABLES_REFRESH_MS = 5 * 60 * 1000;

interface TableList {
  at: number;
  /** batch name → table ids (normally one) */
  tables: Record<string, string[]>;
}

const BATCH_NAME = /^[A-Z]\d{6}$/;

export function createCodaMultiAdapter(opts: CodaMultiOptions): CertAdapter {
  const { config } = opts;
  const log = opts.log ?? (() => {});
  const now = opts.now ?? Date.now;
  const client = createCodaClient({ token: config.token, fetch: opts.fetch, log, sleep: opts.sleep, timeoutMs: opts.timeoutMs });
  const memory = new Map<string, TableList>();

  async function fetchTables(docId: string): Promise<TableList> {
    const tables: Record<string, string[]> = {};
    let pageToken: string | undefined;
    for (let page = 0; page < 20; page++) {
      const p = pageToken ? new URLSearchParams({ pageToken }) : new URLSearchParams({ limit: '200', tableTypes: 'table' });
      const body = await client(`${config.apiBase}/docs/${encodeURIComponent(docId)}/tables?${p}`, 3000, 1);
      for (const it of body.items as unknown[]) {
        if (!it || typeof it !== 'object') continue;
        const { name, id } = it as { name?: unknown; id?: unknown };
        // Only batch tables ("A400107"): templates, copies, lookups and planning tables are ignored by name.
        if (typeof name === 'string' && typeof id === 'string' && BATCH_NAME.test(name.trim())) (tables[name.trim()] ??= []).push(id);
      }
      pageToken = typeof body.nextPageToken === 'string' && body.nextPageToken ? body.nextPageToken : undefined;
      if (!pageToken) break;
    }
    for (const [name, ids] of Object.entries(tables)) if (ids.length > 1) log(`coda: ${ids.length} tables are named ${name}; all are searched`);
    return { at: now(), tables };
  }

  async function tableList(docId: string, forBatch: string): Promise<TableList> {
    const key = `v1/coda-tables/${docId}`;
    let list = memory.get(docId) ?? null;
    if (!list && opts.kv) {
      try {
        const c = (await opts.kv.get(key)) as TableList | null;
        if (c && typeof c.at === 'number' && c.tables && typeof c.tables === 'object') list = c;
      } catch {
        /* cache is best effort */
      }
    }
    const age = list ? now() - list.at : Infinity;
    const stale = age >= TABLES_TTL_MS || (list && !list.tables[forBatch] && age >= TABLES_REFRESH_MS);
    if (!list || stale) {
      list = await fetchTables(docId);
      memory.set(docId, list);
      try {
        await opts.kv?.set(key, list, TABLES_TTL_MS);
      } catch {
        /* best effort */
      }
    }
    return list;
  }

  return {
    id: `coda-multi-${shortHash([config.apiBase, JSON.stringify(config.docs)].join('|'))}`,
    mode: 'live',
    canonicalNumber: canonicalCertNumber,

    async getCertificate(certNumber) {
      if (!config.token) throw new CertAdapterError('auth', 'CODA_API_TOKEN is not set.');
      const p = parseCertNumber(certNumber);
      if (!p) return null; // not one of his numbers
      const docId = config.docs[p.prefix];
      if (!docId) return null; // a prefix he does not use
      const layout = LAYOUT_BY_PREFIX[p.prefix] ?? 'label';
      const tableIds = (await tableList(docId, p.batch)).tables[p.batch] ?? [];
      if (tableIds.length === 0) return null;

      const wanted = new Set(lineCandidates(p));
      const found: Rec[] = [];
      for (const tableId of tableIds) {
        for (const candidate of wanted) {
          const q = new URLSearchParams({ useColumnNames: 'true', valueFormat: 'simpleWithArrays', limit: '10', query: `"Invoice Num1":${JSON.stringify(candidate)}` });
          const body = await client(`${config.apiBase}/docs/${encodeURIComponent(docId)}/tables/${encodeURIComponent(tableId)}/rows?${q}`, 3000, 1);
          for (const it of body.items as unknown[]) {
            const values = it && typeof it === 'object' ? (it as { values?: unknown }).values : undefined;
            // PRIVACY: cut the row down to public columns before anything else looks at it.
            if (values && typeof values === 'object') found.push(pickPublic(values as Rec, layout));
          }
          if (found.length) break;
        }
      }
      const target = canonicalCertNumber(certNumber);
      const matches = found.filter((v) => canonicalCertNumber(cellText(v['Invoice Num1']) ?? '') === target);
      if (matches.length === 0) return null;
      if (matches.length > 1) log(`coda: ${matches.length} rows share certificate number ${target}; showing the first filled one`);
      for (const v of matches) {
        const c = mapPublicRow(v, layout);
        if (c) return c;
      }
      return null; // blank placeholder row(s)
    },
  };
}
