import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

/** Page text edited in Keystatic (Pages section). One .mdoc file per page in content/pages. */
const pages = defineCollection({
  loader: glob({ pattern: '*.mdoc', base: './content/pages' }),
  schema: z.object({
    metaTitle: z.string(),
    metaDescription: z.string(),
    heading: z.string(),
    intro: z.string().optional().default(''),
    primaryButton: z.string().optional(),
    secondaryButton: z.string().optional(),
  }),
});

const blog = defineCollection({
  loader: glob({ pattern: '*.mdoc', base: './content/blog' }),
  schema: z.object({
    title: z.string(),
    date: z.coerce.date(),
    description: z.string(),
    cover: z.string().nullish(),
    coverAlt: z.string().nullish(),
    draft: z.boolean().optional().default(false),
  }),
});

export const collections = { pages, blog };
