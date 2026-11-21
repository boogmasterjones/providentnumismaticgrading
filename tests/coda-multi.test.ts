/**
 * The owner's real Coda layout: one doc per prefix, one table per batch, the number in "Invoice Num1".
 * Mocked Coda (no network). The privacy tests put a sentinel in every private column and fail if it shows up in a
 * reply, the cache or a log line.
 */
import { describe, expect, it, vi } from 'vitest';
import { getCertAdapter } from '../src/lib/certs/adapter';
import {
  PRIVATE_COLUMNS,
  PUBLIC_COLUMNS,
  TABLES_REFRESH_MS,
  canonicalCertNumber,
  createCodaMultiAdapter,
  lineCandidates,
  mapPublicRow,
  parseCertNumber,
  parseCodaDocs,
  pickPublic,
  readCodaMultiConfig,
} from '../src/lib/certs/providers/coda-multi';
import { MemoryStore, RateLimiter, handleVerify } from '../src/lib/certs/verify';

const TOKEN = 'secret-token-xyz';
const DOCS = { A: 'romanDoc', U: 'usDoc', W: 'worldDoc', M: 'medalDoc' };
const ENV = { CODA_DOCS: JSON.stringify(DOCS), CODA_API_TOKEN: TOKEN };
const SECRET = 'PRIVATE-SENTINEL';

/** Every private column filled with a sentinel, plus an unknown extra column. */
const privateCells = () => ({
  'Pur Price': `$1,234 ${SECRET}`,
  '+ 20%': `$1,480 ${SECRET}`,
  'Sell Price': `$1,999 ${SECRET}`,
  Notes: `Bought at CNG lot 341 ${SECRET}`,
  Link: `https://www.cngcoins.com/Lot.aspx?LOT_ID=1&${SECRET}`,
  '2nd Link': `https://numismatics.org/ocre/id/ric.4?${SECRET}`,
  'Web Link': `https://example.com/${SECRET}`,
  'Created on': `2026-01-01T00:00:00Z ${SECRET}`,
  'Some New Column': SECRET,
});

const romanRow = (over: Record<string, unknown> = {}) => ({
  'Invoice Num1': 'A400107-133',
  'Line Num1': '133',
  'Inovice Only': 'A400107',
  TITLE: 'Roman Empire',
  DATE: 'AD 251-253',
  METAL: 'AE',
  DENOMINATION: 'Antoninianus',
  EMPEROR: 'Treb. Gallus',
  LINE4: 'Rv: Pax w/branch, scept.',
  LINE5: 'Mediolanum',
  RIC_NUMBER: '71',
  RIC_NUM2: 'RIC-71',
  'CRAW_NUM 2': 'Craw-',
  RPC_NUMBER: '',
  WEIGHT: '4.09',
  'Weight Full': '4.09g',
  'mm full': 'mm',
  GRADE: 'MS',
  ST: 5,
  SR: 4,
  COM1: '',
  COM2: '',
  STYLE: '',
  Image: ['https://codahosted.io/docs/x/blobs/obv.jpg', 'https://codahosted.io/docs/x/blobs/rev.jpg'],
  'Image URL': `https://www.acsearch.info/search.html?id=1&${SECRET}`,
  ...privateCells(),
  ...over,
});

const usRow = (over: Record<string, unknown> = {}) => ({
  'Invoice Num1': 'U102703-001',
  TITLE: '',
  DATE: '1854',
  METAL: '',
  DENOMINATION: 'G$1',
  LINE4: '',
  LINE5: '',
  Attribution: '',
  'MINT MARK': 'Type 2',
  WEIGHT: '',
  GRADE: 'XF Details',
  STRIKE: '',
  COM1: 'Ex-Jewelry',
  Image: '',
  'Image URL': '',
  ...privateCells(),
  ...over,
});

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

function fakeCoda(rows: Record<string, Record<string, unknown>[]>, tables: Record<string, { name: string; id: string }[]>) {
  const calls: string[] = [];
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    calls.push(url);
    expect(new Headers(init?.headers).get('Authorization')).toBe(`Bearer ${TOKEN}`);
    expect(url).not.toContain(TOKEN);
    const u = new URL(url);
    const m = /\/docs\/([^/]+)\/tables(?:\/([^/]+)\/rows)?$/.exec(u.pathname);
    if (!m) return json({}, 404);
    if (!m[2]) return json({ items: tables[decodeURIComponent(m[1])] ?? [] });
    const query = u.searchParams.get('query') ?? '';
    const wanted = JSON.parse(query.slice(query.indexOf(':') + 1)) as string;
    const items = (rows[decodeURIComponent(m[2])] ?? []).filter((r) => r['Invoice Num1'] === wanted).map((values, i) => ({ id: `i-${i}`, values }));
    return json({ items });
  });
  return { fetchMock: fetchMock as unknown as typeof fetch, calls };
}

const TABLES = {
  romanDoc: [
    { name: 'Topics for discussion', id: 'grid-topics' },
    { name: 'A400107', id: 'grid-A400107' },
    { name: 'Copy of A400109', id: 'grid-copy' },
    { name: 'GRADE', id: 'grid-grade' },
  ],
  usDoc: [{ name: 'U102703', id: 'grid-U102703' }],
};

function setup(rows = { 'grid-A400107': [romanRow(), romanRow({ 'Invoice Num1': 'A400107-138', TITLE: '', DENOMINATION: '', EMPEROR: '', GRADE: '' })], 'grid-U102703': [usRow()] }) {
  const { fetchMock, calls } = fakeCoda(rows, TABLES);
  const logs: string[] = [];
  const store = new MemoryStore();
  let t = 1_000_000;
  const adapter = createCodaMultiAdapter({ config: readCodaMultiConfig(ENV), fetch: fetchMock, kv: store, log: (m) => logs.push(m), sleep: async () => {}, now: () => t });
  return { adapter, calls, logs, store, advance: (ms: number) => (t += ms) };
}

describe('certificate numbers', () => {
  it('parses prefix, batch and line, tolerating spaces, lower case and a missing dash', () => {
    expect(parseCertNumber('A400107-133')).toEqual({ prefix: 'A', batch: 'A400107', line: '133' });
    expect(parseCertNumber(' a 400107 - 133 ')).toEqual({ prefix: 'A', batch: 'A400107', line: '133' });
    expect(parseCertNumber('A400107133')).toEqual({ prefix: 'A', batch: 'A400107', line: '133' });
    expect(parseCertNumber('PNA-1001')).toBeNull();
    expect(canonicalCertNumber('u102703-001')).toBe('U102703-1');
    expect(lineCandidates(parseCertNumber('U102703-1')!)).toEqual(['U102703-1', 'U102703-001']);
  });

  it('reads CODA_DOCS and refuses bad keys', () => {
    expect(parseCodaDocs('{"A":"https://coda.io/d/Roman_d2R77RysYRn"}')).toEqual({ A: '2R77RysYRn' });
    expect(() => parseCodaDocs('{"AB":"x"}')).toThrow();
    expect(() => parseCodaDocs('nope')).toThrow();
  });
});

describe('multi-doc lookups', () => {
  it('finds a Roman certificate and maps it to the card', async () => {
    const { adapter, calls } = setup();
    const c = await adapter.getCertificate('A400107-133');
    expect(c).toEqual({
      certNumber: 'A400107-133',
      coinDescription: 'Treb. Gallus, Antoninianus',
      year: 'AD 251-253',
      countryDenomination: 'Roman Empire, AE Antoninianus',
      grade: 'MS',
      strikeScore: '5/5',
      surfaceScore: '4/5',
      notes: 'Rv: Pax w/branch, scept. · Mint: Mediolanum · RIC-71 · 4.09g',
      obverseUrl: 'https://codahosted.io/docs/x/blobs/obv.jpg',
      reverseUrl: 'https://codahosted.io/docs/x/blobs/rev.jpg',
    });
    expect(calls[0]).toContain('/docs/romanDoc/tables?');
    expect(calls[1]).toContain('/tables/grid-A400107/rows?');
    expect(new URL(calls[1]).searchParams.get('query')).toBe('"Invoice Num1":"A400107-133"');
  });

  it('finds a US certificate typed without the zero padding', async () => {
    const { adapter } = setup();
    const c = await adapter.getCertificate('U102703-1');
    expect(c).toMatchObject({ certNumber: 'U102703-001', coinDescription: '1854 Type 2 G$1', grade: 'XF Details', countryDenomination: 'G$1', notes: 'Ex-Jewelry' });
  });

  it('treats blank placeholders, unknown batches, other prefixes and non-batch tables as not found', async () => {
    const { adapter } = setup();
    expect(await adapter.getCertificate('A400107-138')).toBeNull(); // blank placeholder row
    expect(await adapter.getCertificate('A400107-999')).toBeNull(); // no such row
    expect(await adapter.getCertificate('A999999-1')).toBeNull(); // no such batch
    expect(await adapter.getCertificate('B012115-1')).toBeNull(); // prefix not in CODA_DOCS
    expect(await adapter.getCertificate('PNA-1001')).toBeNull(); // not his format
  });

  it('caches the table list (one list call for several lookups) and refreshes it for a new batch after 5 minutes', async () => {
    const { adapter, calls, advance } = setup();
    await adapter.getCertificate('A400107-133');
    await adapter.getCertificate('A400107-999');
    expect(calls.filter((u) => u.includes('/tables?')).length).toBe(1);
    await adapter.getCertificate('A400200-1'); // unknown batch, list is fresh: no refresh
    expect(calls.filter((u) => u.includes('/tables?')).length).toBe(1);
    advance(TABLES_REFRESH_MS);
    await adapter.getCertificate('A400200-1');
    expect(calls.filter((u) => u.includes('/tables?')).length).toBe(2);
  });

  it('end to end: /api/verify shows the card for any spelling and caches it once', async () => {
    const { calls, store } = setup();
    const { fetchMock } = fakeCoda({ 'grid-A400107': [romanRow()] }, TABLES);
    const adapter = getCertAdapter(ENV, fetchMock, () => {}, store);
    const deps = { adapter, store, limiter: new RateLimiter(), now: () => 5 };
    const r1 = await (await handleVerify(new Request('https://x.test/api/verify?cert=a400107133'), '1.1.1.1', deps)).json();
    expect(r1).toMatchObject({ ok: true, found: true, certificate: { certNumber: 'A400107-133', grade: 'MS' } });
    const r2 = await (await handleVerify(new Request('https://x.test/api/verify?cert=A400107-133'), '1.1.1.1', deps)).json();
    expect(r2).toMatchObject({ found: true, cached: true });
    expect(calls.length).toBe(0); // (the first fake was not used)
  });
});

describe('PRIVACY: prices, notes and source links never leak', () => {
  it('pickPublic drops every private and unknown column, for both layouts', () => {
    for (const layout of ['roman', 'label'] as const) {
      const kept = pickPublic({ ...romanRow(), ...usRow() }, layout);
      for (const col of PRIVATE_COLUMNS) expect(kept).not.toHaveProperty([col]);
      expect(kept).not.toHaveProperty(['Some New Column']);
      for (const col of PRIVATE_COLUMNS) expect(PUBLIC_COLUMNS[layout]).not.toContain(col);
    }
  });

  it('nothing private reaches the reply, the cache or the logs', async () => {
    const { store } = setup();
    const logs: string[] = [];
    const rows = {
      'grid-A400107': [romanRow(), romanRow()], // a duplicate, to make the adapter log
      'grid-U102703': [usRow({ 'Image URL': `https://images.cngcoins.com/a.jpg?${SECRET}` })],
    };
    const { fetchMock } = fakeCoda(rows, TABLES);
    const adapter = getCertAdapter(ENV, fetchMock, (m) => logs.push(m), store);
    const deps = { adapter, store, limiter: new RateLimiter(), now: () => 5, log: (m: string) => logs.push(m) };
    const bodies: string[] = [];
    for (const n of ['A400107-133', 'U102703-001', 'A400107-138', 'W300227-001']) {
      bodies.push(await (await handleVerify(new Request(`https://x.test/api/verify?cert=${n}`), '1.1.1.1', deps)).text());
    }
    const cached = JSON.stringify([...(store as unknown as { m: Map<string, unknown> }).m.entries()]);
    const everything = [...bodies, cached, ...logs].join('\n');
    expect(bodies[0]).toContain('Treb. Gallus');
    expect(everything).not.toContain(SECRET);
    for (const word of ['Pur Price', 'Sell Price', '+ 20%', 'cngcoins', 'acsearch', 'Bought at']) expect(everything).not.toContain(word);
  });

  it('mapPublicRow ignores private columns even if one slipped through', () => {
    const c = mapPublicRow(romanRow() as Record<string, unknown>, 'roman');
    expect(JSON.stringify(c)).not.toContain(SECRET);
  });
});
