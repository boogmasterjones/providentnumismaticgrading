// @ts-check
import { existsSync, readFileSync } from 'node:fs';
import { defineConfig } from 'astro/config';
import node from '@astrojs/node';
import react from '@astrojs/react';
import markdoc from '@astrojs/markdoc';
import sitemap from '@astrojs/sitemap';
import keystatic from '@keystatic/astro';
import photos from './src/integrations/photos.ts';
import serverEntry from './src/integrations/server-entry.ts';

/** Site settings live in content/settings.json (edited in Provident Studio). The live address feeds the sitemap. */
const settings = JSON.parse(readFileSync(new URL('./content/settings.json', import.meta.url), 'utf8'));

const isDev = process.argv.includes('dev');

// Local work: server code reads its settings from process.env (as on Hostinger), so load .env into it. Node's loader
// does no "$" expansion, so a bcrypt hash can be pasted as is. On Hostinger there is no .env file: the values are
// set in hPanel (Environment variables) and reach both the build and the running server.
if (isDev && existsSync('.env')) process.loadEnvFile('.env');

/**
 * The addresses the site answers on, so Astro trusts the Host header (and the proxy's forwarded headers) for them:
 * the live address from settings, its www / no-www twin, and any extra names in SITE_HOSTS (comma-separated, e.g.
 * the temporary Hostinger address while testing). Read at build time.
 */
function siteHosts() {
  const names = new Set();
  try {
    const h = new URL(settings.siteUrl).hostname;
    names.add(h);
    names.add(h.startsWith('www.') ? h.slice(4) : `www.${h}`);
  } catch {
    /* no address yet */
  }
  for (const h of (process.env.SITE_HOSTS ?? '').split(',')) if (h.trim()) names.add(h.trim().toLowerCase());
  return [...names].map((hostname) => ({ hostname }));
}

export default defineConfig({
  site: settings.siteUrl,
  // Pages are static (fast, cheap) and served by the Node server from dist/client. Rendered on request: Provident
  // Studio (/admin, /api/studio), /api/verify, /api/form, /population and the old-address redirects.
  output: 'static',
  // Hostinger Web App (Node.js): `npm run build`, then hPanel starts dist/server/start.mjs (server/start.mjs wraps
  // the standalone handler to add cache and security headers). Photos are sized at build time (src/integrations/photos.ts).
  adapter: node({ mode: 'standalone' }),
  security: {
    allowedDomains: siteHosts(),
    // Astro's own form-origin check compares the Origin header with the request address, which behind Hostinger's
    // proxy is only right for names listed above; a wrong guess would silently block the public forms. Writes that
    // matter are checked by the app instead: every Studio write (src/middleware.ts, sameOrigin), and the public
    // forms are open to anyone by design (honeypot + limits in src/lib/forms.ts).
    checkOrigin: false,
  },
  integrations: [
    react(),
    markdoc(),
    // Keystatic stays as a fallback editor for local development only (http://localhost:4321/keystatic). It is not
    // part of the production build, so the live site has no unauthenticated editor routes. The owner uses Studio.
    ...(isDev ? [keystatic()] : []),
    sitemap({
      filter: (page) => !/\/(thank-you|keystatic|admin|404)(\/|$)/.test(page),
      // /population is rendered on request, so it is added by hand (only when it is switched on).
      customPages: settings.showPopulation ? [new URL('/population', settings.siteUrl).href] : [],
    }),
    // every photo in public/images at a few widths, AVIF + WebP, into dist/client/_img (src/lib/photo.ts); no image CDN
    photos(),
    // copies server/start.mjs + server/headers.mjs into dist/server/ (the entry file Hostinger runs)
    serverEntry(),
  ],
  redirects: {
    // Old addresses: fee tables were removed (fees are quoted per submission); the submit steps moved to /submit.
    // The Node adapter answers these on request with a real 301 (no HTML stub pages).
    '/fees': { status: 301, destination: '/submit' },
    '/how-to-submit': { status: 301, destination: '/submit' },
  },
});
