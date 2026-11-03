/**
 * Studio sign-in: one email + password. The password is checked against a bcrypt hash held in an env var; a signed,
 * HttpOnly session cookie follows. Failed attempts are limited per visitor and the account locks for a while after
 * repeated failures. Nothing secret is logged; IP addresses are stored only as keyed hashes.
 *
 * Policy (see docs/STUDIO_SETUP.md):
 * - at most 10 sign-in attempts per 15 minutes from one address;
 * - 5 wrong passwords in a row from one address lock sign-in from that address for 15 minutes;
 * - 30 wrong passwords within an hour from anywhere lock the account for 15 minutes (a slow, spread-out attack).
 */
import bcrypt from 'bcryptjs';
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import type { StudioConfig } from './config';

export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const IP_WINDOW_MS = 15 * 60 * 1000;
export const IP_MAX_ATTEMPTS = 10;
export const LOCK_AFTER_FAILS = 5;
export const LOCK_MS = 15 * 60 * 1000;
export const ACCOUNT_WINDOW_MS = 60 * 60 * 1000;
export const ACCOUNT_MAX_FAILS = 30;

/** A small key-value store with expiry: Netlify Blobs in production, memory in development and tests. */
export interface AuthKV {
  get(key: string): Promise<unknown | null>;
  set(key: string, value: unknown): Promise<void>;
}

export class MemoryKV implements AuthKV {
  m = new Map<string, unknown>();
  async get(k: string) {
    return this.m.has(k) ? structuredClone(this.m.get(k)) : null;
  }
  async set(k: string, v: unknown) {
    this.m.set(k, structuredClone(v));
  }
}

// ------------------------------------------------------------------------------------------------ sessions

const b64url = (s: string | Buffer) => Buffer.from(s).toString('base64url');

export function cookieName(cfg: Pick<StudioConfig, 'secure'>) {
  return cfg.secure ? '__Host-studio_session' : 'studio_session';
}

/** Changes whenever the password (hash) changes, so a new password signs everyone out. */
function passwordVersion(cfg: StudioConfig) {
  return createHash('sha256').update(cfg.passwordHash).digest('base64url').slice(0, 12);
}

function sign(cfg: StudioConfig, data: string) {
  return createHmac('sha256', cfg.sessionSecret).update(data).digest('base64url');
}

export interface Session {
  email: string;
  iat: number;
  exp: number;
}

export function createSession(cfg: StudioConfig, now = Date.now()): string {
  const payload = b64url(JSON.stringify({ sub: cfg.email, iat: now, exp: now + SESSION_TTL_MS, pv: passwordVersion(cfg) }));
  return `v1.${payload}.${sign(cfg, `v1.${payload}`)}`;
}

export function readSession(cfg: StudioConfig, token: string | undefined | null, now = Date.now()): Session | null {
  if (!token || cfg.loginProblems.length) return null;
  const parts = token.split('.');
  if (parts.length !== 3 || parts[0] !== 'v1') return null;
  const expected = Buffer.from(sign(cfg, `v1.${parts[1]}`));
  const given = Buffer.from(parts[2]);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  try {
    const p = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8')) as { sub: string; iat: number; exp: number; pv: string };
    if (p.sub !== cfg.email || p.pv !== passwordVersion(cfg) || typeof p.exp !== 'number' || p.exp <= now) return null;
    return { email: p.sub, iat: p.iat, exp: p.exp };
  } catch {
    return null;
  }
}

export function sessionCookie(cfg: StudioConfig, token: string): string {
  return [
    `${cookieName(cfg)}=${token}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}`,
    ...(cfg.secure ? ['Secure'] : []),
  ].join('; ');
}

export function clearCookie(cfg: StudioConfig): string {
  return [`${cookieName(cfg)}=`, 'Path=/', 'HttpOnly', 'SameSite=Lax', 'Max-Age=0', ...(cfg.secure ? ['Secure'] : [])].join('; ');
}

export function readCookie(header: string | null, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i > 0 && part.slice(0, i).trim() === name) return part.slice(i + 1).trim();
  }
  return null;
}

// ------------------------------------------------------------------------------------------------ sign-in

// A real bcrypt hash of a random string: compared against when the email is wrong, so timing does not reveal it.
const DUMMY_HASH = '$2b$12$ZfPmX3534Ke6V.LR20A.S.RfHEE3qmPb8iS2CYiRMCEfTjR5KjpA6';

export type LoginResult =
  | { ok: true; token: string }
  | { ok: false; reason: 'invalid' | 'locked' | 'rate' | 'unconfigured'; retryAfterSec?: number };

interface Counter {
  n: number;
  start: number;
}
interface Lock {
  fails: number;
  until: number;
}

function ipKey(cfg: StudioConfig, ip: string) {
  return createHmac('sha256', cfg.sessionSecret || 'x').update(`ip:${ip}`).digest('base64url').slice(0, 24);
}

const asCounter = (v: unknown): Counter => (v && typeof v === 'object' ? (v as Counter) : { n: 0, start: 0 });
const asLock = (v: unknown): Lock => (v && typeof v === 'object' ? (v as Lock) : { fails: 0, until: 0 });

export async function attemptLogin(args: {
  cfg: StudioConfig;
  kv: AuthKV;
  ip: string;
  email: string;
  password: string;
  now?: number;
}): Promise<LoginResult> {
  const { cfg, kv } = args;
  const now = args.now ?? Date.now();
  if (cfg.loginProblems.length) return { ok: false, reason: 'unconfigured' };
  const ik = ipKey(cfg, args.ip || 'unknown');

  // 1. attempts per address
  let rate = asCounter(await kv.get(`rate:${ik}`));
  if (now - rate.start > IP_WINDOW_MS) rate = { n: 0, start: now };
  if (rate.n >= IP_MAX_ATTEMPTS) return { ok: false, reason: 'rate', retryAfterSec: Math.ceil((rate.start + IP_WINDOW_MS - now) / 1000) };
  rate.n++;
  await kv.set(`rate:${ik}`, rate);

  // 2. locks (this address, then the whole account)
  const lock = asLock(await kv.get(`lock:${ik}`));
  if (lock.until > now) return { ok: false, reason: 'locked', retryAfterSec: Math.ceil((lock.until - now) / 1000) };
  let acct = asCounter(await kv.get('acct'));
  if (now - acct.start > ACCOUNT_WINDOW_MS) acct = { n: 0, start: now };
  const acctLock = asLock(await kv.get('acct-lock'));
  if (acctLock.until > now) return { ok: false, reason: 'locked', retryAfterSec: Math.ceil((acctLock.until - now) / 1000) };

  // 3. the check itself (always runs bcrypt, so a wrong email takes as long as a wrong password)
  const email = String(args.email ?? '').trim().toLowerCase();
  const password = String(args.password ?? '');
  const emailOk = email.length > 0 && email.length <= 200 && safeEqual(email, cfg.email);
  const pwOk = password.length > 0 && password.length <= 200 && (await bcrypt.compare(password, emailOk ? cfg.passwordHash : DUMMY_HASH));

  if (emailOk && pwOk) {
    await kv.set(`lock:${ik}`, { fails: 0, until: 0 });
    return { ok: true, token: createSession(cfg, now) };
  }
  const fails = lock.fails + 1;
  await kv.set(`lock:${ik}`, fails >= LOCK_AFTER_FAILS ? { fails: 0, until: now + LOCK_MS } : { fails, until: 0 });
  acct.n++;
  await kv.set('acct', acct);
  if (acct.n >= ACCOUNT_MAX_FAILS) {
    await kv.set('acct-lock', { fails: 0, until: now + LOCK_MS });
    await kv.set('acct', { n: 0, start: now });
  }
  return { ok: false, reason: 'invalid' };
}

function safeEqual(a: string, b: string) {
  const x = createHash('sha256').update(a).digest();
  const y = createHash('sha256').update(b).digest();
  return timingSafeEqual(x, y);
}

/** For scripts/studio-hash.mjs and tests. */
export async function hashPassword(password: string, rounds = 12) {
  return bcrypt.hash(password, rounds);
}
