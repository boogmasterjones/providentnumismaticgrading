import type { APIRoute } from 'astro';
import { handle, json, service } from '../../../lib/studio/server';

export const prerender = false;

/**
 * Publish every draft at once. GitHub mode: the drafts branch is merged into the live branch in one commit, so
 * Netlify builds once. Local mode: nothing is committed; the reply lists what would be published, with the diff.
 */
export const POST: APIRoute = () => handle(async () => json(await service().publish()));
