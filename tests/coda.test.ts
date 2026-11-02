import { describe, expect, it, vi } from 'vitest';
import { CertAdapterError, getCertAdapter } from '../src/lib/certs/adapter';
import {
  cellPhotos,
  createCodaAdapter,
  extractCodaDocId,
  mapCodaRow,
  parseCodaColumnMap,
  readCodaConfig,
  retryDelayMs,
  type CodaEnv,
} from '../src/lib/certs/providers/coda';
import { MemoryStore, RateLimiter, handleVerify, loadPopulation } from '../src/lib/certs/verify';

const TOKEN = 'coda-secret-token-0f9e8d7c';
const ENV: CodaEnv = { CODA_DOC_ID: 'AbCDeFGH', CODA_TABLE_ID: 'Certificates', CODA_API_TOKEN: TOKEN };

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } });

const row = (values: Record<string, unknown>, updatedAt = '2026-10-01T00:00:00.000Z', id = 'i-1') => ({
  id,
  type: 'row',
  name: String(values['Cert #'] ?? ''),
  updatedAt,
  values,
});

const morgan = {
  'Cert #': 'PNA-1001',
  Coin: '1921 Morgan dollar',
  Year: '1921',
  'Country/Denomination': 'United States, Morgan dollar',
  Grade: 'MS 64',
  Strike: '4/5',
  Surface: '4/5',
  Notes: 'Original surfaces.',
  Obverse: 'https://codahosted.io/docs/AbCDeFGH/blobs/bl-obv/1a2b3c',
  Reverse: 'https://codahosted.io/docs/AbCDeFGH/blobs/bl-rev/4d5e6f',
  'Date Graded': '2026-10-30T00:00:00.000-04:00',
};

function setup(fetchImpl: (url: string) => Promise<Response>, env: CodaEnv = ENV) {
  const fetchMock = vi.fn(async (url: string, _init?: RequestInit) => fetchImpl(url));
  const logs: string[] = [];
  const sleeps: number[] = [];
  const adapter = createCodaAdapter({
    config: readCodaConfig(env),
    fetch: fetchMock as unknown as typeof fetch,
    log: (m) => logs.push(m),
    sleep: async (ms) => {
      sleeps.push(ms);
    },
  });
  const params = (i: number) => new URL(fetchMock.mock.calls[i][0]).searchParams;
  return { adapter, fetchMock, logs, sleeps, params };
}

describe('Coda settings', () => {
  it('reads the doc id from a bare id or a browser link', () => {
    expect(extractCodaDocId('AbCDeFGH')).toBe('AbCDeFGH');
    expect(extractCodaDocId('https://coda.io/d/Certificates_dAbCDeFGH')).toBe('AbCDeFGH');
    expect(extractCodaDocId('https://coda.io/d/Coin-Registry_dAbC-De_FGH/Certs_suXyZ#Table_tu1')).toBe('AbC-De_FGH');
    expect(extractCodaDocId('https://docs.superhuman.com/d/_dAbCDeFGH')).toBe('AbCDeFGH');
    expect(() => extractCodaDocId('not a doc id!')).toThrow();
  });

  it('merges CODA_COLUMN_MAP over the defaults and refuses typos', () => {
    const m = parseCodaColumnMap('{"certNumber":"Certificate","coinDescription":["Year","Denomination"],"notes":null}');
    expect(m.certNumber).toBe('Certificate');
    expect(m.coinDescription).toEqual(['Year', 'Denomination']);
    expect(m.grade).toBe('Grade');
    expect(m.notes).toBeUndefined();
    expect(() => parseCodaColumnMap('{"grde":"Grade"}')).toThrow(/unknown field "grde"/);
    expect(() => parseCodaColumnMap('{nope')).toThrow(/not valid JSON/);
    expect(() => parseCodaColumnMap('{"certNumber":null}')).toThrow(/certNumber/);
  });

  it('only ever sends the token to the Coda API hosts', () => {
    expect(readCodaConfig({ ...ENV, CODA_API_BASE: 'https://docs.superhuman.com/apis/v1/' }).apiBase).toBe(
      'https://docs.superhuman.com/apis/v1',
    );
    expect(() => readCodaConfig({ ...ENV, CODA_API_BASE: 'https://evil.example.com/apis/v1' })).toThrow();
    expect(() => readCodaConfig({ ...ENV, CODA_API_BASE: 'http://coda.io/apis/v1' })).toThrow();
  });

  it('a setup mistake gives an error for every lookup, never demo data, and the log says what to fix', async () => {
    const logs: string[] = [];
    const fetchMock = vi.fn();
    const a = getCertAdapter({ ...ENV, CODA_COLUMN_MAP: '{"grde":"Grade"}' }, fetchMock as unknown as typeof fetch, (m) => logs.push(m));
    expect(a.mode).toBe('live');
    await expect(a.getCertificate('PNA-1001')).rejects.toBeInstanceOf(CertAdapterError);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(logs.join(' ')).toMatch(/unknown field "grde"/);
  });

  it('the cache id changes with the doc, table or column map', () => {
    const id = (env: CodaEnv) => getCertAdapter(env, vi.fn() as unknown as typeof fetch).id;
    expect(id(ENV)).toBe(id(ENV));
    expect(id(ENV)).not.toBe(id({ ...ENV, CODA_TABLE_ID: 'Other' }));
    expect(id(ENV)).not.toBe(id({ ...ENV, CODA_COLUMN_MAP: '{"grade":"Final Grade"}' }));
  });
});

describe('Coda lookup', () => {
  it('finds a certificate with an exact query on the number column, by column name, simple values', async () => {
    const { adapter, params } = setup(async () => json({ items: [row(morgan)] }));
    const c = await adapter.getCertificate('PNA-1001');
    expect(c).toMatchObject({
      certNumber: 'PNA-1001',
      coinDescription: '1921 Morgan dollar',
      grade: 'MS 64',
      year: '1921',
      countryDenomination: 'United States, Morgan dollar',
      strikeScore: '4/5',
      surfaceScore: '4/5',
      notes: 'Original surfaces.',
      obverseUrl: morgan.Obverse,
      reverseUrl: morgan.Reverse,
      dateGraded: '2026-10-30',
    });
    const p = params(0);
    expect(p.get('query')).toBe('"Cert #":"PNA-1001"');
    expect(p.get('useColumnNames')).toBe('true');
    expect(p.get('valueFormat')).toBe('simpleWithArrays');
  });

  it('answers not found when no row matches (and tries a bare number for a Number column)', async () => {
    const { adapter, fetchMock, params } = setup(async () => json({ items: [] }));
    expect(await adapter.getCertificate('12345')).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(params(0).get('query')).toBe('"Cert #":"12345"');
    expect(params(1).get('query')).toBe('"Cert #":12345');
    expect(await adapter.getCertificate('PNA-9')).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('finds a certificate stored as a number', async () => {
    const { adapter } = setup(async (url) =>
      new URL(url).searchParams.get('query') === '"Cert #":12345'
        ? json({ items: [row({ ...morgan, 'Cert #': 12345 })] })
        : json({ items: [] }),
    );
    expect(await adapter.getCertificate('12345')).toMatchObject({ certNumber: '12345', grade: 'MS 64' });
  });

  it('ignores rows that are not exactly the number asked', async () => {
    const { adapter } = setup(async () => json({ items: [row({ ...morgan, 'Cert #': 'PNA-10010' })] }));
    expect(await adapter.getCertificate('PNA-1001')).toBeNull();
  });

  it('with duplicate rows, shows the most recently updated one and logs it', async () => {
    const { adapter, logs } = setup(async () =>
      json({
        items: [
          row({ ...morgan, Grade: 'MS 62' }, '2026-09-01T00:00:00.000Z', 'i-old'),
          row({ ...morgan, Grade: 'MS 64' }, '2026-10-15T00:00:00.000Z', 'i-new'),
          row({ ...morgan, Grade: 'MS 63' }, '2026-10-01T00:00:00.000Z', 'i-mid'),
        ],
      }),
    );
    expect((await adapter.getCertificate('PNA-1001'))?.grade).toBe('MS 64');
    expect(logs.join(' ')).toMatch(/3 rows share certificate number PNA-1001/);
  });

  it('a matching row without a coin or grade is an error, not "not found"', async () => {
    const { adapter, logs } = setup(async () => json({ items: [row({ 'Cert #': 'PNA-1001', Coin: '' })] }));
    await expect(adapter.getCertificate('PNA-1001')).rejects.toMatchObject({ kind: 'upstream' });
    expect(logs.join(' ')).toMatch(/CODA_COLUMN_MAP/);
  });
});

describe('Coda column mapping and photos', () => {
  it('joins listed columns, reads lookups, drops booleans', () => {
    const m = parseCodaColumnMap(
      JSON.stringify({ certNumber: 'Cert', coinDescription: ['Year', 'Denomination', 'Variety'], grade: 'Grade', countryDenomination: 'Country' }),
    );
    const c = mapCodaRow(
      { Cert: 'A-1', Year: 1921, Denomination: 'Morgan dollar', Variety: '', Grade: 'AU 58', Country: [{ name: 'United States' }], Notes: true },
      m,
    );
    expect(c).toMatchObject({ certNumber: 'A-1', coinDescription: '1921 Morgan dollar', grade: 'AU 58', countryDenomination: 'United States' });
    expect(c?.notes).toBeUndefined();
  });

  it('takes obverse and reverse from one Photos column holding both images', () => {
    const m = parseCodaColumnMap('{"obverseUrl":"Photos","reverseUrl":"Photos"}');
    const c = mapCodaRow({ ...morgan, Photos: ['https://codahosted.io/a/obv', 'https://codahosted.io/a/rev'] }, m);
    expect(c?.obverseUrl).toBe('https://codahosted.io/a/obv');
    expect(c?.reverseUrl).toBe('https://codahosted.io/a/rev');
  });

  it('reads image links from strings, lists and rich ImageObjects; skips deleted images and non-https links', () => {
    expect(cellPhotos('https://codahosted.io/x/1, https://codahosted.io/x/2')).toEqual(['https://codahosted.io/x/1', 'https://codahosted.io/x/2']);
    expect(cellPhotos([{ '@type': 'ImageObject', url: 'https://codahosted.io/x/3', status: 'live' }])).toEqual(['https://codahosted.io/x/3']);
    expect(cellPhotos({ '@type': 'ImageObject', url: 'https://codahosted.io/x/4', status: 'deleted' })).toEqual([]);
    expect(cellPhotos('http://insecure.example.com/a.jpg')).toEqual([]);
    expect(cellPhotos('javascript:alert(1)')).toEqual([]);
    expect(cellPhotos('```https://codahosted.io/x/5```')).toEqual(['https://codahosted.io/x/5']);
  });

  it('an http photo never reaches the visitor', async () => {
    const { adapter } = setup(async () => json({ items: [row({ ...morgan, Obverse: 'http://x.example.com/a.jpg' })] }));
    const deps = { adapter, store: new MemoryStore(), limiter: new RateLimiter(), now: () => 0 };
    const body = await (await handleVerify(new Request('https://s.example/api/verify?cert=PNA-1001'), 'ip', deps)).json();
    expect(body.certificate.obverseUrl).toBeUndefined();
    expect(body.certificate.reverseUrl).toBe(morgan.Reverse);
  });
});

describe('Coda errors and rate limits', () => {
  it('waits for Retry-After on 429 and then succeeds', async () => {
    let n = 0;
    const { adapter, sleeps } = setup(async () => (n++ === 0 ? json({ statusCode: 429 }, 429, { 'Retry-After': '2' }) : json({ items: [row(morgan)] })));
    expect((await adapter.getCertificate('PNA-1001'))?.grade).toBe('MS 64');
    expect(sleeps).toEqual([2000]);
  });

  it('gives up as "busy" when Coda asks for a longer wait than a visitor should sit through', async () => {
    const { adapter, sleeps, fetchMock } = setup(async () => json({}, 429, { 'Retry-After': '30' }));
    await expect(adapter.getCertificate('PNA-1001')).rejects.toMatchObject({ kind: 'busy' });
    expect(sleeps).toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('reads Retry-After as seconds or a date, else backs off exponentially', () => {
    const r = (h?: string) => new Response('', { status: 429, headers: h ? { 'Retry-After': h } : {} });
    expect(retryDelayMs(r('3'), 0)).toBe(3000);
    expect(retryDelayMs(r(new Date(10_000).toUTCString()), 0, 4_000)).toBe(6000);
    expect(retryDelayMs(r(), 2)).toBe(4000);
  });

  it('401/403 are "auth"; 404 and 400 are setup errors; 5xx is retried once then "upstream"', async () => {
    for (const [status, kind, hint] of [
      [401, 'auth', /401/],
      [403, 'auth', /403/],
      [404, 'upstream', /CODA_DOC_ID/],
      [400, 'upstream', /CODA_COLUMN_MAP/],
    ] as const) {
      const { adapter, logs } = setup(async () => json({ message: 'detail' }, status));
      await expect(adapter.getCertificate('A1')).rejects.toMatchObject({ kind });
      expect(logs.join(' ')).toMatch(hint);
    }
    const s = setup(async () => json({}, 503));
    await expect(s.adapter.getCertificate('A1')).rejects.toMatchObject({ kind: 'upstream' });
    expect(s.fetchMock).toHaveBeenCalledTimes(2);
  });

  it('the token never appears in replies, logs or error messages', async () => {
    const leaky = `bad token ${TOKEN} for doc AbCDeFGH at internal-host`;
    for (const status of [400, 401, 403, 404, 429, 500, 502]) {
      const { adapter, logs } = setup(async () => new Response(leaky, { status, headers: { 'Retry-After': '999' } }));
      const deps = { adapter, store: new MemoryStore(), limiter: new RateLimiter(), now: () => 0, log: (m: string) => logs.push(m) };
      const text = await (await handleVerify(new Request('https://s.example/api/verify?cert=A1'), 'ip', deps)).text();
      expect(text).not.toContain(TOKEN);
      expect(text).not.toContain('internal-host');
      expect(logs.join(' ')).not.toContain(TOKEN);
      expect(logs.join(' ')).not.toContain('internal-host');
      const err = await adapter.getCertificate('A1').catch((e: Error) => e);
      expect(String((err as Error).message)).not.toContain(TOKEN);
    }
  });
});

describe('Coda population (listAll)', () => {
  const pages: Record<string, unknown> = {
    first: { items: [row(morgan), row({ ...morgan, 'Cert #': 'PNA-1002', Grade: 'MS 65' })], nextPageToken: 'p2' },
    p2: { items: [row({ ...morgan, 'Cert #': 'PNA-1003', Grade: 'AU 58' }), row({ 'Cert #': 'BLANK' })], nextPageToken: 'p3' },
    p3: { items: [row({ ...morgan, 'Cert #': 'PNA-1004' })] },
  };
  const pager = async (url: string) => json(pages[new URL(url).searchParams.get('pageToken') ?? 'first']);

  it('follows nextPageToken, sending only the token on later pages, and skips unusable rows', async () => {
    const { adapter, fetchMock, params, logs } = setup(pager);
    const all = await adapter.listAll!();
    expect(all.map((c) => c.certNumber)).toEqual(['PNA-1001', 'PNA-1002', 'PNA-1003', 'PNA-1004']);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(params(0).get('useColumnNames')).toBe('true');
    expect(params(0).get('limit')).toBe('500');
    expect([...params(1).keys()]).toEqual(['pageToken']);
    expect(logs.join(' ')).toMatch(/skipped 1 row/);
  });

  it('visitors arriving together share one scan', async () => {
    const { adapter, fetchMock } = setup(pager);
    await Promise.all([adapter.listAll!(), adapter.listAll!(), adapter.listAll!()]);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('is cached for an hour by the population loader, so visitors do not trigger a full scan each time', async () => {
    const { adapter, fetchMock } = setup(pager);
    const store = new MemoryStore();
    let t = 0;
    const deps = { adapter, store, now: () => t };
    const first = await loadPopulation(deps);
    expect(first).toMatchObject({ kind: 'report', demo: false });
    if (first.kind === 'report') expect(first.report.total).toBe(4);
    t += 30 * 60 * 1000;
    await loadPopulation(deps);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    t += 31 * 60 * 1000;
    await loadPopulation(deps);
    expect(fetchMock).toHaveBeenCalledTimes(6);
  });

  it('retries a 429 during the scan and stops at the page limit', async () => {
    let n = 0;
    const { adapter, sleeps } = setup(async (url) => (n++ === 1 ? json({}, 429, { 'Retry-After': '5' }) : pager(url)));
    expect(await adapter.listAll!()).toHaveLength(4);
    expect(sleeps).toEqual([5000]);

    const endless = createCodaAdapter({
      config: readCodaConfig(ENV),
      fetch: (async () => json({ items: [], nextPageToken: 'again' })) as unknown as typeof fetch,
      maxPages: 3,
    });
    await expect(endless.listAll!()).rejects.toMatchObject({ kind: 'upstream' });
  });
});
