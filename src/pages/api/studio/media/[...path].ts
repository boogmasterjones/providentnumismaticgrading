import type { APIRoute } from 'astro';
import { contentStore, handle } from '../../../../lib/studio/server';
import { isReadable } from '../../../../lib/studio/store';
import { GitHubStore } from '../../../../lib/studio/store-github';

export const prerender = false;

const TYPES: Record<string, string> = {
  webp: 'image/webp',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  avif: 'image/avif',
};

/** A photo as the drafts have it (Studio's preview shows photos that are not published yet). Signed in only. */
export const GET: APIRoute = ({ params, request }) =>
  handle(async () => {
    const rel = String(params.path ?? '');
    const path = `public/${rel}`;
    const ext = rel.split('.').pop()?.toLowerCase() ?? '';
    if (!rel.startsWith('images/') || !TYPES[ext] || !isReadable(path)) return new Response('Not found', { status: 404 });
    const store = contentStore();
    const etag = store instanceof GitHubStore ? await store.blobSha(path) : null;
    if (etag && request.headers.get('if-none-match') === `"${etag}"`) return new Response(null, { status: 304 });
    const bytes = await store.readBinary(path);
    if (!bytes) return new Response('Not found', { status: 404 });
    return new Response(new Blob([bytes as Uint8Array<ArrayBuffer>]), {
      headers: { 'Content-Type': TYPES[ext], 'Cache-Control': 'private, max-age=300', ...(etag ? { ETag: `"${etag}"` } : {}) },
    });
  });
