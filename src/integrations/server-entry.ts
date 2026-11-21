/**
 * Build step: copies the Node server entry (server/start.mjs and server/headers.mjs) next to Astro's own
 * dist/server/entry.mjs, so Hostinger can start it as "server/start.mjs" (relative to the "dist" output folder).
 */
import type { AstroIntegration } from 'astro';
import { copyFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

export default function serverEntry(): AstroIntegration {
  let root = process.cwd();
  let serverDir = '';
  return {
    name: 'provident-server-entry',
    hooks: {
      'astro:config:done': ({ config }) => {
        root = fileURLToPath(config.root);
        serverDir = fileURLToPath(config.build.server);
      },
      'astro:build:done': ({ logger }) => {
        const src = join(root, 'server');
        const files = readdirSync(src).filter((f) => f.endsWith('.mjs'));
        for (const f of files) copyFileSync(join(src, f), join(serverDir, f));
        logger.info(`copied ${files.join(', ')} into ${serverDir}`);
      },
    },
  };
}
