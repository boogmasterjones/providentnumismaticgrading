import type { APIRoute } from 'astro';
import { handleLookup, RateLimiter } from '../../lib/pcgs/lookup';
import { getLookupStore } from '../../lib/pcgs/store';

// Runs on demand as a Netlify Function (the Astro Netlify adapter bundles it), never at build time.
export const prerender = false;

// One limiter per running copy of the function (see RateLimiter).
const limiter = new RateLimiter(10, 60);

const flag = (v: string | undefined) => v === 'true' || v === '1';

export const GET: APIRoute = async ({ request, clientAddress }) => {
  // Read at request time from the server environment (Netlify site settings). Never sent to the browser.
  const env = process.env;
  let ip = '';
  try {
    ip = clientAddress;
  } catch {
    ip = request.headers.get('x-nf-client-connection-ip') ?? '';
  }
  return handleLookup(request, ip, {
    token: env.PCGS_API_TOKEN?.trim() || undefined,
    fetch: globalThis.fetch,
    store: getLookupStore(),
    limiter,
    now: Date.now,
    dailyBudget: Number(env.PCGS_DAILY_BUDGET) > 0 ? Number(env.PCGS_DAILY_BUDGET) : 900,
    showImages: flag(env.PCGS_SHOW_IMAGES),
    showPrices: flag(env.PCGS_SHOW_PRICES),
    authMode: env.PCGS_AUTH_MODE === 'query' ? 'query' : 'header',
    log: (m) => console.warn(m),
  });
};

