import { describe, expect, it } from 'vitest';
import { imageSizeFromBytes, publicImageSize } from '../src/lib/imagesize';

describe('image size from the file header', () => {
  it('reads a PNG', () => {
    const png = new Uint8Array(24);
    png.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]);
    png.set([0, 0, 0x07, 0xd0, 0, 0, 0x04, 0xb0], 16); // 2000 × 1200
    expect(imageSizeFromBytes(png)).toEqual({ width: 2000, height: 1200 });
  });

  it('reads a JPEG past its APP segments', () => {
    const jpg = new Uint8Array([
      0xff, 0xd8, // start of image
      0xff, 0xe0, 0x00, 0x04, 0x00, 0x00, // an APP0 segment (length 4)
      0xff, 0xc0, 0x00, 0x11, 0x08, 0x03, 0x20, 0x05, 0x00, 0x03, 0, 0, 0, 0, 0, 0, // SOF0: 800 high, 1280 wide
    ]);
    expect(imageSizeFromBytes(jpg)).toEqual({ width: 1280, height: 800 });
  });

  it('reads a GIF and an extended WebP', () => {
    expect(imageSizeFromBytes(new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x40, 0x01, 0xf0, 0x00]))).toEqual({ width: 320, height: 240 });
    const webp = new Uint8Array(30);
    webp.set([...'RIFF'].map((c) => c.charCodeAt(0)), 0);
    webp.set([...'WEBPVP8X'].map((c) => c.charCodeAt(0)), 8);
    webp.set([0x7f, 0x07, 0x00, 0x37, 0x04, 0x00], 24); // 1920 × 1080 (stored minus one)
    expect(imageSizeFromBytes(webp)).toEqual({ width: 1920, height: 1080 });
  });

  it('gives up quietly on anything else', () => {
    expect(imageSizeFromBytes(new Uint8Array([1, 2, 3, 4]))).toBeNull();
    expect(publicImageSize('/images/does-not-exist.jpg')).toBeNull();
    expect(publicImageSize('../secret.jpg')).toBeNull();
    expect(publicImageSize(null)).toBeNull();
  });

  it('reads a real file in public/', () => {
    expect(publicImageSize('/media/film/silver-poster.webp')).toMatchObject({ width: expect.any(Number), height: expect.any(Number) });
  });
});
