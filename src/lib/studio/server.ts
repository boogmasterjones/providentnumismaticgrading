/**
 * Server-only wiring for Studio's routes: configuration, the content store, the sign-in limiter store and small
 * HTTP helpers. Never import this from browser code.
 */
import { getStore } from '@netlify/blobs';
import type { APIContext } from 'astro';
import { MemoryKV, readCookie, readSession, cookieName, type AuthKV, type Session } from './auth';
import { readConfig, type StudioConfig } from './config';
import { InstallationTokens } from './github-app';
import { EditError } from './ops';
import { StudioService } from './service';
import { StoreError, type ContentStore } from './store';
import { GitHubStore } from './store-github';
import { LocalStore } from './store-local';

export function config(): StudioConfig {
  return readConfig(process.env, { dev: import.meta.env.DEV });
}

let tokens: { key: string; t: InstallationTokens } | null = null;

export function contentStore(cfg = config()): ContentStore {
  if (cfg.storage === 'github' && cfg.github) {
    const g = cfg.github;
    const key = `${g.appId}:${g.repo}:${g.installationId ?? ''}`;
    if (!tokens || tokens.key !== key) {
      tokens = { key, t: new InstallationTokens({ appId: g.appId, privateKey: g.privateKey, installationId: g.installationId, repo: g.repo }) };
    }
    return new GitHubStore({ repo: g.repo, liveBranch: g.liveBranch, draftsBranch: g.draftsBranch, tokens: tokens.t });
  }
  if (cfg.storage === 'local') return new LocalStore(process.cwd());
  throw new StoreError(cfg.storageProblem ?? 'Studio storage is not set up.', 503);
}

export function service(cfg = config()): StudioService {
  return new StudioService(contentStore(cfg));
}

let memoryKV: MemoryKV | null = null;

/** Netlify Blobs store "studio-auth" on Netlify (strong consistency, so a lock is seen at once); memory locally. */
export function authKV(): AuthKV {
  if (import.meta.env.DEV) return (memoryKV ??= new MemoryKV());
  try {
    const blobs = getStore({ name: 'studio-auth', consistency: 'strong' });
    return {
      async get(key) {
        return (await blobs.get(key, { type: 'json' })) ?? null;
      },
      async set(key, value) {
        await blobs.setJSON(key, value);
      },
    };
  } catch {
    return (memoryKV ??= new MemoryKV());
  }
}

export function currentSession(request: Request, cfg = config()): Session | null {
  return readSession(cfg, readCookie(request.headers.get('cookie'), cookieName(cfg)));
}

export function clientIp(ctx: Pick<APIContext, 'clientAddress' | 'request'>): string {
  try {
    return ctx.clientAddress;
  } catch {
    return ctx.request.headers.get('x-nf-client-connection-ip') ?? '';
  }
}

const NO_STORE = { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow' };

export function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', ...NO_STORE, ...headers } });
}

/**
 * A write request must come from Studio itself: same origin (or no Origin header from a same-site fetch), and
 * JSON or a multipart upload. Together with the SameSite cookie this blocks cross-site request forgery.
 */
export function sameOrigin(request: Request): boolean {
  const origin = request.headers.get('origin');
  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host');
  if (origin) {
    try {
      return new URL(origin).host === host || new URL(origin).host === new URL(request.url).host;
    } catch {
      return false;
    }
  }
  const site = request.headers.get('sec-fetch-site');
  return site === null || site === 'same-origin';
}

/** Wrap a Studio API handler: errors become friendly JSON, never stack traces or provider messages. */
export async function handle(fn: () => Promise<Response>): Promise<Response> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof EditError) return json({ error: e.message, problems: e.details }, e.status);
    if (e instanceof StoreError) {
      console.warn(`[studio] store error ${e.status}`);
      return json({ error: e.message }, e.status);
    }
    console.warn(`[studio] unexpected error: ${e instanceof Error ? e.name : 'unknown'}`);
    return json({ error: 'Something went wrong. Nothing was changed. Try again.' }, 500);
  }
}

export async function readJson<T = Record<string, unknown>>(request: Request): Promise<T> {
  const ct = request.headers.get('content-type') ?? '';
  if (!ct.includes('application/json')) throw new EditError('Expected JSON.', 415);
  const text = await request.text();
  if (text.length > 1_000_000) throw new EditError('That is too much text to save at once.', 413);
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new EditError('That request could not be read.');
  }
}
