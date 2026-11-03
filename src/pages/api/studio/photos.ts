import type { APIRoute } from 'astro';
import { handle, json, readJson, service } from '../../../lib/studio/server';

export const prerender = false;

/** The photo library: every photo in public/images, and where each one is used. */
export const GET: APIRoute = () => handle(async () => json(await service().photos()));

/** Delete a photo that is no longer used anywhere. */
export const POST: APIRoute = ({ request }) =>
  handle(async () => {
    const b = await readJson<{ path: string }>(request);
    await service().deleteImage(String(b.path));
    return json({ ok: true });
  });
