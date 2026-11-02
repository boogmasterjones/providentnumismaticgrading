import type { APIRoute } from 'astro';
import { guillocheSvg } from '../lib/guilloche';

/** The engraved rosette used faintly behind page titles and the closing statement (built once, cached). */
export const GET: APIRoute = () =>
  new Response(guillocheSvg(), { headers: { 'Content-Type': 'image/svg+xml; charset=utf-8' } });
