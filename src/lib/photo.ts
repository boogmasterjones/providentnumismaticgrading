/**
 * Responsive photos, made at build time (no Netlify Image CDN: it costs credits).
 *
 * Every photo the owner adds (Studio or Keystatic) is a file in public/images/… and is referenced by its address
 * ("/images/notable/coin-123.webp"). At build time `src/integrations/photos.ts` writes each one again at a few widths
 * as AVIF and WebP into dist/_img/, named by a hash of the file's bytes (so a replaced photo gets new addresses and
 * the files can be cached for a year). `<Photo>` (src/components/Photo.astro) uses the same plan to write the
 * <picture> with srcset/sizes, width and height. The original file stays where it was, as the last fallback.
 *
 * Shared by the component (build-time rendering) and the integration (after the build); no sharp here, so it is safe
 * in the server function too, where it simply finds no file and the page falls back to a plain <img>.
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { imageSizeFromBytes, type Size } from './imagesize';

/** The widths written for every photo (never wider than the original, which always gets its own width up to MAX). */
export const WIDTHS = [320, 480, 640, 960, 1280, 1920] as const;
export const MAX_WIDTH = 1920;
export const FORMATS = ['avif', 'webp'] as const;
export type Format = (typeof FORMATS)[number];
/** Where the variants are published (dist/_img/…), and the folder of photos they are made from. */
export const OUT_DIR = '_img';
export const PHOTO_ROOT = 'images';
export const PHOTO_EXT = /\.(jpe?g|png|webp|avif|gif)$/i;

export interface PhotoPlan extends Size {
  hash: string;
  /** the widths that exist for this photo, ascending */
  widths: number[];
}

/** A photo address the build step handles: under /images/, a photo file, no tricks. */
export function isPhotoSrc(src: string | null | undefined): src is string {
  return !!src && src.startsWith(`/${PHOTO_ROOT}/`) && !src.includes('..') && PHOTO_EXT.test(src.split('?')[0]);
}

export function widthsFor(original: number): number[] {
  const top = Math.min(original, MAX_WIDTH);
  return [...WIDTHS.filter((w) => w < top), top];
}

export function planFromBytes(bytes: Uint8Array): PhotoPlan | null {
  const size = imageSizeFromBytes(bytes);
  if (!size || size.width < 1 || size.height < 1) return null;
  const hash = createHash('sha1').update(bytes).digest('hex').slice(0, 12);
  return { ...size, hash, widths: widthsFor(size.width) };
}

/** The plan for a photo by its address, or null (not a photo under /images/, or no such file here). */
export function planPhoto(src: string | null | undefined, root = process.cwd()): PhotoPlan | null {
  if (!isPhotoSrc(src)) return null;
  try {
    return planFromBytes(readFileSync(join(root, 'public', decodeURIComponent(src.split('?')[0]))));
  } catch {
    return null;
  }
}

/** The published address of one variant. */
export const variantPath = (hash: string, width: number, format: Format) => `/${OUT_DIR}/${hash}-${width}.${format}`;

export const srcsetFor = (p: PhotoPlan, format: Format) =>
  p.widths.map((w) => `${variantPath(p.hash, w, format)} ${w}w`).join(', ');

/** Height for a variant width, keeping the original's proportions. */
export const heightAt = (p: Size, width: number) => Math.max(1, Math.round((p.height * width) / p.width));
