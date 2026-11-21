/**
 * Server-only wiring: the lookup cache and the adapter chosen from the server environment.
 * Never import this from a browser script.
 */
import { getCertAdapter, type CertAdapter } from './adapter';
import type { KVStore } from './verify';
import { getKV } from '../kv';

/**
 * The cache, namespace "cert-verify": Hostinger MySQL in production (survives redeploys), files under `astro dev`,
 * memory in tests (src/lib/kv.ts). Entries carry their own expiry (see CACHE_TTL_* in verify.ts).
 */
export function getCertStore(): KVStore {
  return getKV('cert-verify', { dev: import.meta.env.DEV, defaultTtlMs: 24 * 60 * 60 * 1000 });
}

/** Read at request time from the server environment (Hostinger: Environment variables). The token never reaches the browser. */
export function getServerCertAdapter(): CertAdapter {
  return getCertAdapter(
    {
      CODA_DOC_ID: process.env.CODA_DOC_ID,
      CODA_TABLE_ID: process.env.CODA_TABLE_ID,
      CODA_API_TOKEN: process.env.CODA_API_TOKEN,
      CODA_COLUMN_MAP: process.env.CODA_COLUMN_MAP,
      CODA_API_BASE: process.env.CODA_API_BASE,
      CODA_DOCS: process.env.CODA_DOCS,
    },
    globalThis.fetch,
    (m) => console.warn(m),
    // multi-doc mode keeps each doc's table list (names and ids only) here for about an hour
    getCertStore(),
  );
}
