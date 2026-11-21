/**
 * The Hostinger move: the key-value store (memory, files, MySQL with a fake pool, fallback when the database is
 * down), the form endpoint (honeypot, limits, email, SMTP mocked) and the Node server's headers and visitor address.
 */
import { afterAll, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CREATE_TABLE_SQL, FallbackKV, FileKV, MemoryKV, MySqlKV, getKV, kvKind, readDbSettings, type SqlPool } from '../src/lib/kv';
import { FormLimiter, buildEmail, checkEntry, fromHeader, handleForm, oneLine, type Email, type FormDeps } from '../src/lib/forms';
import { readSmtpSettings } from '../src/lib/mailer';
import { clientIp, CLIENT_IP_HEADER } from '../src/lib/client-ip';
import { IMMUTABLE, baseHeaders, prepare, visitorAddress } from '../server/headers.mjs';

// ------------------------------------------------------------------------------------------------ key-value store

describe('key-value store', () => {
  it('memory: stores copies and forgets after the ttl', async () => {
    let t = 1000;
    const kv = new MemoryKV(undefined, () => t);
    const v = { a: 1 };
    await kv.set('k', v, 500);
    v.a = 2;
    expect(await kv.get('k')).toEqual({ a: 1 });
    t = 1499;
    expect(await kv.get('k')).toEqual({ a: 1 });
    t = 1500;
    expect(await kv.get('k')).toBeNull();
    expect(await kv.get('missing')).toBeNull();
  });

  const dir = mkdtempSync(join(tmpdir(), 'kv-'));
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it('files: survive a new store object (a restart) and honour the ttl', async () => {
    let t = 0;
    const a = new FileKV(dir, 'cert-verify', undefined, () => t);
    await a.set('v1/demo/cert/X', { found: true }, 1000);
    await a.set('forever', 1);
    const b = new FileKV(dir, 'cert-verify', undefined, () => t);
    expect(await b.get('v1/demo/cert/X')).toEqual({ found: true });
    t = 2000;
    expect(await b.get('v1/demo/cert/X')).toBeNull();
    expect(await b.get('forever')).toBe(1);
    // namespaces are separate files
    expect(await new FileKV(dir, 'studio-auth').get('forever')).toBeNull();
  });

  function fakePool() {
    const rows = new Map<string, { v: string; expires_at: number | null }>();
    const calls: string[] = [];
    const pool: SqlPool = {
      async execute(sql, params = []) {
        calls.push(sql.split(/\s+/).slice(0, 3).join(' '));
        if (sql.startsWith('CREATE TABLE')) return [[], []];
        if (sql.startsWith('SELECT')) {
          const r = rows.get(`${params[0]}|${params[1]}`);
          return [r ? [r] : [], []];
        }
        if (sql.startsWith('INSERT')) {
          rows.set(`${params[0]}|${params[1]}`, { v: params[2] as string, expires_at: params[3] as number | null });
          return [[], []];
        }
        if (sql.startsWith('DELETE')) return [[], []];
        throw new Error('unexpected sql');
      },
    };
    return { pool, rows, calls };
  }

  it('MySQL: creates the table once, round-trips JSON, keeps namespaces apart, expires', async () => {
    let t = 100;
    const { pool, rows, calls } = fakePool();
    const a = new MySqlKV(pool, 'cert-verify', undefined, () => t);
    const b = new MySqlKV(pool, 'studio-auth', 60_000, () => t);
    await a.set('k', { n: 1, s: 'é' }, 50);
    await b.set('k', { lock: true });
    expect(await a.get('k')).toEqual({ n: 1, s: 'é' });
    expect(await b.get('k')).toEqual({ lock: true });
    expect(rows.get('studio-auth|k')?.expires_at).toBe(60_100);
    t = 150;
    expect(await a.get('k')).toBeNull();
    expect(calls.filter((c) => c.startsWith('CREATE')).length).toBe(2); // once per store object
    expect(CREATE_TABLE_SQL).toContain('PRIMARY KEY (ns, k)');
  });

  it('falls back to memory (and says why, without details) when the database cannot be reached', async () => {
    const logs: string[] = [];
    const kv = new FallbackKV(
      async () => {
        throw Object.assign(new Error('connect ECONNREFUSED 127.0.0.1:3306 user secret'), { code: 'ECONNREFUSED' });
      },
      new MemoryKV(),
      (m) => logs.push(m),
    );
    await kv.set('k', 1);
    expect(await kv.get('k')).toBe(1);
    expect(logs[0]).toContain('ECONNREFUSED');
    expect(logs.join(' ')).not.toContain('secret');
  });

  it('chooses MySQL only when name, user and password are all set; host defaults to 127.0.0.1', () => {
    expect(readDbSettings({ DB_NAME: 'd', DB_USER: 'u' })).toBeNull();
    expect(readDbSettings({ DB_NAME: 'd', DB_USER: 'u', DB_PASSWORD: 'p' })).toMatchObject({ host: '127.0.0.1', port: 3306 });
    expect(kvKind({ DB_NAME: 'd', DB_USER: 'u', DB_PASSWORD: 'p' })).toBe('mysql');
    expect(kvKind({}, true)).toBe('file');
    expect(kvKind({ KV_DIR: dir })).toBe('file');
    expect(kvKind({})).toBe('memory');
    expect(getKV('x', { env: {} })).toBeInstanceOf(MemoryKV);
  });
});

// ------------------------------------------------------------------------------------------------ forms

const contact = (extra: Record<string, string> = {}) =>
  new URLSearchParams({ 'form-name': 'contact', name: 'Jane Doe', email: 'jane@example.test', phone: '', message: 'Hello\r\nthere', 'bot-field': '', ...extra });

describe('form entries', () => {
  it('accepts a good entry and normalises line endings', () => {
    const r = checkEntry(contact());
    expect(r).toMatchObject({ ok: true, spam: false, form: 'contact', replyTo: 'jane@example.test' });
    if (r.ok && !r.spam) expect(r.values.find((v) => v.field.name === 'message')?.value).toBe('Hello\nthere');
  });

  it('treats a filled honeypot as spam', () => {
    expect(checkEntry(contact({ 'bot-field': 'http://spam' }))).toEqual({ ok: true, spam: true });
  });

  it('rejects unknown forms, missing required fields, bad emails and long values', () => {
    expect(checkEntry(contact({ 'form-name': 'other' }))).toEqual({ ok: false, reason: 'unknown-form' });
    expect(checkEntry(contact({ 'form-name': '__proto__' }))).toEqual({ ok: false, reason: 'unknown-form' });
    expect(checkEntry(contact({ message: '  ' }))).toEqual({ ok: false, reason: 'missing' });
    expect(checkEntry(contact({ email: 'jane@example' }))).toEqual({ ok: false, reason: 'bad-email' });
    expect(checkEntry(contact({ name: 'x'.repeat(201) }))).toEqual({ ok: false, reason: 'too-long' });
  });

  it('builds a plain email with no header injection', () => {
    const r = checkEntry(contact({ name: 'Eve\r\nBcc: victim@example.test' }));
    if (!r.ok || r.spam) throw new Error('expected an entry');
    const e = buildEmail(r, { to: 'owner@example.test', from: 'forms@example.test', siteName: 'Provident', at: new Date(0) });
    expect(e.subject).not.toMatch(/[\r\n]/);
    expect(e.subject).toBe('Contact message: Eve Bcc: victim@example.test');
    expect(e.replyTo).toBe('jane@example.test');
    expect(e.text).toContain('Message:\nHello\nthere');
    expect(e.text).not.toContain('Phone'); // empty fields are left out
    expect(oneLine('a\u0000b\nc')).toBe('a b c');
    expect(fromHeader('Provident Numismatic "Authentication"\r\n', 'forms@example.test')).toBe('"Provident Numismatic Authentication" <forms@example.test>');
  });

  it('limits entries per visitor and per day', () => {
    const l = new FormLimiter(2, 3, 4);
    const h = 3_600_000;
    expect(l.allow('a', 0)).toBe(true);
    expect(l.allow('a', 1)).toBe(true);
    expect(l.allow('a', 2)).toBe(false); // 2 an hour
    expect(l.allow('a', h + 1)).toBe(true);
    expect(l.allow('a', 2 * h + 2)).toBe(false); // 3 a day
    expect(l.allow('b', 3 * h)).toBe(true);
    expect(l.allow('c', 3 * h)).toBe(false); // 4 a day in all
    expect(l.allow('c', 86_400_000)).toBe(true); // next day
  });
});

describe('POST /api/form', () => {
  function deps(over: Partial<FormDeps> = {}) {
    const sent: Email[] = [];
    const logs: string[] = [];
    const d: FormDeps = {
      mailer: { send: async (e) => void sent.push(e) },
      to: 'owner@example.test',
      from: '"Provident" <forms@example.test>',
      siteName: 'Provident',
      phone: '(941) 800-1585',
      contactEmail: '',
      limiter: new FormLimiter(),
      now: () => 0,
      dev: false,
      log: (m) => logs.push(m),
      ...over,
    };
    return { d, sent, logs };
  }
  const post = (body: URLSearchParams, ct = 'application/x-www-form-urlencoded') =>
    new Request('http://x.test/api/form', { method: 'POST', headers: { 'content-type': ct }, body: body.toString() });

  it('emails a good entry and sends the visitor to /thank-you', async () => {
    const { d, sent } = deps();
    const r = await handleForm(post(contact()), '1.2.3.4', d);
    expect(r.status).toBe(303);
    expect(r.headers.get('location')).toBe('/thank-you');
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({ to: 'owner@example.test', from: '"Provident" <forms@example.test>', replyTo: 'jane@example.test' });
  });

  it('drops honeypot entries quietly (looks like success, nothing sent)', async () => {
    const { d, sent } = deps();
    const r = await handleForm(post(contact({ 'bot-field': 'x' })), '1.2.3.4', d);
    expect(r.status).toBe(303);
    expect(sent).toHaveLength(0);
  });

  it('shows a plain problem page with the phone number, never echoing what was typed', async () => {
    const { d } = deps();
    const r = await handleForm(post(contact({ email: '<script>bad' })), '1.2.3.4', d);
    expect(r.status).toBe(400);
    const html = await r.text();
    expect(html).toContain('not sent');
    expect(html).toContain('tel:9418001585');
    expect(html).not.toContain('<script>bad');
  });

  it('says so when SMTP fails or is missing, and logs only the error kind', async () => {
    const failing = deps({ mailer: { send: async () => Promise.reject(Object.assign(new Error('535 auth failed for forms@x'), { code: 'EAUTH' })) } });
    const r = await handleForm(post(contact()), '1.2.3.4', failing.d);
    expect(r.status).toBe(502);
    expect(failing.logs).toEqual(['[form] contact: email failed (EAUTH)']);
    const missing = deps({ mailer: null });
    expect((await handleForm(post(contact()), '1.2.3.4', missing.d)).status).toBe(503);
    const dev = deps({ mailer: null, dev: true });
    expect((await handleForm(post(contact()), '1.2.3.4', dev.d)).status).toBe(303);
  });

  it('rate-limits one visitor and refuses other content types and GET', async () => {
    const { d, sent } = deps({ limiter: new FormLimiter(1, 1, 10) });
    expect((await handleForm(post(contact()), '9.9.9.9', d)).status).toBe(303);
    expect((await handleForm(post(contact()), '9.9.9.9', d)).status).toBe(429);
    expect((await handleForm(post(contact()), '8.8.8.8', d)).status).toBe(303);
    expect(sent).toHaveLength(2);
    expect((await handleForm(post(contact(), 'application/json'), '7.7.7.7', d)).status).toBe(415);
    expect((await handleForm(new Request('http://x.test/api/form'), '7.7.7.7', d)).status).toBe(405);
  });

  it('reads the SMTP settings (Hostinger defaults) only when user and password are set', () => {
    expect(readSmtpSettings({ SMTP_USER: 'forms@x.test' })).toBeNull();
    expect(readSmtpSettings({ SMTP_USER: 'forms@x.test', SMTP_PASSWORD: 'p' })).toMatchObject({
      host: 'smtp.hostinger.com',
      port: 465,
      secure: true,
      to: 'forms@x.test',
      from: 'forms@x.test',
    });
    expect(readSmtpSettings({ SMTP_USER: 'u', SMTP_PASSWORD: 'p', SMTP_PORT: '587', FORM_TO: 'a@x.test' })).toMatchObject({ secure: false, to: 'a@x.test' });
  });
});

// ------------------------------------------------------------------------------------------------ Node server

describe('Node server headers and visitor address', () => {
  it('trusts only the proxy-added (last) X-Forwarded-For entry, and only from a private address', () => {
    expect(visitorAddress('127.0.0.1', '6.6.6.6, 203.0.113.9')).toBe('203.0.113.9');
    expect(visitorAddress('::ffff:10.0.0.2', '203.0.113.9')).toBe('203.0.113.9');
    expect(visitorAddress('198.51.100.7', '6.6.6.6')).toBe('198.51.100.7');
    expect(visitorAddress('127.0.0.1', undefined)).toBe('127.0.0.1');
  });

  function fakeRes() {
    const headers = new Map<string, string>();
    let status = 0;
    const res = {
      hasHeader: (k: string) => headers.has(k.toLowerCase()),
      setHeader: (k: string, v: string) => void headers.set(k.toLowerCase(), v),
      writeHead(s: number) {
        status = s;
        return this;
      },
    };
    return { res, headers, status: () => status };
  }

  it('adds security headers, keeps the app own ones, makes build photos immutable, overwrites a sent IP header', () => {
    const req = { url: '/_img/abc-640.avif', headers: { 'x-forwarded-for': '203.0.113.9', 'x-forwarded-proto': 'https', [CLIENT_IP_HEADER]: 'spoofed' }, socket: { remoteAddress: '127.0.0.1' } };
    const { res, headers } = fakeRes();
    res.setHeader('X-Frame-Options', 'DENY');
    prepare(req, res);
    expect(req.headers[CLIENT_IP_HEADER]).toBe('203.0.113.9');
    res.writeHead(200);
    expect(headers.get('x-frame-options')).toBe('DENY');
    expect(headers.get('x-content-type-options')).toBe('nosniff');
    expect(headers.get('strict-transport-security')).toBe('max-age=31536000');
    expect(headers.get('cache-control')).toBe(IMMUTABLE);

    const page = { url: '/about', headers: {}, socket: { remoteAddress: '198.51.100.7' } };
    const other = fakeRes();
    prepare(page, other.res);
    other.res.writeHead(404);
    expect(other.headers.get('cache-control')).toBeUndefined();
    expect(other.headers.get('strict-transport-security')).toBeUndefined();
    expect(baseHeaders(false)['Referrer-Policy']).toBe('strict-origin-when-cross-origin');
  });

  it('the app reads the server-set address first, then Astro clientAddress', () => {
    const r = new Request('http://x.test/', { headers: { [CLIENT_IP_HEADER]: '203.0.113.9' } });
    expect(clientIp({ request: r, clientAddress: '127.0.0.1' })).toBe('203.0.113.9');
    expect(clientIp({ request: new Request('http://x.test/'), clientAddress: '127.0.0.1' })).toBe('127.0.0.1');
    const throwing = {
      request: new Request('http://x.test/'),
      get clientAddress(): string {
        throw new Error('not available');
      },
    };
    expect(clientIp(throwing)).toBe('');
  });
});
