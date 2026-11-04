import type { APIRoute } from 'astro';
import { attemptLogin, sessionCookie } from '../../../lib/studio/auth';
import { authKV, clientIp, config, json, sameOrigin } from '../../../lib/studio/server';

export const prerender = false;

const MESSAGES = {
  invalid: 'That email and password do not match. Check them and try again.',
  locked: 'Too many wrong passwords. For your safety, sign-in is paused for a few minutes.',
  rate: 'Too many attempts. Wait a few minutes, then try again.',
  unconfigured: 'Studio sign-in is not set up yet (see docs/STUDIO_SETUP.md).',
} as const;

/** Sign in: a JSON fetch from the sign-in page, or a plain form post (works without JavaScript). */
export const POST: APIRoute = async (ctx) => {
  const { request } = ctx;
  const isForm = (request.headers.get('content-type') ?? '').includes('application/x-www-form-urlencoded');
  if (!sameOrigin(request)) return json({ error: 'Blocked.' }, 403);
  let email = '';
  let password = '';
  let next = '/admin';
  try {
    if (isForm) {
      const f = await request.formData();
      email = String(f.get('email') ?? '');
      password = String(f.get('password') ?? '');
      next = String(f.get('next') ?? '/admin');
    } else {
      const b = (await request.json()) as { email?: string; password?: string; next?: string };
      email = String(b.email ?? '');
      password = String(b.password ?? '');
      next = String(b.next ?? '/admin');
    }
  } catch {
    return json({ error: 'That request could not be read.' }, 400);
  }
  // only ever go back to a Studio page
  if (!/^\/admin(\/[\w\-/]*)?(\?[\w=&%.-]*)?(#[\w\-/=&%.?]*)?$/.test(next) || next.startsWith('/admin/login')) next = '/admin';
  const cfg = config();
  const r = await attemptLogin({ cfg, kv: authKV(), ip: clientIp(ctx), email, password });
  if (r.ok) {
    const cookie = sessionCookie(cfg, r.token);
    if (isForm) return new Response(null, { status: 303, headers: { Location: next, 'Set-Cookie': cookie, 'Cache-Control': 'no-store' } });
    return json({ ok: true, next }, 200, { 'Set-Cookie': cookie });
  }
  if (isForm) {
    return new Response(null, {
      status: 303,
      headers: { Location: `/admin/login?error=${r.reason}&next=${encodeURIComponent(next)}`, 'Cache-Control': 'no-store' },
    });
  }
  const status = r.reason === 'unconfigured' ? 503 : r.reason === 'invalid' ? 401 : 429;
  const headers: Record<string, string> = r.retryAfterSec ? { 'Retry-After': String(r.retryAfterSec) } : {};
  return json({ error: MESSAGES[r.reason], retryAfterSec: r.retryAfterSec }, status, headers);
};
