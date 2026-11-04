/** Provident Studio sign-in: configuration, password check, session cookie, rate limit and lockouts. */
import { describe, expect, it } from 'vitest';
import bcrypt from 'bcryptjs';
import {
  ACCOUNT_MAX_FAILS,
  IP_MAX_ATTEMPTS,
  LOCK_AFTER_FAILS,
  LOCK_MS,
  MemoryKV,
  SESSION_TTL_MS,
  attemptLogin,
  clearCookie,
  cookieName,
  createSession,
  readCookie,
  readSession,
  sessionCookie,
} from '../src/lib/studio/auth';
import { decodeHash, readConfig } from '../src/lib/studio/config';
import { editor } from '../src/lib/edit';

const HASH = bcrypt.hashSync('correct horse battery', 4); // low cost: tests only
const env = {
  STUDIO_EMAIL: 'Owner@Example.test',
  STUDIO_PASSWORD_HASH: HASH,
  STUDIO_SESSION_SECRET: 'a'.repeat(40),
};
const cfg = readConfig(env, { dev: false });
const now = Date.UTC(2026, 10, 2, 15);

describe('configuration', () => {
  it('reads the sign-in settings and picks the storage', () => {
    expect(cfg).toMatchObject({ email: 'owner@example.test', storage: 'none', secure: true, loginProblems: [] });
    expect(readConfig(env, { dev: true }).storage).toBe('local');
    expect(readConfig({ ...env, STUDIO_STORAGE: 'local' }).storage).toBe('local');
    const gh = readConfig({ ...env, STUDIO_GITHUB_REPO: 'owner/site', STUDIO_GITHUB_APP_ID: '1', STUDIO_GITHUB_APP_PRIVATE_KEY: 'k' });
    expect(gh.storage).toBe('github');
    expect(gh.github).toMatchObject({ repo: 'owner/site', liveBranch: 'main', draftsBranch: 'studio-drafts' });
  });

  it('explains what is missing, and never treats a missing setting as "no password"', () => {
    const c = readConfig({}, { dev: true });
    expect(c.loginProblems).toHaveLength(3);
    expect(readConfig({ ...env, STUDIO_SESSION_SECRET: 'short' }).loginProblems[0]).toMatch(/32 characters/);
    expect(readConfig({ ...env, STUDIO_GITHUB_REPO: 'not a repo' }).storage).toBe('none');
    expect(readConfig({ ...env, STUDIO_GITHUB_REPO: 'o/r', STUDIO_GITHUB_APP_ID: '1', STUDIO_GITHUB_APP_PRIVATE_KEY: 'k', STUDIO_DRAFTS_BRANCH: 'main' }).storage).toBe('none');
  });

  it('accepts the hash as is or base64-encoded (some .env loaders mangle "$")', () => {
    expect(decodeHash(HASH)).toBe(HASH);
    expect(decodeHash(Buffer.from(HASH).toString('base64'))).toBe(HASH);
    expect(readConfig({ ...env, STUDIO_PASSWORD_HASH: Buffer.from(HASH).toString('base64') }).loginProblems).toEqual([]);
  });
});

describe('session cookie', () => {
  it('is signed, HttpOnly, Secure and SameSite', () => {
    const c = sessionCookie(cfg, createSession(cfg, now));
    expect(c).toMatch(/^__Host-studio_session=v1\./);
    expect(c).toContain('HttpOnly');
    expect(c).toContain('Secure');
    expect(c).toContain('SameSite=Lax');
    expect(c).toContain('Path=/');
    expect(clearCookie(cfg)).toContain('Max-Age=0');
    expect(cookieName(readConfig(env, { dev: true }))).toBe('studio_session');
  });

  it('is accepted until it expires, and rejected when tampered with', () => {
    const t = createSession(cfg, now);
    expect(readSession(cfg, t, now + 1000)?.email).toBe('owner@example.test');
    expect(readSession(cfg, t, now + SESSION_TTL_MS + 1)).toBeNull();
    const [v, p, s] = t.split('.');
    const forged = Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(p, 'base64url').toString()), exp: now * 2 })).toString('base64url');
    expect(readSession(cfg, `${v}.${forged}.${s}`, now)).toBeNull();
    expect(readSession(cfg, `${v}.${p}.${s.slice(0, -2)}xx`, now)).toBeNull();
    expect(readSession(cfg, 'garbage', now)).toBeNull();
    expect(readSession(cfg, null, now)).toBeNull();
  });

  it('stops working when the password, the email or the secret changes', () => {
    const t = createSession(cfg, now);
    expect(readSession(readConfig({ ...env, STUDIO_PASSWORD_HASH: bcrypt.hashSync('new', 4) }), t, now)).toBeNull();
    expect(readSession(readConfig({ ...env, STUDIO_EMAIL: 'other@example.test' }), t, now)).toBeNull();
    expect(readSession(readConfig({ ...env, STUDIO_SESSION_SECRET: 'b'.repeat(40) }), t, now)).toBeNull();
    expect(readSession(readConfig({}), t, now)).toBeNull();
  });

  it('is read from the Cookie header', () => {
    expect(readCookie('a=1; studio_session=v1.x.y; b=2', 'studio_session')).toBe('v1.x.y');
    expect(readCookie(null, 'studio_session')).toBeNull();
  });
});

describe('signing in', () => {
  const login = (kv: MemoryKV, password: string, ip = '203.0.113.5', t = now, email = 'owner@example.test') =>
    attemptLogin({ cfg, kv, ip, email, password, now: t });

  it('signs in with the right email (any capitals) and password', async () => {
    const r = await attemptLogin({ cfg, kv: new MemoryKV(), ip: '1.1.1.1', email: ' OWNER@example.TEST ', password: 'correct horse battery', now });
    expect(r.ok).toBe(true);
    if (r.ok) expect(readSession(cfg, r.token, now)?.email).toBe('owner@example.test');
  });

  it('gives the same answer for a wrong email and a wrong password', async () => {
    expect(await login(new MemoryKV(), 'wrong')).toEqual({ ok: false, reason: 'invalid' });
    expect(await login(new MemoryKV(), 'correct horse battery', '1.1.1.1', now, 'someone@else.test')).toEqual({ ok: false, reason: 'invalid' });
  });

  it(`locks one address for ${LOCK_MS / 60000} minutes after ${LOCK_AFTER_FAILS} wrong passwords in a row`, async () => {
    const kv = new MemoryKV();
    for (let i = 0; i < LOCK_AFTER_FAILS; i++) expect((await login(kv, 'wrong')).ok).toBe(false);
    const locked = await login(kv, 'correct horse battery');
    expect(locked).toMatchObject({ ok: false, reason: 'locked' });
    expect(await login(kv, 'correct horse battery', '198.51.100.7')).toMatchObject({ ok: true }); // another address is not locked
    expect(await login(kv, 'correct horse battery', '203.0.113.5', now + LOCK_MS + 1)).toMatchObject({ ok: true });
  });

  it(`limits one address to ${IP_MAX_ATTEMPTS} attempts per 15 minutes, right or wrong`, async () => {
    const kv = new MemoryKV();
    for (let i = 0; i < IP_MAX_ATTEMPTS; i++) await login(kv, i % 2 ? 'correct horse battery' : 'wrong', '192.0.2.1', now + i);
    expect(await login(kv, 'correct horse battery', '192.0.2.1', now + 20)).toMatchObject({ ok: false, reason: 'rate' });
  });

  it(`locks the account after ${ACCOUNT_MAX_FAILS} failures in an hour from many addresses`, async () => {
    const kv = new MemoryKV();
    for (let i = 0; i < ACCOUNT_MAX_FAILS; i++) await login(kv, 'wrong', `10.0.${Math.floor(i / 4)}.${i}`, now + i);
    expect(await login(kv, 'correct horse battery', '10.9.9.9', now + 100)).toMatchObject({ ok: false, reason: 'locked' });
  }, 30_000);

  it('stores addresses only as keyed hashes', async () => {
    const kv = new MemoryKV();
    await login(kv, 'wrong', '203.0.113.99');
    expect([...kv.m.keys()].join(' ')).not.toContain('203.0.113.99');
  });

  it('refuses everyone while sign-in is not set up', async () => {
    const r = await attemptLogin({ cfg: readConfig({}), kv: new MemoryKV(), ip: '1.1.1.1', email: '', password: '', now });
    expect(r).toEqual({ ok: false, reason: 'unconfigured' });
  });
});

describe('editing annotations', () => {
  it('add nothing to public pages', () => {
    const e = editor({ locals: {} } as never);
    expect(e('page:home', 'heading')).toEqual({});
    expect(e.item('faq', 'items', 0, 3)).toEqual({});
    expect(e.on).toBe(false);
  });

  it('name the document, field, kind and limits inside the preview', () => {
    const e = editor({ locals: { studio: { edit: true } } } as never);
    expect(e('page:home', 'heading')).toEqual({ 'data-sf': 'page:home|heading', 'data-sf-k': 'line', 'data-sf-label': 'Page heading', 'data-sf-max': '160', 'data-sf-req': '1' });
    expect(e('page:home', 'carousel.0.image')).toMatchObject({ 'data-sf-k': 'image', 'data-sf-alt': 'page:home|carousel.0.alt', 'data-sf-folder': 'home' });
    expect(e('page:about', 'intro')).toMatchObject({ 'data-sf-k': 'text', 'data-sf-links': '1' });
    expect(e('page:about', 'sections.0.mark', { panel: true })['data-sf-k']).toBe('panel');
    expect(e('page:home', 'eyebrow', { raw: 'Venice, Florida' })['data-sf-raw']).toBe('Venice, Florida');
    expect(e.item('faq', 'items', 1, 3)).toEqual({ 'data-sf-item': 'faq|items|1', 'data-sf-n': '3', 'data-sf-noun': 'question', 'data-sf-new': '1' });
    expect(e('page:home', 'nope')).toEqual({});
  });
});
