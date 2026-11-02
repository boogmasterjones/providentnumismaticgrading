import { describe, expect, it, vi } from 'vitest';
import { CertAdapterError, getCertAdapter, type CertAdapter } from '../src/lib/certs/adapter';
import { isPlausibleCertNumber, normalizeCertNumber, parseCertificate } from '../src/lib/certs/certificate';
import { createMockAdapter, DEMO_CERTIFICATES } from '../src/lib/certs/providers/mock';
import { createCodaAdapter, readCodaConfig } from '../src/lib/certs/providers/coda';
import {
  CACHE_TTL_FOUND_MS,
  CACHE_TTL_MISS_MS,
  MemoryStore,
  RateLimiter,
  handleVerify,
  loadPopulation,
  type VerifyDeps,
  type VerifyResponseBody,
} from '../src/lib/certs/verify';

const KEY = 'secret-test-key-123';
const CODA_ENV = { CODA_DOC_ID: 'AbCDeFGH', CODA_TABLE_ID: 'Certificates', CODA_API_TOKEN: KEY };

const record = {
  certNumber: 'PNA-1001',
  coinDescription: '1921 Morgan dollar',
  year: '1921',
  countryDenomination: 'United States, Morgan dollar',
  grade: 'MS 64',
  strikeScore: '4/5',
  surfaceScore: '4/5',
  notes: 'Original surfaces.',
  obverseUrl: 'https://img.example.com/1001-obv.jpg',
  reverseUrl: 'https://img.example.com/1001-rev.jpg',
  dateGraded: '2026-10-30',
};

const okResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

/** The record above as a Coda row (default column names). */
const codaValues = (r: typeof record) => ({
  'Cert #': r.certNumber,
  Coin: r.coinDescription,
  Year: r.year,
  'Country/Denomination': r.countryDenomination,
  Grade: r.grade,
  Strike: r.strikeScore,
  Surface: r.surfaceScore,
  Notes: r.notes,
  Obverse: r.obverseUrl,
  Reverse: r.reverseUrl,
  'Date Graded': r.dateGraded,
});
const codaRows = (...recs: (typeof record)[]) =>
  okResponse({ items: recs.map((r, i) => ({ id: `i-${i}`, values: codaValues(r), updatedAt: '2026-10-30T00:00:00Z' })) });

function liveDeps(fetchImpl: (url: string, init?: RequestInit) => Promise<Response>, over: Partial<VerifyDeps> = {}) {
  let t = Date.UTC(2026, 10, 2, 12, 0, 0);
  const fetchMock = vi.fn(fetchImpl);
  const logs: string[] = [];
  const deps: VerifyDeps = {
    adapter: createCodaAdapter({
      config: readCodaConfig(CODA_ENV),
      fetch: fetchMock as unknown as typeof fetch,
      sleep: async () => {},
      log: (m) => logs.push(m),
    }),
    store: new MemoryStore(),
    limiter: new RateLimiter(20, 300),
    now: () => t,
    log: (m) => logs.push(m),
    ...over,
  };
  return { deps, fetchMock, logs, advance: (ms: number) => (t += ms) };
}

const req = (qs: string, method = 'GET') => new Request(`https://example.com/api/verify?${qs}`, { method });
const read = async (r: Response) => {
  const text = await r.text();
  return { text, body: JSON.parse(text) as VerifyResponseBody };
};

describe('certificate numbers', () => {
  it('ignores case, spaces, # and "Cert No." prefixes', () => {
    expect(normalizeCertNumber(' demo-0001 ')).toBe('DEMO-0001');
    expect(normalizeCertNumber('#12345')).toBe('12345');
    expect(normalizeCertNumber('No. 12 345')).toBe('12345');
    expect(normalizeCertNumber('Cert # pna-1001')).toBe('PNA-1001');
    expect(normalizeCertNumber('Certificate No. 77')).toBe('77');
  });
  it('accepts only letters, digits and dashes of a sane length', () => {
    expect(isPlausibleCertNumber('PNA-1001')).toBe(true);
    expect(isPlausibleCertNumber('-1')).toBe(false);
    expect(isPlausibleCertNumber('A'.repeat(33))).toBe(false);
  });
});

describe('Certificate schema', () => {
  it('keeps https photos and drops anything else', () => {
    const c = parseCertificate({ ...record, obverseUrl: 'javascript:alert(1)', reverseUrl: 'http://x.com/a.jpg' });
    expect(c?.obverseUrl).toBeUndefined();
    expect(c?.reverseUrl).toBeUndefined();
    expect(parseCertificate(record)?.obverseUrl).toBe(record.obverseUrl);
  });
  it('rejects records without a number, description or grade', () => {
    expect(parseCertificate({ ...record, grade: '' })).toBeNull();
    expect(parseCertificate({ certNumber: 'X' })).toBeNull();
    expect(parseCertificate('nonsense')).toBeNull();
  });
});

describe('mock adapter', () => {
  it('is used when no CODA_* setting is present and returns only DEMO records', async () => {
    const a = getCertAdapter({});
    expect(a.mode).toBe('demo');
    expect(await a.getCertificate('DEMO-0002')).toMatchObject({ certNumber: 'DEMO-0002', demo: true });
    expect(await a.getCertificate('PNA-1001')).toBeNull();
    for (const c of DEMO_CERTIFICATES) expect(c.coinDescription).toMatch(/^DEMO/);
  });
  it('serves the demo lookup through /api/verify', async () => {
    const deps: VerifyDeps = { adapter: createMockAdapter(), store: new MemoryStore(), limiter: new RateLimiter(), now: () => 0 };
    const { body } = await read(await handleVerify(req('cert=demo-0001'), '1.1.1.1', deps));
    expect(body).toMatchObject({ ok: true, mode: 'demo', found: true, query: 'DEMO-0001' });
    expect(body.certificate?.demo).toBe(true);
  });
});

describe('adapter choice', () => {
  it('uses Coda when CODA_* is set, and sends the token in the Authorization header only', async () => {
    const fetchMock = vi.fn(async () => codaRows(record));
    const a = getCertAdapter(CODA_ENV, fetchMock as unknown as typeof fetch);
    expect(a.mode).toBe('live');
    expect(a.id).toMatch(/^coda-/);
    const deps: VerifyDeps = { adapter: a, store: new MemoryStore(), limiter: new RateLimiter(), now: () => 0 };
    const { text, body } = await read(await handleVerify(req('cert=pna-1001'), '1.1.1.1', deps));
    expect(body).toMatchObject({ ok: true, mode: 'live', found: true, cached: false });
    expect(body.certificate).toMatchObject({ certNumber: 'PNA-1001', grade: 'MS 64' });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url.startsWith('https://coda.io/apis/v1/docs/AbCDeFGH/tables/Certificates/rows?')).toBe(true);
    expect(url).not.toContain(KEY);
    expect((init.headers as Record<string, string>).Authorization).toBe(`Bearer ${KEY}`);
    expect(text).not.toContain(KEY);
  });
});

describe('/api/verify', () => {
  it('rejects bad input without calling the database', async () => {
    const { deps, fetchMock } = liveDeps(async () => codaRows(record));
    expect((await handleVerify(req('cert='), 'ip', deps)).status).toBe(400);
    expect((await handleVerify(req('cert=' + encodeURIComponent('-- ../')), 'ip', deps)).status).toBe(400);
    expect((await handleVerify(req('cert=' + 'A'.repeat(101)), 'ip', deps)).status).toBe(400);
    expect((await handleVerify(req('cert=PNA-1001', 'POST'), 'ip', deps)).status).toBe(405);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('answers not found for no matching row, but an error when Coda says the doc/table is missing (404)', async () => {
    const { deps } = liveDeps(async () => okResponse({ items: [] }));
    const a = await read(await handleVerify(req('cert=NOPE'), 'ip', deps));
    expect(a.body).toMatchObject({ ok: true, found: false, query: 'NOPE' });
    const b = liveDeps(async () => new Response('', { status: 404 }));
    const res = await handleVerify(req('cert=NOPE'), 'ip', b.deps);
    expect(res.status).toBe(502);
    expect(b.logs.join(' ')).toMatch(/CODA_DOC_ID and CODA_TABLE_ID/);
  });

  it('treats a reply for a different number as not found', async () => {
    const { deps } = liveDeps(async () => codaRows({ ...record, certNumber: 'OTHER-1' }));
    const { body } = await read(await handleVerify(req('cert=PNA-1001'), 'ip', deps));
    expect(body).toMatchObject({ ok: true, found: false });
    expect(body.certificate).toBeUndefined();
  });

  it('never leaks the key or the raw upstream error', async () => {
    const leaky = `invalid key ${KEY} at db-internal-host:5432`;
    for (const make of [
      () => new Response(leaky, { status: 401 }),
      () => new Response(leaky, { status: 500 }),
      () => okResponse({ error: leaky }),
      () => new Response('<html>' + leaky, { status: 200 }),
    ]) {
      const { deps, logs } = liveDeps(async () => make());
      const res = await handleVerify(req('cert=PNA-1001'), 'ip', deps);
      const { text, body } = await read(res);
      expect(res.status).toBe(502);
      expect(body.ok).toBe(false);
      expect(text).not.toContain(KEY);
      expect(text).not.toContain('db-internal-host');
      expect(logs.join(' ')).not.toContain(KEY);
    }
  });

  it('maps timeouts and 429 to 503', async () => {
    const t = liveDeps(async () => {
      throw Object.assign(new Error('timed out'), { name: 'TimeoutError' });
    });
    expect((await handleVerify(req('cert=A1'), 'ip', t.deps)).status).toBe(503);
    const b = liveDeps(async () => new Response('', { status: 429 }));
    expect((await handleVerify(req('cert=A1'), 'ip', b.deps)).status).toBe(503);
  });

  it('fails safely (never demo data) when the token is missing', async () => {
    const fetchMock = vi.fn();
    const deps: VerifyDeps = {
      adapter: getCertAdapter({ CODA_DOC_ID: 'AbCDeFGH', CODA_TABLE_ID: 'Certificates' }, fetchMock as unknown as typeof fetch),
      store: new MemoryStore(),
      limiter: new RateLimiter(),
      now: () => 0,
    };
    expect((await handleVerify(req('cert=A1'), 'ip', deps)).status).toBe(502);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('cache', () => {
  it('serves a found certificate from cache for an hour, then asks again', async () => {
    const { deps, fetchMock, advance } = liveDeps(async () => codaRows(record));
    await handleVerify(req('cert=PNA-1001'), 'ip', deps);
    advance(CACHE_TTL_FOUND_MS - 1000);
    const second = await read(await handleVerify(req('cert=%20pna-1001%20'), 'ip', deps));
    expect(second.body.cached).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    advance(2000);
    await handleVerify(req('cert=PNA-1001'), 'ip', deps);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('remembers "not found" for only a few minutes', async () => {
    expect(CACHE_TTL_MISS_MS).toBeLessThanOrEqual(10 * 60 * 1000);
    const { deps, fetchMock, advance } = liveDeps(async () => okResponse({ items: [] }));
    await handleVerify(req('cert=NEW-1'), 'ip', deps);
    await handleVerify(req('cert=NEW-1'), 'ip', deps);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    advance(CACHE_TTL_MISS_MS + 1);
    await handleVerify(req('cert=NEW-1'), 'ip', deps);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('does not cache errors', async () => {
    const { deps, fetchMock } = liveDeps(async () => new Response('', { status: 500 }));
    await handleVerify(req('cert=A1'), 'ip', deps);
    await handleVerify(req('cert=A1'), 'ip', deps);
    // Each lookup tries twice (one retry on a 5xx), and nothing is cached in between.
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it('keeps demo and live answers apart', async () => {
    const store = new MemoryStore();
    const demo: VerifyDeps = { adapter: createMockAdapter(), store, limiter: new RateLimiter(), now: () => 0 };
    await handleVerify(req('cert=DEMO-0001'), 'ip', demo);
    const { deps } = liveDeps(async () => okResponse({ items: [] }), { store, now: () => 0 });
    const { body } = await read(await handleVerify(req('cert=DEMO-0001'), 'ip', deps));
    expect(body.found).toBe(false);
  });
});

describe('rate limit', () => {
  it('allows 20 a minute per visitor, then 429 with Retry-After; other visitors are unaffected', async () => {
    const { deps, advance } = liveDeps(async () => codaRows(record));
    for (let i = 0; i < 20; i++) expect((await handleVerify(req('cert=PNA-1001'), '9.9.9.9', deps)).status).toBe(200);
    const blocked = await handleVerify(req('cert=PNA-1001'), '9.9.9.9', deps);
    expect(blocked.status).toBe(429);
    expect(Number(blocked.headers.get('Retry-After'))).toBeGreaterThan(0);
    expect((await handleVerify(req('cert=PNA-1001'), '8.8.8.8', deps)).status).toBe(200);
    advance(60_000);
    expect((await handleVerify(req('cert=PNA-1001'), '9.9.9.9', deps)).status).toBe(200);
  });
  it('caps a visitor per day', () => {
    const l = new RateLimiter(1000, 3);
    expect([l.check('a', 0), l.check('a', 0), l.check('a', 0)]).toEqual([0, 0, 0]);
    expect(l.check('a', 0)).toBeGreaterThan(0);
  });
});

describe('population', () => {
  it('is computed from the mock records and labelled demo', async () => {
    const r = await loadPopulation({ adapter: createMockAdapter(), store: new MemoryStore(), now: () => 0 });
    expect(r.kind).toBe('report');
    if (r.kind !== 'report') return;
    expect(r.demo).toBe(true);
    expect(r.report.total).toBe(3);
    expect(r.report.demoCount).toBe(3);
  });
  it('is "unsupported" when the database cannot list certificates', async () => {
    const adapter: CertAdapter = { id: 'x', mode: 'live', getCertificate: async () => null };
    expect((await loadPopulation({ adapter, store: new MemoryStore(), now: () => 0 })).kind).toBe('unsupported');
  });
  it('reports an error without details when listing fails', async () => {
    const adapter: CertAdapter = {
      id: 'x',
      mode: 'live',
      getCertificate: async () => null,
      listAll: async () => {
        throw new CertAdapterError('auth', `bad key ${KEY}`);
      },
    };
    const logs: string[] = [];
    expect(await loadPopulation({ adapter, store: new MemoryStore(), now: () => 0, log: (m) => logs.push(m) })).toEqual({ kind: 'error' });
    expect(logs.join(' ')).not.toContain(KEY);
  });
});
