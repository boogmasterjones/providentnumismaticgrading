import type { APIRoute } from 'astro';
import { handle, json, readJson, service } from '../../../lib/studio/server';

export const prerender = false;

/** Delete a notable coin or a journal post (the reply carries the file's text, so it can be undone). */
export const POST: APIRoute = ({ request }) =>
  handle(async () => {
    const b = await readJson<{ doc: string }>(request);
    return json(await service().deleteDoc(String(b.doc)));
  });
