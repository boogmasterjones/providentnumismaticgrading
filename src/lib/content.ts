/**
 * How templates get their content. Public pages read the built content (astro:content and the JSON files, at build
 * time). Inside Provident Studio's live preview the middleware puts the drafts in Astro.locals.studio, and the same
 * templates render those instead, so the editor shows exactly what the site will look like after Publish.
 */
import Markdoc from '@markdoc/markdoc';
import { getCollection, getEntry, type CollectionEntry } from 'astro:content';
import type { AstroGlobal } from 'astro';
import { pageSchema, postSchema, type PageData, type PostData } from './schemas';
import { faq, gallery, settings, withFaqDefaults, withGalleryDefaults, withSettingsDefaults, type Faq, type Gallery, type SiteSettings } from './site';
import { notableCoins, parseNotable, type NotableCoin } from './notable';
import type { Snapshot } from './studio/service';

export interface StudioLocals {
  edit: true;
  /** the public address being previewed, e.g. "/process" */
  path: string;
  snapshot: Snapshot;
  mode: 'local' | 'github';
}

type Ctx = Pick<AstroGlobal, 'locals'>;

export const studioOf = (Astro: Ctx): StudioLocals | undefined => Astro.locals.studio;
export const isEditing = (Astro: Ctx) => Boolean(Astro.locals.studio?.edit);

/** A page or post body: the built entry (rendered by astro:content), or HTML rendered from a draft. */
export interface BodyRef {
  entry?: CollectionEntry<'pages'> | CollectionEntry<'blog'>;
  html?: string;
}

/** Markdoc to HTML for the preview (the build uses @astrojs/markdoc; plain Markdoc gives the same tags here). */
export function renderMarkdoc(source: string): string {
  const ast = Markdoc.parse(source);
  // Markdoc wraps the document in <article>; the build (@astrojs/markdoc) does not, so neither does the preview.
  return Markdoc.renderers.html(Markdoc.transform(ast)).replace(/^<article>([\s\S]*)<\/article>$/, '$1');
}

export function getSettings(Astro: Ctx): SiteSettings {
  const s = studioOf(Astro);
  return s ? withSettingsDefaults(s.snapshot.settings) : settings;
}

export function getFaq(Astro: Ctx): Faq {
  const s = studioOf(Astro);
  return s ? withFaqDefaults(s.snapshot.faq) : faq;
}

export function getGallery(Astro: Ctx): Gallery {
  const s = studioOf(Astro);
  return s ? withGalleryDefaults(s.snapshot.gallery) : gallery;
}

export function getNotable(Astro: Ctx): NotableCoin[] {
  const s = studioOf(Astro);
  if (!s) return notableCoins();
  return parseNotable(Object.entries(s.snapshot.notable).map(([slug, d]) => [`${slug}.json`, d as Partial<NotableCoin>] as const));
}

/** One page's text (content/pages/<id>.mdoc) and its body. */
export async function loadPage(Astro: Ctx, id: string): Promise<{ data: PageData; body: BodyRef; hasBody: boolean }> {
  const s = studioOf(Astro);
  if (s) {
    const p = s.snapshot.pages[id];
    if (!p) throw new Error(`Missing page text: content/pages/${id}.mdoc`);
    const data = pageSchema.parse(p.data);
    return { data, body: { html: renderMarkdoc(p.body) }, hasBody: Boolean(p.body.trim()) };
  }
  const entry = await getEntry('pages', id);
  if (!entry) throw new Error(`Missing page text: content/pages/${id}.mdoc`);
  return { data: entry.data, body: { entry }, hasBody: Boolean(entry.body && entry.body.trim()) };
}

export interface Post {
  id: string;
  data: PostData;
  body: BodyRef;
}

/**
 * Journal posts, newest first. Hidden (draft) posts are left out of the site; Studio's preview includes them so they
 * can be edited before they go live.
 */
export async function getPosts(Astro: Ctx): Promise<Post[]> {
  const s = studioOf(Astro);
  let posts: Post[];
  if (s) {
    posts = Object.entries(s.snapshot.posts).flatMap(([id, p]) => {
      const r = postSchema.safeParse(p.data);
      return r.success ? [{ id, data: r.data, body: { html: renderMarkdoc(p.body) } }] : [];
    });
  } else {
    posts = (await getCollection('blog', (p) => !p.data.draft)).map((entry) => ({ id: entry.id, data: entry.data, body: { entry } }));
  }
  return posts.sort((a, b) => b.data.date.getTime() - a.data.date.getTime());
}
