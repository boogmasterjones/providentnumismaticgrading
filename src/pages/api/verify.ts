import type { APIRoute } from 'astro';
import { handleVerify, RateLimiter } from '../../lib/certs/verify';
import { getCertStore, getServerCertAdapter } from '../../lib/certs/server';
import { clientIp } from '../../lib/client-ip';

// Runs on demand in the Node server, never at build time.
export const prerender = false;

// One limiter per running server process (see RateLimiter).
const limiter = new RateLimiter(20, 300);

export const GET: APIRoute = async (ctx) => {
  return handleVerify(ctx.request, clientIp(ctx), {
    adapter: getServerCertAdapter(),
    store: getCertStore(),
    limiter,
    now: Date.now,
    log: (m) => console.warn(m),
  });
};
