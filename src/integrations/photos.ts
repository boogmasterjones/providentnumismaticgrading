/**
 * Build step: every photo in public/images/ is written again at the widths in src/lib/photo.ts, as AVIF and WebP,
 * into dist/_img/ (see that file for the why). Runs once after `astro build`, with sharp (already installed with
 * Astro). Made files are kept in node_modules/.cache/provident-photos (Netlify keeps node_modules between builds), so a
 * publish only encodes the photos that are new.
 */
import type { AstroIntegration } from 'astro';
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FORMATS, OUT_DIR, PHOTO_EXT, PHOTO_ROOT, planFromBytes, type Format } from '../lib/photo';

function walk(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : PHOTO_EXT.test(name) ? [p] : [];
  });
}

const ENCODE: Record<Format, Record<string, number | boolean>> = {
  avif: { quality: 52, effort: 4 },
  webp: { quality: 78, effort: 4 },
};

export default function photos(): AstroIntegration {
  let root = process.cwd();
  return {
    name: 'provident-photos',
    hooks: {
      'astro:config:done': ({ config }) => {
        root = fileURLToPath(config.root);
      },
      'astro:build:done': async ({ dir, logger }) => {
        const files = walk(join(root, 'public', PHOTO_ROOT));
        if (files.length === 0) return logger.info('no photos in public/images yet');
        // loaded by Node itself (the config's module runner is closed by the time the build is done)
        const sharp = createRequire(import.meta.url)('sharp') as typeof import('sharp').default;
        const out = join(fileURLToPath(dir), OUT_DIR);
        const cache = join(root, 'node_modules', '.cache', 'provident-photos');
        mkdirSync(out, { recursive: true });
        mkdirSync(cache, { recursive: true });
        let made = 0;
        let reused = 0;
        for (const file of files) {
          const bytes = readFileSync(file);
          const plan = planFromBytes(bytes);
          if (!plan) {
            logger.warn(`skipped (not a readable photo): ${file}`);
            continue;
          }
          for (const w of plan.widths) {
            for (const f of FORMATS) {
              const name = `${plan.hash}-${w}.${f}`;
              const cached = join(cache, name);
              if (!existsSync(cached)) {
                await sharp(bytes, { animated: false })
                  .rotate()
                  .resize({ width: w, withoutEnlargement: true })
                  [f](ENCODE[f])
                  .toFile(cached);
                made++;
              } else reused++;
              copyFileSync(cached, join(out, name));
            }
          }
        }
        logger.info(`${files.length} photos: ${made} sizes made, ${reused} reused (dist/${OUT_DIR})`);
      },
    },
  };
}
