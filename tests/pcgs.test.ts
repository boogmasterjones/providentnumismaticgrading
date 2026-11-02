import { describe, expect, it, vi } from 'vitest';
import {
  CACHE_TTL_FOUND_MS,
  CACHE_TTL_MISS_MS,
  MemoryStore,
  RateLimiter,
  handleLookup,
  mapCoinFacts,
  parseQuery,
  type LookupDeps,
  type LookupResponseBody,
} from '../src/lib/pcgs/lookup';

const TOKEN = 'secret-test-token-123';

const coinFacts = {
  PCGSNo: '7172',
  CertNo: '12345678',
  Name: '1921 $1 Morgan Dollar',
  Year: 1921,
  Denomination: '$1',
  MintMark: '',
  Country: 'United States',
  Grade: 'MS64',
  Designation: '',
  Mintage: '44,690,000',
  MetalContent: '90% Silver, 10% Copper',
  Weight: 26.73,
  Diameter: 38.1,
  Population: 1000,
  PopHigher: 200,
  PriceGuideValue: 95,
  CoinFactsLink: 'https://www.pcgs.com/coinfacts/coin/7172',
  Images: [{ Thumbnail: 'https://images.pcgs.com/t.jpg', Fullsize: 'https://images.pcgs.com/f.jpg' }],
  IsValidRequest: true,
  ServerMessage: 'Request successful',
};

function okResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

function makeDeps(over: Partial<LookupDeps> = {}) {
  let t = Date.UTC(2026, 10, 2, 12, 0, 0);
  const fetchMock = vi.fn(async () => okResponse(coinFacts));
  const deps: LookupDeps = {
    token: TOKEN,
    fetch: fetchMock as unknown as typeof fetch,
    store: new MemoryStore(),
    limiter: new RateLimiter(10, 60),
    now: () => t,
    dailyBudget: 900,
    ...over,
  };
  return { deps, fetchMock, advance: (ms: number) => (t += ms) };
}

const req = (qs: string, method = 'GET') => new Request(`https://example.com/api/pcgs?${qs}`, { method });
const body = async (r: Response) => (await r.json()) as LookupResponseBody;

describe('parseQuery', () => {
  it('accepts a cert number, stripping spaces, dashes and #', () => {
    expect(parseQuery(new URLSearchParams('cert=%23 1234-5678'))).toEqual({ kind: 'cert', value: '12345678' });
  });
  it('rejects letters and too-short numbers', () => {
    expect(parseQuery(new URLSearchParams('cert=abc123'))).toHaveProperty('error');
    expect(parseQuery(new URLSearchParams('cert=123'))).toHaveProperty('error');
    expect(parseQuery(new URLSearchParams(''))).toHaveProperty('error');
  });
  it('accepts barcodes for PCGS and NGC only', () => {
    expect(parseQuery(new URLSearchParams('barcode=1234567890123456&service=ngc'))).toEqual({
      kind: 'barcode',
      value: '1234567890123456',
      service: 'NGC',
    });
    expect(parseQuery(new URLSearchParams('barcode=1234567890123456&service=CAC'))).toHaveProperty('error');
  });
});

describe('mapCoinFacts', () => {
  it('maps PCGS fields and drops non-https image links', () => {
    const r = mapCoinFacts({ ...coinFacts, Images: [{ Thumbnail: 'javascript:alert(1)', Fullsize: 'http://x/y.jpg' }] }, '1');
    expect(r.found).toBe(true);
    expect(r.coin).toMatchObject({ certNo: '12345678', name: '1921 $1 Morgan Dollar', grade: 'MS64', population: 1000 });
    expect(r.coin?.images).toBeUndefined();
  });
  it('treats IsValidRequest=false as not found, keeping PCGS message', () => {
    expect(mapCoinFacts({ IsValidRequest: false, ServerMessage: 'No data found' }, '1')).toEqual({
      found: false,
      message: 'No data found',
    });
  });
  it('handles garbage', () => {
    expect(mapCoinFacts(null, '1').found).toBe(false);
    expect(mapCoinFacts('x', '1').found).toBe(false);
  });
});

describe('handleLookup: live mode (mocked fetch)', () => {
  it('calls the PCGS cert endpoint with the bearer token and never returns the token', async () => {
    const { deps, fetchMock } = makeDeps();
    const res = await handleLookup(req('cert=12345678'), '1.1.1.1', deps);
    expect(res.status).toBe(200);
    const text = await res.clone().text();
    expect(text).not.toContain(TOKEN);
    const b = await body(res);
    expect(b).toMatchObject({ ok: true, mode: 'live', found: true, cached: false });
    expect(b.verifyUrl).toBe('https://www.pcgs.com/cert/12345678');
    expect(b.otherGraders.ngc).toContain('ngccoin.com');
    const [url, init] = fetchMock.mock.calls[0] as unknown as [URL, RequestInit];
    expect(String(url)).toBe('https://api.pcgs.com/publicapi/coindetail/GetCoinFactsByCertNo/12345678');
    expect((init.headers as Record<string, string>).Authorization).toBe(`bearer ${TOKEN}`);
    expect(res.headers.get('Cache-Control')).toBe('no-store');
  });

  it('uses the barcode endpoint with gradingService', async () => {
    const { deps, fetchMock } = makeDeps();
    await handleLookup(req('barcode=1234567890123456&service=NGC'), 'ip', deps);
    const [url] = fetchMock.mock.calls[0] as unknown as [URL];
    expect(String(url)).toBe(
      'https://api.pcgs.com/publicapi/coindetail/GetCoinFactsByBarcode?barcode=1234567890123456&gradingService=NGC',
    );
  });

  it('can send the token as api_key query parameter instead', async () => {
    const { deps, fetchMock } = makeDeps({ authMode: 'query' });
    await handleLookup(req('cert=12345678'), 'ip', deps);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [URL, RequestInit];
    expect(url.searchParams.get('api_key')).toBe(TOKEN);
    expect((init.headers as Record<string, string>).Authorization).toBeUndefined();
  });

  it('hides photos and price guide values unless switched on', async () => {
    const off = makeDeps();
    const b1 = await body(await handleLookup(req('cert=12345678'), 'ip', off.deps));
    expect(b1.coin?.images).toBeUndefined();
    expect(b1.coin?.priceGuideValue).toBeUndefined();
    const on = makeDeps({ showImages: true, showPrices: true });
    const b2 = await body(await handleLookup(req('cert=12345678'), 'ip', on.deps));
    expect(b2.coin?.images?.[0].full).toBe('https://images.pcgs.com/f.jpg');
    expect(b2.coin?.priceGuideValue).toBe(95);
  });

  it('returns 400 for bad input without calling PCGS', async () => {
    const { deps, fetchMock } = makeDeps();
    const res = await handleLookup(req('cert=hello'), 'ip', deps);
    expect(res.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('maps PCGS auth failures to a generic error and logs only the kind', async () => {
    const log = vi.fn();
    const { deps } = makeDeps({ fetch: (async () => new Response('denied', { status: 401 })) as typeof fetch, log });
    const res = await handleLookup(req('cert=12345678'), 'ip', deps);
    expect(res.status).toBe(502);
    const b = await body(res);
    expect(b.ok).toBe(false);
    expect(b.verifyUrl).toBe('https://www.pcgs.com/cert/12345678');
    expect(log).toHaveBeenCalledWith('pcgs lookup failed: auth');
    expect(JSON.stringify(log.mock.calls)).not.toContain(TOKEN);
  });

  it('maps PCGS 429 and network errors to 503', async () => {
    const busy = makeDeps({ fetch: (async () => new Response('', { status: 429 })) as typeof fetch });
    expect((await handleLookup(req('cert=12345678'), 'ip', busy.deps)).status).toBe(503);
    const down = makeDeps({
      fetch: (async () => {
        throw new TypeError('network');
      }) as typeof fetch,
    });
    expect((await handleLookup(req('cert=12345678'), 'ip', down.deps)).status).toBe(502);
  });
});

describe('handleLookup: cache', () => {
  it('serves a repeat lookup from cache without calling PCGS', async () => {
    const { deps, fetchMock } = makeDeps();
    await handleLookup(req('cert=12345678'), 'a', deps);
    const b = await body(await handleLookup(req('cert=12345678'), 'b', deps));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(b).toMatchObject({ ok: true, found: true, cached: true });
  });

  it('expires found results after 7 days', async () => {
    const { deps, fetchMock, advance } = makeDeps();
    await handleLookup(req('cert=12345678'), 'a', deps);
    advance(CACHE_TTL_FOUND_MS - 1000);
    await handleLookup(req('cert=12345678'), 'a', deps);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    advance(2000);
    await handleLookup(req('cert=12345678'), 'a', deps);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('caches "not found" for a shorter time', async () => {
    const fetchMock = vi.fn(async () => okResponse({ IsValidRequest: false, ServerMessage: 'No data' }));
    const { deps, advance } = makeDeps({ fetch: fetchMock as unknown as typeof fetch });
    const b = await body(await handleLookup(req('cert=99999999'), 'a', deps));
    expect(b).toMatchObject({ ok: true, found: false, message: 'No data' });
    await handleLookup(req('cert=99999999'), 'a', deps);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    advance(CACHE_TTL_MISS_MS + 1);
    await handleLookup(req('cert=99999999'), 'a', deps);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('does not cache errors', async () => {
    let calls = 0;
    const flaky = (async () => {
      calls++;
      return calls === 1 ? new Response('', { status: 500 }) : okResponse(coinFacts);
    }) as typeof fetch;
    const { deps } = makeDeps({ fetch: flaky });
    expect((await handleLookup(req('cert=12345678'), 'a', deps)).status).toBe(502);
    expect((await handleLookup(req('cert=12345678'), 'a', deps)).status).toBe(200);
  });
});

describe('handleLookup: rate limits', () => {
  it('limits one visitor per minute and lets them back in after the window', async () => {
    const { deps, advance } = makeDeps({ limiter: new RateLimiter(3, 100) });
    for (let i = 0; i < 3; i++) expect((await handleLookup(req(`cert=1234567${i}`), '9.9.9.9', deps)).status).toBe(200);
    const blocked = await handleLookup(req('cert=12345679'), '9.9.9.9', deps);
    expect(blocked.status).toBe(429);
    expect(Number(blocked.headers.get('Retry-After'))).toBeGreaterThan(0);
    // another visitor is unaffected
    expect((await handleLookup(req('cert=12345679'), '8.8.8.8', deps)).status).toBe(200);
    advance(60_000);
    expect((await handleLookup(req('cert=12345679'), '9.9.9.9', deps)).status).toBe(200);
  });

  it('enforces a per-visitor daily cap', () => {
    const limiter = new RateLimiter(100, 2);
    const t = Date.UTC(2026, 10, 2, 10);
    expect(limiter.check('x', t)).toBe(0);
    expect(limiter.check('x', t + 1)).toBe(0);
    expect(limiter.check('x', t + 2)).toBeGreaterThan(0);
    expect(limiter.check('x', t + 86_400_000)).toBe(0);
  });

  it('stops calling PCGS when the daily budget is used up, but still serves the cache', async () => {
    const { deps, fetchMock } = makeDeps({ dailyBudget: 2 });
    expect((await handleLookup(req('cert=11111111'), 'a', deps)).status).toBe(200);
    expect((await handleLookup(req('cert=22222222'), 'b', deps)).status).toBe(200);
    const over = await handleLookup(req('cert=33333333'), 'c', deps);
    expect(over.status).toBe(503);
    expect((await body(over)).verifyUrl).toBe('https://www.pcgs.com/cert/33333333');
    expect((await handleLookup(req('cert=11111111'), 'd', deps)).status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe('handleLookup: demo mode (no token)', () => {
  it('returns clearly labelled demo data and never calls PCGS', async () => {
    const { deps, fetchMock } = makeDeps({ token: undefined });
    const b = await body(await handleLookup(req('cert=12345678'), 'a', deps));
    expect(fetchMock).not.toHaveBeenCalled();
    expect(b.mode).toBe('demo');
    expect(b.found).toBe(true);
    expect(b.coin?.name).toMatch(/DEMO/);
    expect(b.verifyUrl).toBe('https://www.pcgs.com/cert/12345678');
  });

  it('shows the not-found state for numbers ending in 0000', async () => {
    const { deps } = makeDeps({ token: undefined });
    const b = await body(await handleLookup(req('cert=12340000'), 'a', deps));
    expect(b).toMatchObject({ mode: 'demo', ok: true, found: false });
  });

  it('is still rate limited', async () => {
    const { deps } = makeDeps({ token: undefined, limiter: new RateLimiter(1, 10) });
    await handleLookup(req('cert=12345678'), 'a', deps);
    expect((await handleLookup(req('cert=12345678'), 'a', deps)).status).toBe(429);
  });
});

it('rejects non-GET requests', async () => {
  const { deps } = makeDeps();
  expect((await handleLookup(req('cert=12345678', 'POST'), 'a', deps)).status).toBe(405);
});
