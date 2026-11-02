/**
 * Server-only wiring: the Netlify Blobs cache and the adapter chosen from the server environment.
 * Never import this from a browser script.
 */
import { getStore } from '@netlify/blobs';
import { getCertAdapter, type CertAdapter } from './adapter';
import { MemoryStore, type KVStore } from './verify';

let memory: MemoryStore | null = null;

/**
 * Netlify Blobs store "cert-verify" when running on Netlify (Blobs is included on the free plan); otherwise a
 * per-process memory store, so `astro dev` and tests work without Netlify.
 */
export function getCertStore(): KVStore {
  try {
    const blobs = getStore({ name: 'cert-verify', consistency: 'eventual' });
    return {
      async get(key) {
        return (await blobs.get(key, { type: 'json' })) ?? null;
      },
      async set(key, value) {
        await blobs.setJSON(key, value);
      },
    };
  } catch {
    memory ??= new MemoryStore();
    return memory;
  }
}

/** Read at request time from the server environment (Netlify site settings). The key never reaches the browser. */
export function getServerCertAdapter(): CertAdapter {
  return getCertAdapter({ CERT_API_URL: process.env.CERT_API_URL, CERT_API_KEY: process.env.CERT_API_KEY });
}
