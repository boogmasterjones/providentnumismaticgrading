// @ts-check
import { readFileSync } from 'node:fs';
import { defineConfig } from 'astro/config';
import netlify from '@astrojs/netlify';
import react from '@astrojs/react';
import markdoc from '@astrojs/markdoc';
import sitemap from '@astrojs/sitemap';
import keystatic from '@keystatic/astro';

/** Site settings live in content/settings.json (edited in Keystatic). The live address feeds the sitemap. */
const settings = JSON.parse(readFileSync(new URL('./content/settings.json', import.meta.url), 'utf8'));

export default defineConfig({
  site: settings.siteUrl,
  // Pages are static (fast, cheap); only the editor (/keystatic), /api/verify and /population run on demand on Netlify.
  output: 'static',
  // No edge functions in this site; turning off their local emulation avoids a Deno start-up error in `astro dev`.
  adapter: netlify({ devFeatures: { images: true, environmentVariables: false, edgeFunctions: false } }),
  integrations: [
    react(),
    markdoc(),
    keystatic(),
    sitemap({
      filter: (page) => !/\/(thank-you|keystatic|404)(\/|$)/.test(page),
      // /population is rendered on request, so it is added by hand (only when it is switched on).
      customPages: settings.showPopulation ? [new URL('/population', settings.siteUrl).href] : [],
    }),
  ],
  redirects: {
    '/admin': '/keystatic',
  },
});
