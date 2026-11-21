/**
 * Response headers and the visitor's address for the Node server (server/start.mjs). Plain JavaScript, no build
 * step: the build copies this folder into dist/server/ (src/integrations/server-entry.ts).
 *
 * These replace what Netlify used to do at its edge:
 * - the year-long cache on build-made photos (netlify.toml had it for /_img/*); /_astro/* (hashed scripts and
 *   styles) gets the same;
 * - baseline security headers on every response, static files included (Astro's middleware only sees pages
 *   rendered on request). Studio's stricter headers (src/middleware.ts) win where they differ.
 */

export const IMMUTABLE = 'public, max-age=31536000, immutable';
const IMMUTABLE_PATH = /^\/(_img|_astro)\//;

export const CLIENT_IP_HEADER = 'x-provident-client-ip';

/** Headers every response gets unless the app already set them. */
export function baseHeaders(https) {
  const h = {
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'X-Frame-Options': 'SAMEORIGIN',
    'Content-Security-Policy': "frame-ancestors 'self'",
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
  };
  // Only over HTTPS (Hostinger serves the domain with a free SSL certificate). No includeSubDomains: other parts of
  // the domain (email, other sites) are not ours to decide.
  if (https) h['Strict-Transport-Security'] = 'max-age=31536000';
  return h;
}

function isPrivateAddress(a) {
  const ip = String(a || '').replace(/^::ffff:/i, '');
  return (
    ip === '::1' ||
    /^127\./.test(ip) ||
    /^10\./.test(ip) ||
    /^192\.168\./.test(ip) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(ip) ||
    /^f[cd][0-9a-f]{2}:/i.test(ip) ||
    /^fe80:/i.test(ip)
  );
}

/**
 * The visitor's address. When the connection comes from a proxy on the same machine or private network
 * (Hostinger's web server in front of the app), the proxy's own entry in X-Forwarded-For is used: the LAST one,
 * because anything before it was sent by the visitor and can be made up. Otherwise the socket address.
 */
export function visitorAddress(remote, forwardedFor) {
  if (forwardedFor && isPrivateAddress(remote)) {
    const list = String(forwardedFor).split(',').map((s) => s.trim()).filter(Boolean);
    if (list.length) return list[list.length - 1];
  }
  return String(remote || '');
}

export function isHttps(req) {
  if (req.socket && req.socket.encrypted) return true;
  const proto = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim().toLowerCase();
  return proto === 'https' && isPrivateAddress(req.socket && req.socket.remoteAddress);
}

/** Call once per request, before the app handles it. */
export function prepare(req, res) {
  // The app trusts only this header for the visitor's address (src/lib/client-ip.ts): always overwrite it.
  req.headers[CLIENT_IP_HEADER] = visitorAddress(req.socket && req.socket.remoteAddress, req.headers['x-forwarded-for']);
  const path = String(req.url || '/').split('?')[0];
  const base = baseHeaders(isHttps(req));
  const writeHead = res.writeHead;
  res.writeHead = function (status, ...rest) {
    for (const [k, v] of Object.entries(base)) if (!this.hasHeader(k)) this.setHeader(k, v);
    if (status === 200 && IMMUTABLE_PATH.test(path)) this.setHeader('Cache-Control', IMMUTABLE);
    return writeHead.call(this, status, ...rest);
  };
}
