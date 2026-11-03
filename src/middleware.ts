/**
 * Guards Provident Studio. Runs only for on-demand routes (public pages are static and pass straight through):
 * - /admin… (except /admin/login) needs a valid session, otherwise it redirects to the sign-in page;
 * - /api/studio/… (except sign-in) needs a valid session (401) and, for writes, a same-origin request (403);
 * - /admin/preview/… gets the drafts in Astro.locals.studio, so the real page templates render them with the
 *   editing annotations. In GitHub mode photo addresses are pointed at the drafts (draft photos are not live yet).
 * Every Studio response is private: no caching, no indexing, framed only by Studio itself.
 */
import { defineMiddleware } from 'astro:middleware';
import { config, currentSession, service } from './lib/studio/server';

const SECURITY_HEADERS: Record<string, string> = {
  'Cache-Control': 'no-store',
  'X-Robots-Tag': 'noindex, nofollow',
  'X-Frame-Options': 'SAMEORIGIN',
  'Content-Security-Policy': "frame-ancestors 'self'",
  'Referrer-Policy': 'same-origin',
  'X-Content-Type-Options': 'nosniff',
};

function withHeaders(res: Response): Response {
  try {
    for (const [k, v] of Object.entries(SECURITY_HEADERS)) if (!res.headers.has(k) || k === 'Cache-Control') res.headers.set(k, v);
    return res;
  } catch {
    // immutable headers (e.g. a redirect): copy into a new response
    const h = new Headers(res.headers);
    for (const [k, v] of Object.entries(SECURITY_HEADERS)) h.set(k, v);
    return new Response(res.body, { status: res.status, statusText: res.statusText, headers: h });
  }
}

const isWrite = (m: string) => !['GET', 'HEAD', 'OPTIONS'].includes(m);

export const onRequest = defineMiddleware(async (ctx, next) => {
  if (ctx.isPrerendered) return next();
  const path = ctx.url.pathname;
  const admin = path === '/admin' || path.startsWith('/admin/');
  const api = path.startsWith('/api/studio/');
  if (!admin && !api) return next();

  const open = path === '/admin/login' || path === '/admin/login/' || path === '/api/studio/login';
  if (open) return withHeaders(await next());

  const cfg = config();
  const session = currentSession(ctx.request, cfg);
  if (!session) {
    if (api) {
      return withHeaders(new Response(JSON.stringify({ error: 'Please sign in again.', signedOut: true }), { status: 401, headers: { 'Content-Type': 'application/json' } }));
    }
    const back = path.startsWith('/admin/preview') ? '/admin' : path + ctx.url.search;
    return withHeaders(ctx.redirect(`/admin/login?next=${encodeURIComponent(back)}`, 303));
  }

  if (api && isWrite(ctx.request.method)) {
    const { sameOrigin } = await import('./lib/studio/server');
    if (!sameOrigin(ctx.request)) {
      return withHeaders(new Response(JSON.stringify({ error: 'Blocked: this request did not come from Studio.' }), { status: 403, headers: { 'Content-Type': 'application/json' } }));
    }
  }

  if (path === '/admin/preview' || path.startsWith('/admin/preview/')) {
    try {
      const svc = service(cfg);
      const snapshot = await svc.snapshot();
      const publicPath = path.slice('/admin/preview'.length).replace(/\/+$/, '') || '/';
      ctx.locals.studio = { edit: true, path: publicPath, snapshot, mode: svc.store.mode };
    } catch (e) {
      console.warn(`[studio] preview failed: ${e instanceof Error ? e.name : 'unknown'}`);
      return withHeaders(new Response('The preview could not load the drafts. Try again in a minute.', { status: 503 }));
    }
    const res = await next();
    if (ctx.locals.studio?.mode === 'github' && res.headers.get('content-type')?.includes('text/html')) {
      // Photos uploaded since the last publish are only on the drafts branch: serve every content photo from there.
      const html = (await res.text()).replace(/(\s(?:src|href)=")\/images\//g, '$1/api/studio/media/images/');
      return withHeaders(new Response(html, { status: res.status, headers: res.headers }));
    }
    return withHeaders(res);
  }

  return withHeaders(await next());
});
