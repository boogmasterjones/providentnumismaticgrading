import type { APIRoute } from 'astro';
import { handle, json, service } from '../../../lib/studio/server';

export const prerender = false;

/** What has changed since the last publish. */
export const GET: APIRoute = () => handle(async () => json(await service().changes()));
