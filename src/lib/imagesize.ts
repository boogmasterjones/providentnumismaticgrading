/**
 * The pixel size of an image in public/ (JPEG, PNG, GIF or WebP), read from the file's header at build time, so an
 * <img> can carry width and height and the page does not shift when the photo arrives (journal covers). Returns null
 * for anything it cannot read (a missing file, another format); the image then simply goes without.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export interface Size { width: number; height: number }

export function imageSizeFromBytes(b: Uint8Array): Size | null {
  const u16 = (i: number) => (b[i] << 8) | b[i + 1];
  const le16 = (i: number) => b[i] | (b[i + 1] << 8);
  const le24 = (i: number) => b[i] | (b[i + 1] << 8) | (b[i + 2] << 16);
  const u32 = (i: number) => ((b[i] << 24) >>> 0) + ((b[i + 1] << 16) | (b[i + 2] << 8) | b[i + 3]);
  const ascii = (i: number, n: number) => String.fromCharCode(...b.subarray(i, i + n));
  // PNG: IHDR right after the signature
  if (b.length >= 24 && b[0] === 0x89 && ascii(1, 3) === 'PNG') return { width: u32(16), height: u32(20) };
  // GIF
  if (b.length >= 10 && ascii(0, 3) === 'GIF') return { width: le16(6), height: le16(8) };
  // WebP: lossy (VP8 ), lossless (VP8L) or extended (VP8X)
  if (b.length >= 30 && ascii(0, 4) === 'RIFF' && ascii(8, 4) === 'WEBP') {
    const kind = ascii(12, 4);
    if (kind === 'VP8 ') return { width: le16(26) & 0x3fff, height: le16(28) & 0x3fff };
    if (kind === 'VP8L') {
      const v = b[21] | (b[22] << 8) | (b[23] << 16) | (b[24] << 24);
      return { width: (v & 0x3fff) + 1, height: ((v >> 14) & 0x3fff) + 1 };
    }
    if (kind === 'VP8X') return { width: le24(24) + 1, height: le24(27) + 1 };
    return null;
  }
  // JPEG: walk the segments to the first start-of-frame marker
  if (b.length >= 4 && b[0] === 0xff && b[1] === 0xd8) {
    let i = 2;
    while (i + 9 < b.length) {
      if (b[i] !== 0xff) { i++; continue; }
      const m = b[i + 1];
      if (m === 0xd8 || m === 0x01 || (m >= 0xd0 && m <= 0xd7)) { i += 2; continue; }
      if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) return { width: u16(i + 7), height: u16(i + 5) };
      i += 2 + u16(i + 2);
    }
  }
  return null;
}

/** The size of a public image by its site address ("/images/blog/cover.jpg"), or null. */
export function publicImageSize(src: string | null | undefined): Size | null {
  if (!src || !src.startsWith('/') || src.includes('..')) return null;
  try {
    return imageSizeFromBytes(readFileSync(join(process.cwd(), 'public', decodeURIComponent(src.split('?')[0]))));
  } catch {
    return null;
  }
}
