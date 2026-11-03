// @ts-check
import { existsSync, readFileSync } from 'node:fs';
import { defineConfig } from 'astro/config';
import netlify from '@astrojs/netlify';
import react from '@astrojs/react';
import markdoc from '@astrojs/markdoc';
import sitemap from '@astrojs/sitemap';
import keystatic from '@keystatic/astro';

/** Site settings live in content/settings.json (edited in Provident Studio). The live address feeds the sitemap. */
const settings = JSON.parse(readFileSync(new URL('./content/settings.json', import.meta.url), 'utf8'));

const isDev = process.argv.includes('dev');

// Local work: server code reads its settings from process.env (as on Netlify), so load .env into it. Node's loader
// does no "$" expansion, so a bcrypt hash can be pasted as is. On Netlify there is no .env file.
if (isDev && existsSync('.env')) process.loadEnvFile('.env');

export default defineConfig({
  site: settings.siteUrl,
  // Pages are static (fast, cheap). On demand on Netlify: Provident Studio (/admin, /api/studio), /api/verify and
  // /population.
  output: 'static',
  // No edge functions in this site; turning off their local emulation avoids a Deno start-up error in `astro dev`.
  adapter: netlify({ devFeatures: { images: true, environmentVariables: false, edgeFunctions: false } }),
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
  ],
  redirects: {
    // Old addresses: fee tables were removed (fees are quoted per submission); the submit steps moved to /submit.
    '/fees': '/submit',
    '/how-to-submit': '/submit',
  },
});
