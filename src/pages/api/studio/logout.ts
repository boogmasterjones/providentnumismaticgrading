import type { APIRoute } from 'astro';
import { clearCookie } from '../../../lib/studio/auth';
import { config, json } from '../../../lib/studio/server';

export const prerender = false;

/** Sign out: the session cookie is cleared. */
export const POST: APIRoute = async () => json({ ok: true }, 200, { 'Set-Cookie': clearCookie(config()) });
