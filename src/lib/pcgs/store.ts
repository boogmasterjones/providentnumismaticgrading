import { getStore } from '@netlify/blobs';
import { MemoryStore, type KVStore } from './lookup';

let memory: MemoryStore | null = null;

/**
 * Netlify Blobs store "pcgs-lookup" when running on Netlify (Blobs is included on the free plan); otherwise a
 * per-process memory store, so `astro dev` and tests work without Netlify.
 */
export function getLookupStore(): KVStore {
  try {
    const blobs = getStore({ name: 'pcgs-lookup', consistency: 'eventual' });
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
