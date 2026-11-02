import type { APIRoute } from 'astro';
import { handleVerify, RateLimiter } from '../../lib/certs/verify';
import { getCertStore, getServerCertAdapter } from '../../lib/certs/server';

// Runs on demand as a Netlify Function (the Astro Netlify adapter bundles it), never at build time.
export const prerender = false;

// One limiter per running copy of the function (see RateLimiter).
const limiter = new RateLimiter(20, 300);

export const GET: APIRoute = async ({ request, clientAddress }) => {
  let ip = '';
  try {
    ip = clientAddress;
  } catch {
    ip = request.headers.get('x-nf-client-connection-ip') ?? '';
  }
  return handleVerify(request, ip, {
    adapter: getServerCertAdapter(),
    store: getCertStore(),
    limiter,
    now: Date.now,
    log: (m) => console.warn(m),
  });
};
