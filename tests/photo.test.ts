import { describe, expect, it } from 'vitest';
import { heightAt, isPhotoSrc, planFromBytes, srcsetFor, variantPath, widthsFor } from '../src/lib/photo';

/** A minimal PNG header (signature + IHDR) of the given size: enough for the size reader. */
function png(width: number, height: number): Uint8Array {
  const b = new Uint8Array(33);
  b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]);
  new DataView(b.buffer).setUint32(16, width);
  new DataView(b.buffer).setUint32(20, height);
  return b;
}

describe('photo plan', () => {
  it('only takes photos under /images/', () => {
    expect(isPhotoSrc('/images/notable/a-1.webp')).toBe(true);
    expect(isPhotoSrc('/images/blog/cover.JPG')).toBe(true);
    expect(isPhotoSrc('/media/film/silver-poster.webp')).toBe(false);
    expect(isPhotoSrc('/images/../secret.webp')).toBe(false);
    expect(isPhotoSrc('https://example.com/images/a.webp')).toBe(false);
    expect(isPhotoSrc('/images/drawing.svg')).toBe(false);
    expect(isPhotoSrc(null)).toBe(false);
  });

  it('never makes a size wider than the original, and caps the largest', () => {
    expect(widthsFor(700)).toEqual([320, 480, 640, 700]);
    expect(widthsFor(2400)).toEqual([320, 480, 640, 960, 1280, 1920]);
    expect(widthsFor(1920)).toEqual([320, 480, 640, 960, 1280, 1920]);
    expect(widthsFor(200)).toEqual([200]);
  });

  it('names sizes by a hash of the bytes, so a replaced photo gets new addresses', () => {
    const a = planFromBytes(png(1000, 500))!;
    const b = planFromBytes(png(1000, 501))!;
    expect(a).toMatchObject({ width: 1000, height: 500, widths: [320, 480, 640, 960, 1000] });
    expect(a.hash).toMatch(/^[0-9a-f]{12}$/);
    expect(a.hash).not.toBe(b.hash);
    expect(variantPath(a.hash, 640, 'avif')).toBe(`/_img/${a.hash}-640.avif`);
    expect(srcsetFor(a, 'webp').split(', ')).toHaveLength(5);
    expect(srcsetFor(a, 'webp')).toContain(`/_img/${a.hash}-1000.webp 1000w`);
    expect(heightAt(a, 640)).toBe(320);
  });

  it('gives up on bytes that are not a photo', () => {
    expect(planFromBytes(new Uint8Array([1, 2, 3]))).toBeNull();
  });
});
