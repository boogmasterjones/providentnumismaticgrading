/**
 * Photos are made web-ready in the browser before upload: turned the right way up, scaled so the long side is at
 * most `maxSide` pixels, and saved as WebP (JPEG where a browser can't write WebP). A 12 MB phone photo becomes a
 * few hundred KB. The server checks the result again (size cap, real image bytes).
 */
export const MAX_SIDE = 2400;
const TARGET_BYTES = 1.5 * 1024 * 1024;

export class PhotoError extends Error {}

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

export async function prepareImage(file: File, maxSide = MAX_SIDE): Promise<File> {
  if (!file.type.startsWith('image/') && !/\.(jpe?g|png|webp|heic|heif|gif|avif)$/i.test(file.name)) {
    throw new PhotoError('That file is not a photo. Choose a JPEG, PNG or WebP image.');
  }
  if (file.type === 'image/svg+xml') throw new PhotoError('Drawings (SVG) cannot be uploaded. Choose a photo.');
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    throw new PhotoError(
      /\.(heic|heif)$/i.test(file.name)
        ? 'This browser cannot read iPhone HEIC photos. Send it to yourself as a JPEG, or upload it from the iPhone itself.'
        : 'This photo could not be read. Try a JPEG or PNG.',
    );
  }
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new PhotoError('This browser could not prepare the photo.');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close?.();
  let quality = 0.84;
  let blob = await toBlob(canvas, 'image/webp', quality);
  let type = blob?.type === 'image/webp' ? 'image/webp' : 'image/jpeg';
  if (type === 'image/jpeg') blob = await toBlob(canvas, 'image/jpeg', 0.86);
  while (blob && blob.size > TARGET_BYTES && quality > 0.5) {
    quality -= 0.1;
    blob = await toBlob(canvas, type, quality);
  }
  if (!blob) throw new PhotoError('This browser could not prepare the photo.');
  type = blob.type || type;
  const base = file.name.replace(/\.[^.]+$/, '') || 'photo';
  return new File([blob], `${base}.${type === 'image/webp' ? 'webp' : 'jpg'}`, { type });
}
