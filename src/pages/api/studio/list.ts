import type { APIRoute } from 'astro';
import { handle, json, readJson, service } from '../../../lib/studio/server';
import { EditError, type ListOp } from '../../../lib/studio/ops';

export const prerender = false;

const OPS: ListOp[] = ['add', 'remove', 'up', 'down'];

/** Add, remove or move an item in a list (steps, questions, slides…). */
export const POST: APIRoute = ({ request }) =>
  handle(async () => {
    const b = await readJson<{ doc: string; path: string; op: ListOp; index: number; item?: unknown }>(request);
    if (!OPS.includes(b.op)) throw new EditError('Unknown action.');
    return json(await service().listChange(String(b.doc), String(b.path), b.op, Number(b.index), b.item));
  });
