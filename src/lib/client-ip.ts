/**
 * The visitor's IP address, for the per-visitor limits (certificate lookups, forms, Studio sign-in). Never logged.
 *
 * On Hostinger the Node server sits behind Hostinger's proxy, so the socket address is the proxy's. The server
 * entry (server/start.mjs) works out the real address once, from the proxy's X-Forwarded-For, and passes it on in
 * CLIENT_IP_HEADER (any copy of that header sent by a visitor is overwritten there). Elsewhere (`astro dev`, tests)
 * Astro's clientAddress is used.
 */
export const CLIENT_IP_HEADER = 'x-provident-client-ip';

export function clientIp(ctx: { request: Request; clientAddress?: string }): string {
  const fromServer = ctx.request.headers.get(CLIENT_IP_HEADER);
  if (fromServer) return fromServer;
  try {
    return ctx.clientAddress ?? '';
  } catch {
    return '';
  }
}
