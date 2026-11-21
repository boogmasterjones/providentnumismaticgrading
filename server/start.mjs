/**
 * The Node server Hostinger runs (hPanel "Entry file": server/start.mjs, inside the "dist" output folder).
 * Locally: `npm run build` then `npm start`.
 *
 * It starts Astro's standalone handler (static files from dist/client, everything else rendered on request) and
 * adds what the host used to add on Netlify: cache and security headers on every response, and the visitor's
 * real address behind Hostinger's proxy (server/headers.mjs). Listens on PORT (set by Hostinger), default 4321.
 */
import http from 'node:http';
import { prepare } from './headers.mjs';

// Astro's entry would otherwise start its own server as soon as it is imported.
process.env.ASTRO_NODE_AUTOSTART = 'disabled';
const { handler } = await import('./entry.mjs');

const port = Number(process.env.PORT) || 4321;
const host = process.env.HOST || undefined; // all interfaces, like Hostinger's own examples

const server = http.createServer((req, res) => {
  try {
    prepare(req, res);
  } catch {
    /* headers are best effort; never block a request */
  }
  handler(req, res);
});
server.listen(port, host, () => console.log(`[server] listening on ${host ?? 'all interfaces'}:${port}`));

for (const signal of ['SIGTERM', 'SIGINT']) {
  process.on(signal, () => {
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 5000).unref();
  });
}
