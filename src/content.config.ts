import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

/** A repeatable block edited in Keystatic (a step, a principle, a section). Mirrors `sections()` in keystatic.config.ts. */
const section = z.object({
  mark: z.string().nullish(),
  title: z.string(),
  summary: z.string().nullish(),
  text: z.string().nullish(),
  points: z.array(z.string()).nullish(),
});
const opt = z.string().nullish();

/**
 * Page text edited in Keystatic (Pages section). One .mdoc file per page in content/pages. Every page has the common
 * fields; the structured pages (home, process, standards, holder, why, about, submissions) add their own optional ones.
 */
const pages = defineCollection({
  loader: glob({ pattern: '*.mdoc', base: './content/pages' }),
  schema: z.object({
    metaTitle: z.string(),
    metaDescription: z.string(),
    eyebrow: opt,
    heading: z.string(),
    intro: z.string().nullish().default(''),
    sections: z.array(section).nullish(),
    // home
    primaryButton: opt,
    secondaryButton: opt,
    gradeTitle: opt,
    gradeIntro: opt,
    grades: z.array(section).nullish(),
    approachTitle: opt,
    approachText: opt,
    principles: z.array(section).nullish(),
    film: z.array(section).nullish(),
    processTitle: opt,
    processText: opt,
    holderTitle: opt,
    holderText: opt,
    verifyTitle: opt,
    verifyText: opt,
    closingTitle: opt,
    closingText: opt,
    // grading standards
    scale: z.array(z.object({ range: z.string(), code: opt, name: z.string(), text: opt })).nullish(),
    // submissions
    feesTitle: opt,
    feesText: opt,
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
