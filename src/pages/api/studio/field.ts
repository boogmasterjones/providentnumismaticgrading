import type { APIRoute } from 'astro';
import { handle, json, readJson, service } from '../../../lib/studio/server';

export const prerender = false;

/** Change one field: the visual editor's inline edits. */
export const POST: APIRoute = ({ request }) =>
  handle(async () => {
    const b = await readJson<{ doc: string; path: string; value: unknown }>(request);
    return json(await service().saveField(String(b.doc), String(b.path), b.value));
  });
