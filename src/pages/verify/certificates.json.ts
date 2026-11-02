import type { APIRoute } from 'astro';
import { getCertIndex } from '../../lib/certificates';

/** The lookup index used by the Verify page (built at publish time, served as a static file). */
export const GET: APIRoute = async () =>
  new Response(JSON.stringify(await getCertIndex()), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
