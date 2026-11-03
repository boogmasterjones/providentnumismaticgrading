import type { APIRoute } from 'astro';
import { handle, json, service } from '../../../lib/studio/server';
import { EditError } from '../../../lib/studio/ops';
import { MAX_UPLOAD_BYTES } from '../../../lib/studio/service';

export const prerender = false;

/**
 * Upload a photo (multipart: "file", "folder"). The browser has already resized it and turned it into WebP
 * (src/studio/image.ts); here the size is capped and the bytes must really be a JPEG, PNG or WebP image.
 */
export const POST: APIRoute = ({ request }) =>
  handle(async () => {
    const len = Number(request.headers.get('content-length') ?? 0);
    if (len > MAX_UPLOAD_BYTES + 64 * 1024) throw new EditError('That photo is too large (6 MB at most).', 413);
    if (!(request.headers.get('content-type') ?? '').includes('multipart/form-data')) throw new EditError('Expected a photo.', 415);
    const form = await request.formData();
    const file = form.get('file');
    if (!(file instanceof File)) throw new EditError('No photo was received.');
    const path = await service().uploadImage(String(form.get('folder') ?? ''), file.name || 'photo', new Uint8Array(await file.arrayBuffer()));
    return json({ path, src: path.slice('public'.length) });
  });
