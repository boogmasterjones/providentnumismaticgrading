/**
 * The shapes of the content files, shared by the build (src/content.config.ts) and by Provident Studio's live
 * preview (src/lib/content.ts), so a page renders the same way from either source.
 * The editing rules (labels, limits, help text) live in src/lib/studio/schema.ts.
 */
import { z } from 'astro/zod';

/** A repeatable block (a step, a principle, a section). Mirrors `sections()` in keystatic.config.ts. */
export const sectionSchema = z.object({
  mark: z.string().nullish(),
  title: z.string(),
  summary: z.string().nullish(),
  text: z.string().nullish(),
  points: z.array(z.string()).nullish(),
});
const opt = z.string().nullish();

/** The closing band of an inner page: a statement, an optional line and one or two links. */
export const codaSchema = z.object({
  title: z.string(),
  text: opt,
  links: z.array(z.object({ label: z.string(), href: z.string() })).nullish(),
});

/**
 * Page text (content/pages/<id>.mdoc). Every page has the common fields; the structured pages add their own optional
 * ones.
 */
export const pageSchema = z.object({
  metaTitle: z.string(),
  metaDescription: z.string(),
  eyebrow: opt,
  heading: z.string(),
  intro: z.string().nullish().default(''),
  sections: z.array(sectionSchema).nullish(),
  coda: codaSchema.nullish(),
  // home
  primaryButton: opt,
  secondaryButton: opt,
  carousel: z.array(z.object({ image: z.string(), alt: z.string(), caption: opt })).nullish(),
  notableEyebrow: opt,
  notableTitle: opt,
  notableIntro: opt,
  gradeEyebrow: opt,
  gradeTitle: opt,
  grades: z.array(sectionSchema).nullish(),
  film: z.array(sectionSchema).nullish(),
  processEyebrow: opt,
  processTitle: opt,
  processText: opt,
  processLink: opt,
  holderEyebrow: opt,
  holderTitle: opt,
  holderText: opt,
  holderLink: opt,
  verifyEyebrow: opt,
  verifyTitle: opt,
  verifyText: opt,
  // about
  servicesEyebrow: opt,
  servicesTitle: opt,
  // grading standards
  scaleEyebrow: opt,
  scaleTitle: opt,
  scale: z.array(z.object({ range: z.string(), code: opt, name: z.string(), text: opt })).nullish(),
  // holder
  anatomyEyebrow: opt,
  anatomyText: opt,
  // submissions
  feesEyebrow: opt,
  feesTitle: opt,
  feesText: opt,
  feesLink: opt,
  requestEyebrow: opt,
  requestTitle: opt,
  requestText: opt,
  // contact
  directTitle: opt,
  formTitle: opt,
  // verify
  verifyNote: opt,
  // journal list
  emptyText: opt,
});

export const postSchema = z.object({
  title: z.string(),
  date: z.coerce.date(),
  description: z.string(),
  cover: z.string().nullish(),
  coverAlt: z.string().nullish(),
  draft: z.boolean().optional().default(false),
});

export type PageData = z.infer<typeof pageSchema>;
export type PostData = z.infer<typeof postSchema>;
export type Coda = z.infer<typeof codaSchema>;
