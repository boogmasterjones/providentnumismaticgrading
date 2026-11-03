import type { APIRoute } from 'astro';
import { config, currentSession, handle, json, service } from '../../../lib/studio/server';
import { PAGES } from '../../../lib/studio/pages';

export const prerender = false;

/** Everything the dashboard needs in one call: who is signed in, the storage mode, pages, posts, coins, changes. */
export const GET: APIRoute = ({ request }) =>
  handle(async () => {
    const cfg = config();
    const session = currentSession(request, cfg);
    const svc = service(cfg);
    const [posts, notable, changes, home] = await Promise.all([svc.listPosts(), svc.listNotable(), svc.changes(), svc.readDoc('page:home')]);
    return json({
      email: session?.email ?? '',
      mode: svc.store.mode,
      pages: PAGES,
      posts: posts.map((p) => ({ slug: p.slug, title: p.data.title, date: p.data.date, draft: Boolean(p.data.draft), cover: p.data.cover ?? null })),
      notable: notable.map((c) => ({ ...c.data, slug: c.slug })),
      changes,
      slides: Array.isArray(home.data.carousel) ? home.data.carousel.length : 0,
    });
  });
