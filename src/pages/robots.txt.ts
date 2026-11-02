import type { APIRoute } from 'astro';
import { settings } from '../lib/site';

/** Until "launched" is ticked in Site settings, all crawlers are told to stay away. */
export const GET: APIRoute = () => {
  const body = settings.launched
    ? `User-agent: *\nAllow: /\nDisallow: /keystatic\nDisallow: /api/\n\nSitemap: ${new URL('/sitemap-index.xml', settings.siteUrl).href}\n`
    : `# Not launched yet: nothing may be indexed.\nUser-agent: *\nDisallow: /\n`;
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
