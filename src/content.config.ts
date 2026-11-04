import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { pageSchema, postSchema } from './lib/schemas';

/**
 * Page text edited in Provident Studio (/admin). One .mdoc file per page in content/pages. The shapes are shared with
 * Studio's live preview: src/lib/schemas.ts.
 */
const pages = defineCollection({
  loader: glob({ pattern: '*.mdoc', base: './content/pages' }),
  schema: pageSchema,
});

const blog = defineCollection({
  loader: glob({ pattern: '*.mdoc', base: './content/blog' }),
  schema: postSchema,
});

export const collections = { pages, blog };
