import type { APIRoute } from 'astro';
import { handle, json, readJson, service } from '../../../lib/studio/server';
import { EditError, type Data } from '../../../lib/studio/ops';

export const prerender = false;

export const GET: APIRoute = () => handle(async () => json(await service().listNotable()));

/** { action: "create", data } adds a coin; { action: "move", slug, dir: "up" | "down" } reorders. */
export const POST: APIRoute = ({ request }) =>
  handle(async () => {
    const b = await readJson<{ action: string; data?: Data; slug?: string; dir?: 'up' | 'down' }>(request);
    const svc = service();
    if (b.action === 'create') return json(await svc.createNotable(b.data ?? {}));
    if (b.action === 'move' && (b.dir === 'up' || b.dir === 'down')) return json({ results: await svc.moveNotable(String(b.slug), b.dir) });
    throw new EditError('Unknown action.');
  });
