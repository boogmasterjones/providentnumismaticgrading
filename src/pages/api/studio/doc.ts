import type { APIRoute } from 'astro';
import { handle, json, readJson, service } from '../../../lib/studio/server';
import { renderMarkdoc } from '../../../lib/content';
import type { Data } from '../../../lib/studio/ops';

export const prerender = false;

/** Read one document: its data, its body, and the body as HTML for the text editor. */
export const GET: APIRoute = ({ url }) =>
  handle(async () => {
    const d = await service().readDoc(url.searchParams.get('doc') ?? '');
    return json({ ...d, bodyHtml: d.body ? renderMarkdoc(d.body) : '' });
  });

/** Save a whole document from a form (fields the form doesn't know are kept). */
export const POST: APIRoute = ({ request }) =>
  handle(async () => {
    const b = await readJson<{ doc: string; data: Data; body?: string }>(request);
    return json(await service().saveDoc(String(b.doc), b.data ?? {}, typeof b.body === 'string' ? b.body : undefined));
  });
