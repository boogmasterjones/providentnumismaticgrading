import type { APIRoute } from 'astro';
import { handle, json, readJson, service } from '../../../lib/studio/server';
import type { Data } from '../../../lib/studio/ops';

export const prerender = false;

export const GET: APIRoute = () => handle(async () => json(await service().listPosts()));

/** Create a journal post. */
export const POST: APIRoute = ({ request }) =>
  handle(async () => {
    const b = await readJson<{ data?: Data; body?: string }>(request);
    return json(await service().createPost(b.data ?? {}, typeof b.body === 'string' ? b.body : ''));
  });
