/** Studio's calls to its server routes (/api/studio/…). Signed-out replies send the browser to the sign-in page. */
import type { ChangeView, Photo, SaveResult } from '../lib/studio/service';
import type { PublishResult } from '../lib/studio/store';
import type { StudioPage } from '../lib/studio/pages';
import type { Data } from '../lib/studio/ops';

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public problems: { path: string; message: string }[] = [],
  ) {
    super(message);
  }
}

async function call<T>(method: 'GET' | 'POST', url: string, body?: unknown, form?: FormData): Promise<T> {
  let r: Response;
  try {
    r = await fetch(url, {
      method,
      credentials: 'same-origin',
      headers: form ? undefined : body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: form ?? (body !== undefined ? JSON.stringify(body) : undefined),
    });
  } catch {
    throw new ApiError('No connection. Check your internet and try again. Nothing was changed.', 0);
  }
  const j = (await r.json().catch(() => ({}))) as { error?: string; signedOut?: boolean; problems?: { path: string; message: string }[] };
  if (r.status === 401 || j.signedOut) {
    location.href = `/admin/login?next=${encodeURIComponent('/admin' + location.hash)}`;
    throw new ApiError('Please sign in again.', 401);
  }
  if (!r.ok) throw new ApiError(j.error ?? `Something went wrong (${r.status}).`, r.status, j.problems ?? []);
  return j as T;
}

export interface Overview {
  email: string;
  mode: 'local' | 'github';
  pages: StudioPage[];
  posts: { slug: string; title: string; date: string; draft: boolean; cover: string | null }[];
  notable: (Data & { slug: string })[];
  changes: ChangeView[];
  slides: number;
}

export interface DocReply {
  doc: string;
  file: string;
  data: Data;
  body: string;
  bodyHtml: string;
  exists: boolean;
}

let mode: 'local' | 'github' = 'local';
export const setMode = (m: 'local' | 'github') => (mode = m);
/** In GitHub mode new photos exist only in the drafts until Publish, so Studio shows them through its media route. */
export const viewSrc = (src: string | null | undefined) =>
  !src ? '' : mode === 'github' && src.startsWith('/images/') ? `/api/studio/media${src}` : src;

export const api = {
  overview: () => call<Overview>('GET', '/api/studio/overview'),
  doc: (doc: string) => call<DocReply>('GET', `/api/studio/doc?doc=${encodeURIComponent(doc)}`),
  saveDoc: (doc: string, data: Data, body?: string) => call<SaveResult>('POST', '/api/studio/doc', { doc, data, body }),
  field: (doc: string, path: string, value: unknown) => call<SaveResult>('POST', '/api/studio/field', { doc, path, value }),
  list: (doc: string, path: string, op: 'add' | 'remove' | 'up' | 'down', index: number, item?: unknown) =>
    call<SaveResult>('POST', '/api/studio/list', { doc, path, op, index, item }),
  createCoin: (data: Data) => call<SaveResult & { slug: string }>('POST', '/api/studio/notable', { action: 'create', data }),
  moveCoin: (slug: string, dir: 'up' | 'down') => call<{ results: SaveResult[] }>('POST', '/api/studio/notable', { action: 'move', slug, dir }),
  createPost: (data: Data, body: string) => call<SaveResult & { slug: string }>('POST', '/api/studio/posts', { data, body }),
  remove: (doc: string) => call<SaveResult>('POST', '/api/studio/remove', { doc }),
  restore: (file: string, before: string | null) => call<{ ok: true }>('POST', '/api/studio/restore', { file, before }),
  photos: () => call<Photo[]>('GET', '/api/studio/photos'),
  deletePhoto: (path: string) => call<{ ok: true }>('POST', '/api/studio/photos', { path }),
  upload: (file: File, folder: string) => {
    const f = new FormData();
    f.append('file', file);
    f.append('folder', folder);
    return call<{ path: string; src: string }>('POST', '/api/studio/upload', undefined, f);
  },
  changes: () => call<ChangeView[]>('GET', '/api/studio/changes'),
  undo: (path: string) => call<{ ok: true; changes: ChangeView[] }>('POST', '/api/studio/undo', { path }),
  undoAll: () => call<{ ok: true; changes: ChangeView[] }>('POST', '/api/studio/undo', { all: true }),
  publish: () => call<PublishResult>('POST', '/api/studio/publish', {}),
  logout: () => call<{ ok: true }>('POST', '/api/studio/logout', {}),
};
