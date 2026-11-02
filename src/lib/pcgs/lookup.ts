/**
 * PCGS certificate lookup, server side only.
 *
 * PCGS Public API facts used here (read from PCGS's own Swagger spec at
 * https://api.pcgs.com/publicapi/swagger/docs/v1 on 2026-11-02):
 *   base   https://api.pcgs.com/publicapi
 *   GET    /coindetail/GetCoinFactsByCertNo/{certNo}            (optional ?retrieveAllData=true|false)
 *   GET    /coindetail/GetCoinFactsByBarcode?barcode=&gradingService=PCGS|NGC
 *   reply  CoinFactsModel: PCGSNo, CertNo, Name, Year, Denomination, Country, Grade, Designation, Mintage, MintMark,
 *          MetalContent, Weight, Diameter, Population, PopHigher, PriceGuideValue, CoinFactsLink, Images[{Thumbnail,
 *          Fullsize}], IsValidRequest, ServerMessage. A 200 reply can still mean "no data": check IsValidRequest.
 * NOT verified from PCGS's own pages (pcgs.com/publicapi/documentation returns 403 to our tools):
 *   - how the token is sent. Secondary sources quote "Authorization: bearer <token>", which is what we send; the
 *     Swagger UI also offers an "api_key" query parameter. Set PCGS_AUTH_MODE=query to switch if the header fails.
 *   - the daily allowance (reported as 1,000 calls/day) and whether a public tool, caching, photos and price guide
 *     values are allowed by PCGS's terms. Photos and prices are hidden by default (PCGS_SHOW_IMAGES/PRICES).
 *   - the PCGS cert page address https://www.pcgs.com/cert/{certNo} (widely linked; PCGS blocks our fetches).
 *
 * The token is only ever read from the server environment and never appears in a response or a log line.
 */

export const PCGS_API_BASE = 'https://api.pcgs.com/publicapi';

export const VERIFY_LINKS = {
  pcgs: 'https://www.pcgs.com/cert',
  ngc: 'https://www.ngccoin.com/certlookup/',
  cac: 'https://www.cacgrading.com/verify',
  icg: 'https://www.icgcoin.com/verification/',
} as const;

export function pcgsCertUrl(certNo?: string | null): string {
  const n = (certNo ?? '').replace(/\D/g, '');
  return n ? `${VERIFY_LINKS.pcgs}/${n}` : VERIFY_LINKS.pcgs;
}

// ---------------------------------------------------------------- input

export type LookupQuery =
  | { kind: 'cert'; value: string }
  | { kind: 'barcode'; value: string; service: 'PCGS' | 'NGC' };

/** PCGS cert numbers are digits (7–8 today); allow 5–12 to be future-proof. Barcodes are digits (16 or 22). */
export function parseQuery(params: URLSearchParams): LookupQuery | { error: string } {
  const cert = params.get('cert');
  const barcode = params.get('barcode');
  if (cert != null && cert.trim() !== '') {
    const value = cert.replace(/[\s#.\-]/g, '');
    if (!/^\d{5,12}$/.test(value)) return { error: 'A PCGS certificate number is digits only, usually 7 or 8 of them.' };
    return { kind: 'cert', value };
  }
  if (barcode != null && barcode.trim() !== '') {
    const value = barcode.replace(/\s/g, '');
    if (!/^\d{10,30}$/.test(value)) return { error: 'A holder barcode number is digits only (usually 16 or 22).' };
    const s = (params.get('service') ?? 'PCGS').toUpperCase();
    if (s !== 'PCGS' && s !== 'NGC') return { error: 'Grading service must be PCGS or NGC.' };
    return { kind: 'barcode', value, service: s };
  }
  return { error: 'Type a certificate number.' };
}

export function cacheKey(q: LookupQuery): string {
  return q.kind === 'cert' ? `v1/cert/${q.value}` : `v1/barcode/${q.service}/${q.value}`;
}

// ---------------------------------------------------------------- output

export interface Coin {
  certNo: string;
  pcgsNo?: string;
  name?: string;
  year?: number | string;
  denomination?: string;
  mintMark?: string;
  country?: string;
  grade?: string;
  designation?: string;
  mintage?: string;
  metalContent?: string;
  weightGrams?: number;
  diameterMm?: number;
  population?: number;
  popHigher?: number;
  priceGuideValue?: number;
  coinFactsLink?: string;
  images?: { thumbnail?: string; full?: string }[];
}

export interface LookupResult {
  found: boolean;
  coin?: Coin;
  /** PCGS's own message when nothing was found. */
  message?: string;
}

const str = (v: unknown) => (typeof v === 'string' && v.trim() !== '' ? v.trim() : undefined);
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);
const httpsUrl = (v: unknown) => {
  const s = str(v);
  return s && /^https:\/\//i.test(s) ? s : undefined;
};

/** Validate PCGS's JSON (an external boundary) and keep only the fields we show. */
export function mapCoinFacts(raw: unknown, fallbackCert: string): LookupResult {
  if (!raw || typeof raw !== 'object') return { found: false, message: 'Unexpected reply from PCGS.' };
  const r = raw as Record<string, unknown>;
  if (r.IsValidRequest !== true) {
    return { found: false, message: str(r.ServerMessage) ?? 'No coin found for that number.' };
  }
  const certNo = str(r.CertNo) ?? fallbackCert;
  const name = str(r.Name);
  const grade = str(r.Grade);
  if (!name && !grade && !str(r.PCGSNo)) return { found: false, message: str(r.ServerMessage) ?? 'No coin found.' };
  const year = num(r.Year) ?? str(r.Year);
  const images = Array.isArray(r.Images)
    ? r.Images.map((i) => {
        const o = (i ?? {}) as Record<string, unknown>;
        return { thumbnail: httpsUrl(o.Thumbnail), full: httpsUrl(o.Fullsize) };
      }).filter((i) => i.thumbnail || i.full)
    : [];
  return {
    found: true,
    coin: {
      certNo,
      pcgsNo: str(r.PCGSNo),
      name,
      year: year === 0 ? undefined : year,
      denomination: str(r.Denomination),
      mintMark: str(r.MintMark),
      country: str(r.Country),
      grade,
      designation: str(r.Designation),
      mintage: str(r.Mintage),
      metalContent: str(r.MetalContent),
      weightGrams: num(r.Weight) || undefined,
      diameterMm: num(r.Diameter) || undefined,
      population: num(r.Population),
      popHigher: num(r.PopHigher),
      priceGuideValue: num(r.PriceGuideValue) || undefined,
      coinFactsLink: httpsUrl(r.CoinFactsLink),
      images: images.length ? images : undefined,
    },
  };
}

/** Clearly fake data for previews without a token. Every text field says DEMO. */
export function demoResult(q: LookupQuery): LookupResult {
  const certNo = q.kind === 'cert' ? q.value : q.value.slice(-8);
  if (certNo.endsWith('0000')) return { found: false, message: 'DEMO: numbers ending in 0000 show the "not found" state.' };
  return {
    found: true,
    coin: {
      certNo,
      pcgsNo: 'DEMO',
      name: 'DEMO DATA — example coin, not a real PCGS record',
      year: 1921,
      denomination: 'DEMO $1',
      country: 'DEMO',
      grade: 'DEMO MS64',
      designation: '',
      metalContent: 'DEMO',
      population: 0,
      popHigher: 0,
    },
  };
}

// ---------------------------------------------------------------- storage + limits

/** Small key-value store: Netlify Blobs in production, memory in tests and local dev. */
export interface KVStore {
  get(key: string): Promise<unknown | null>;
  set(key: string, value: unknown): Promise<void>;
}

export class MemoryStore implements KVStore {
  private m = new Map<string, unknown>();
  async get(key: string) {
    return this.m.has(key) ? structuredClone(this.m.get(key)) : null;
  }
  async set(key: string, value: unknown) {
    this.m.set(key, structuredClone(value));
  }
}

interface CacheEntry {
  at: number;
  ttl: number;
  result: LookupResult;
}

export const CACHE_TTL_FOUND_MS = 7 * 24 * 60 * 60 * 1000;
export const CACHE_TTL_MISS_MS = 60 * 60 * 1000;

export async function cacheGet(store: KVStore, key: string, now: number): Promise<LookupResult | null> {
  try {
    const e = (await store.get(`cache/${key}`)) as CacheEntry | null;
    if (!e || typeof e.at !== 'number' || !e.result) return null;
    return now - e.at < e.ttl ? e.result : null;
  } catch {
    return null;
  }
}

export async function cacheSet(store: KVStore, key: string, result: LookupResult, now: number): Promise<void> {
  const entry: CacheEntry = { at: now, ttl: result.found ? CACHE_TTL_FOUND_MS : CACHE_TTL_MISS_MS, result };
  try {
    await store.set(`cache/${key}`, entry);
  } catch {
    /* cache is best effort */
  }
}

/**
 * Per-visitor limit, fixed windows in memory. Netlify may run several copies of the function, so this is per copy:
 * good enough to stop one visitor hammering the tool. The daily PCGS budget below is the hard backstop.
 */
export class RateLimiter {
  private hits = new Map<string, { minute: number; minuteCount: number; day: number; dayCount: number }>();
  constructor(
    private perMinute = 10,
    private perDay = 60,
  ) {}

  /** Returns 0 when allowed, else the number of seconds to wait. */
  check(ip: string, now: number): number {
    const minute = Math.floor(now / 60_000);
    const day = Math.floor(now / 86_400_000);
    let h = this.hits.get(ip);
    if (!h || h.day !== day) h = { minute, minuteCount: 0, day, dayCount: 0 };
    if (h.minute !== minute) {
      h.minute = minute;
      h.minuteCount = 0;
    }
    if (h.dayCount >= this.perDay) {
      this.hits.set(ip, h);
      return Math.ceil(((day + 1) * 86_400_000 - now) / 1000);
    }
    if (h.minuteCount >= this.perMinute) {
      this.hits.set(ip, h);
      return Math.ceil(((minute + 1) * 60_000 - now) / 1000);
    }
    h.minuteCount++;
    h.dayCount++;
    this.hits.set(ip, h);
    if (this.hits.size > 5000) this.prune(day);
    return 0;
  }

  private prune(day: number) {
    for (const [k, v] of this.hits) if (v.day !== day) this.hits.delete(k);
  }
}

/** Counts real PCGS calls per UTC day across all copies of the function (stored in the KV store). */
export async function takeFromDailyBudget(store: KVStore, budget: number, now: number): Promise<boolean> {
  const key = `budget/${new Date(now).toISOString().slice(0, 10)}`;
  let used = 0;
  try {
    const v = await store.get(key);
    used = typeof v === 'number' ? v : 0;
  } catch {
    /* treat as 0 */
  }
  if (used >= budget) return false;
  try {
    await store.set(key, used + 1);
  } catch {
    /* best effort */
  }
  return true;
}

// ---------------------------------------------------------------- PCGS call

export class PcgsError extends Error {
  constructor(
    public kind: 'auth' | 'busy' | 'upstream' | 'timeout',
    message: string,
  ) {
    super(message);
  }
}

export async function callPcgs(
  q: LookupQuery,
  token: string,
  fetchImpl: typeof fetch,
  authMode: 'header' | 'query' = 'header',
): Promise<LookupResult> {
  const url =
    q.kind === 'cert'
      ? new URL(`${PCGS_API_BASE}/coindetail/GetCoinFactsByCertNo/${encodeURIComponent(q.value)}`)
      : new URL(`${PCGS_API_BASE}/coindetail/GetCoinFactsByBarcode`);
  if (q.kind === 'barcode') {
    url.searchParams.set('barcode', q.value);
    url.searchParams.set('gradingService', q.service);
  }
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (authMode === 'query') url.searchParams.set('api_key', token);
  else headers.Authorization = `bearer ${token}`;

  let res: Response;
  try {
    res = await fetchImpl(url, { headers, signal: AbortSignal.timeout(8000) });
  } catch (e) {
    const name = (e as { name?: string })?.name;
    throw new PcgsError(name === 'TimeoutError' || name === 'AbortError' ? 'timeout' : 'upstream', 'PCGS did not answer.');
  }
  if (res.status === 401 || res.status === 403) throw new PcgsError('auth', 'PCGS refused the request.');
  if (res.status === 429) throw new PcgsError('busy', 'PCGS is limiting requests.');
  if (res.status === 204 || res.status === 404) return { found: false, message: 'No coin found for that number.' };
  if (!res.ok) throw new PcgsError('upstream', `PCGS answered with an error.`);
  let body: unknown;
  try {
    body = await res.json();
  } catch {
    throw new PcgsError('upstream', 'PCGS sent a reply we could not read.');
  }
  return mapCoinFacts(body, q.kind === 'cert' ? q.value : '');
}

// ---------------------------------------------------------------- request handler

export interface LookupDeps {
  token?: string;
  fetch: typeof fetch;
  store: KVStore;
  limiter: RateLimiter;
  now: () => number;
  dailyBudget?: number;
  showImages?: boolean;
  showPrices?: boolean;
  authMode?: 'header' | 'query';
  log?: (msg: string) => void;
}

export interface LookupResponseBody {
  ok: boolean;
  mode: 'live' | 'demo';
  found?: boolean;
  cached?: boolean;
  coin?: Coin;
  message?: string;
  error?: string;
  verifyUrl: string;
  otherGraders: typeof VERIFY_LINKS;
}

function json(body: LookupResponseBody, status = 200, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Robots-Tag': 'noindex',
      ...extra,
    },
  });
}

function filterCoin(coin: Coin | undefined, deps: LookupDeps): Coin | undefined {
  if (!coin) return coin;
  const c = { ...coin };
  if (!deps.showImages) delete c.images;
  if (!deps.showPrices) delete c.priceGuideValue;
  return c;
}

export async function handleLookup(request: Request, ip: string, deps: LookupDeps): Promise<Response> {
  const mode: 'live' | 'demo' = deps.token ? 'live' : 'demo';
  const base = { mode, otherGraders: VERIFY_LINKS };
  if (request.method !== 'GET') {
    return json({ ...base, ok: false, error: 'Use GET.', verifyUrl: pcgsCertUrl() }, 405, { Allow: 'GET' });
  }
  const q = parseQuery(new URL(request.url).searchParams);
  if ('error' in q) return json({ ...base, ok: false, error: q.error, verifyUrl: pcgsCertUrl() }, 400);
  const verifyUrl = q.kind === 'cert' ? pcgsCertUrl(q.value) : q.service === 'NGC' ? VERIFY_LINKS.ngc : pcgsCertUrl();

  const now = deps.now();
  const wait = deps.limiter.check(ip || 'unknown', now);
  if (wait > 0) {
    return json(
      { ...base, ok: false, error: 'Too many lookups from your connection. Please wait and try again, or use the PCGS website.', verifyUrl },
      429,
      { 'Retry-After': String(wait) },
    );
  }

  if (mode === 'demo') {
    const r = demoResult(q);
    return json({ ...base, ok: true, found: r.found, coin: r.coin, message: r.message, cached: false, verifyUrl: r.coin ? pcgsCertUrl(r.coin.certNo) : verifyUrl });
  }

  const key = cacheKey(q);
  const hit = await cacheGet(deps.store, key, now);
  if (hit) {
    return json({
      ...base,
      ok: true,
      found: hit.found,
      coin: filterCoin(hit.coin, deps),
      message: hit.message,
      cached: true,
      verifyUrl: hit.coin ? pcgsCertUrl(hit.coin.certNo) : verifyUrl,
    });
  }

  if (!(await takeFromDailyBudget(deps.store, deps.dailyBudget ?? 900, now))) {
    return json({ ...base, ok: false, error: "Today's lookup allowance is used up. Please check on the PCGS website instead.", verifyUrl }, 503);
  }

  try {
    const r = await callPcgs(q, deps.token as string, deps.fetch, deps.authMode);
    await cacheSet(deps.store, key, r, now);
    return json({
      ...base,
      ok: true,
      found: r.found,
      coin: filterCoin(r.coin, deps),
      message: r.message,
      cached: false,
      verifyUrl: r.coin ? pcgsCertUrl(r.coin.certNo) : verifyUrl,
    });
  } catch (e) {
    const kind = e instanceof PcgsError ? e.kind : 'upstream';
    // Log the kind only: never the token, request headers or the visitor's IP.
    deps.log?.(`pcgs lookup failed: ${kind}`);
    const status = kind === 'busy' || kind === 'timeout' ? 503 : 502;
    return json({ ...base, ok: false, error: 'The PCGS lookup is not available right now. Please check on the PCGS website.', verifyUrl }, status);
  }
}
