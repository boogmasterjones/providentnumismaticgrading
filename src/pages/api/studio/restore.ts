import type { APIRoute } from 'astro';
import { handle, json, readJson, service } from '../../../lib/studio/server';

export const prerender = false;

/** "Undo": put a file back to the text it had before a save (null removes a file that the save created). */
export const POST: APIRoute = ({ request }) =>
  handle(async () => {
    const b = await readJson<{ file: string; before: string | null }>(request);
    await service().restore(String(b.file), b.before === null ? null : String(b.before));
    return json({ ok: true });
  });
