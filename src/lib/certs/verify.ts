/**
 * Certificate verification, server side only (/api/verify runs as a Netlify Function).
 *
 * Flow: check the typed number → per-visitor limit → cache → adapter (the owner's database, or DEMO records) →
 * validate with CertificateSchema → cache → reply. The API key lives only in the adapter; replies and logs carry
 * nothing from the database except the validated certificate fields.
 */
import { CertAdapterError, type CertAdapter } from './adapter';
import { isPlausibleCertNumber, normalizeCertNumber, parseCertificate, type Certificate } from './certificate';
import { computePopulation, type PopulationReport } from '../population';

// ---------------------------------------------------------------- storage

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

interface CacheEntry<T> {
  at: number;
  ttl: number;
  value: T;
}

/** Found: 1 hour, so a correction in the owner's database shows on the site within the hour. */
export const CACHE_TTL_FOUND_MS = 60 * 60 * 1000;
/** Not found: 5 minutes, so a newly entered certificate shows up quickly. */
export const CACHE_TTL_MISS_MS = 5 * 60 * 1000;
/** Population report: 1 hour. */
export const CACHE_TTL_POPULATION_MS = 60 * 60 * 1000;

async function cacheGet<T>(store: KVStore, key: string, now: number): Promise<T | null> {
  try {
    const e = (await store.get(key)) as CacheEntry<T> | null;
    if (!e || typeof e.at !== 'number' || typeof e.ttl !== 'number' || !('value' in e)) return null;
    return now - e.at < e.ttl ? e.value : null;
  } catch {
    return null;
  }
}

async function cacheSet<T>(store: KVStore, key: string, value: T, ttl: number, now: number): Promise<void> {
  try {
    await store.set(key, { at: now, ttl, value } satisfies CacheEntry<T>);
  } catch {
    /* cache is best effort */
  }
}

/** Blob keys are safe: the number is already reduced to A-Z, 0-9 and dashes. */
export const certCacheKey = (adapter: CertAdapter, n: string) => `v1/${adapter.id}/cert/${n}`;

// ---------------------------------------------------------------- per-visitor limit

/**
 * Fixed windows in memory, per running copy of the function: enough to stop one visitor hammering the lookup
 * (and through it the owner's database).
 */
export class RateLimiter {
  private hits = new Map<string, { minute: number; minuteCount: number; day: number; dayCount: number }>();
  constructor(
    private perMinute = 20,
    private perDay = 300,
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
    this.hits.set(ip, h);
    if (h.dayCount >= this.perDay) return Math.ceil(((day + 1) * 86_400_000 - now) / 1000);
    if (h.minuteCount >= this.perMinute) return Math.ceil(((minute + 1) * 60_000 - now) / 1000);
    h.minuteCount++;
    h.dayCount++;
    if (this.hits.size > 5000) for (const [k, v] of this.hits) if (v.day !== day) this.hits.delete(k);
    return 0;
  }
}

// ---------------------------------------------------------------- lookup

export type LookupOutcome =
  | { kind: 'found'; certificate: Certificate; cached: boolean }
  | { kind: 'not-found'; cached: boolean }
  | { kind: 'error'; errorKind: CertAdapterError['kind'] | 'invalid' };

export async function lookupCertificate(
  n: string,
  deps: { adapter: CertAdapter; store: KVStore; now: () => number; log?: (msg: string) => void },
): Promise<LookupOutcome> {
  const now = deps.now();
  const key = certCacheKey(deps.adapter, n);
  const hit = await cacheGet<{ found: boolean; certificate?: Certificate }>(deps.store, key, now);
  if (hit) {
    const cert = hit.found ? parseCertificate(hit.certificate) : null;
    if (cert) return { kind: 'found', certificate: cert, cached: true };
    if (!hit.found) return { kind: 'not-found', cached: true };
  }

  let raw: unknown;
  try {
    raw = await deps.adapter.getCertificate(n);
  } catch (e) {
    const kind = e instanceof CertAdapterError ? e.kind : 'upstream';
    // Log the kind only: never the key, request headers, the database's reply or the visitor's IP.
    deps.log?.(`certificate lookup failed: ${kind}`);
    return { kind: 'error', errorKind: kind };
  }

  if (raw == null) {
    await cacheSet(deps.store, key, { found: false }, CACHE_TTL_MISS_MS, now);
    return { kind: 'not-found', cached: false };
  }
  const cert = parseCertificate(raw);
  if (!cert) {
    deps.log?.('certificate lookup failed: invalid record');
    return { kind: 'error', errorKind: 'invalid' };
  }
  // The database must answer for the number that was asked; anything else is treated as not found.
  if (normalizeCertNumber(cert.certNumber) !== n) {
    deps.log?.('certificate lookup: reply was for a different number');
    return { kind: 'not-found', cached: false };
  }
  await cacheSet(deps.store, key, { found: true, certificate: cert }, CACHE_TTL_FOUND_MS, now);
  return { kind: 'found', certificate: cert, cached: false };
}

// ---------------------------------------------------------------- /api/verify handler

export interface VerifyDeps {
  adapter: CertAdapter;
  store: KVStore;
  limiter: RateLimiter;
  now: () => number;
  log?: (msg: string) => void;
}

export interface VerifyResponseBody {
  ok: boolean;
  mode: 'live' | 'demo';
  /** The number as we searched for it (capitals, no spaces). */
  query?: string;
  found?: boolean;
  certificate?: Certificate;
  cached?: boolean;
  error?: string;
}

function json(body: VerifyResponseBody, status = 200, extra: Record<string, string> = {}): Response {
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

export async function handleVerify(request: Request, ip: string, deps: VerifyDeps): Promise<Response> {
  const mode = deps.adapter.mode;
  if (request.method !== 'GET') return json({ ok: false, mode, error: 'Use GET.' }, 405, { Allow: 'GET' });

  const typed = new URL(request.url).searchParams.get('cert') ?? '';
  if (typed.length > 100) return json({ ok: false, mode, error: 'That certificate number is too long.' }, 400);
  const n = normalizeCertNumber(typed);
  if (!n) return json({ ok: false, mode, error: 'Type a certificate number.' }, 400);
  if (!isPlausibleCertNumber(n)) {
    return json({ ok: false, mode, error: 'A certificate number is letters, digits and dashes only.' }, 400);
  }

  const wait = deps.limiter.check(ip || 'unknown', deps.now());
  if (wait > 0) {
    return json({ ok: false, mode, query: n, error: 'Too many lookups from your connection. Please wait a minute and try again.' }, 429, {
      'Retry-After': String(wait),
    });
  }

  const r = await lookupCertificate(n, deps);
  if (r.kind === 'found') return json({ ok: true, mode, query: n, found: true, certificate: r.certificate, cached: r.cached });
  if (r.kind === 'not-found') return json({ ok: true, mode, query: n, found: false, cached: r.cached });
  const status = r.errorKind === 'busy' || r.errorKind === 'timeout' ? 503 : 502;
  return json(
    { ok: false, mode, query: n, error: 'The certificate lookup is not available right now. Please try again later, or contact us with the number.' },
    status,
  );
}

// ---------------------------------------------------------------- population report

export type PopulationOutcome =
  | { kind: 'report'; report: PopulationReport; demo: boolean }
  | { kind: 'unsupported' }
  | { kind: 'error' };

/** Population from the adapter's listAll(), cached for an hour. "unsupported" when the database can't list. */
export async function loadPopulation(deps: {
  adapter: CertAdapter;
  store: KVStore;
  now: () => number;
  log?: (msg: string) => void;
}): Promise<PopulationOutcome> {
  const { adapter } = deps;
  if (!adapter.listAll) return { kind: 'unsupported' };
  const key = `v1/${adapter.id}/population`;
  const now = deps.now();
  const hit = await cacheGet<PopulationReport>(deps.store, key, now);
  if (hit) return { kind: 'report', report: hit, demo: adapter.mode === 'demo' };
  try {
    const certs = (await adapter.listAll()).map(parseCertificate).filter((c): c is Certificate => c !== null);
    const report = computePopulation(
      certs.map((c) => ({ year: c.year, countryDenomination: c.countryDenomination ?? '', grade: c.grade, demo: c.demo })),
    );
    await cacheSet(deps.store, key, report, CACHE_TTL_POPULATION_MS, now);
    return { kind: 'report', report, demo: adapter.mode === 'demo' };
  } catch (e) {
    deps.log?.(`population failed: ${e instanceof CertAdapterError ? e.kind : 'upstream'}`);
    return { kind: 'error' };
  }
}
