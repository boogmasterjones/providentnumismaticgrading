import { getEntry, render } from 'astro:content';

/** Load one page's editable text (content/pages/<id>.mdoc) and its rendered body. */
export async function loadPage(id: string) {
  const entry = await getEntry('pages', id);
  if (!entry) throw new Error(`Missing page text: content/pages/${id}.mdoc`);
  const { Content } = await render(entry);
  return { data: entry.data, Content, hasBody: Boolean(entry.body && entry.body.trim()) };
}

export type PageSection = {
  mark?: string | null;
  title: string;
  summary?: string | null;
  text?: string | null;
  points?: string[] | null;
};
