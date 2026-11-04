import type { APIRoute } from 'astro';
import { handle, json, readJson, service } from '../../../lib/studio/server';

export const prerender = false;

/** Put one file (or, with all: true, everything) back the way it is on the live site. */
export const POST: APIRoute = ({ request }) =>
  handle(async () => {
    const b = await readJson<{ path?: string; all?: boolean }>(request);
    const svc = service();
    if (b.all === true) await svc.undoAll();
    else await svc.undo(String(b.path));
    return json({ ok: true, changes: await svc.changes() });
  });
