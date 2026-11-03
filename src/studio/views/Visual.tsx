/**
 * The visual editor: the real page in a frame, with the in-page editor (src/scripts/studio-overlay.ts). The frame
 * asks this window to save, to open photo and detail panels and to change lists; this window does the API calls,
 * confirmations, toasts and undo, then reloads the frame where needed.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../api';
import { useStudio } from '../state';
import { Button, Icon } from '../ui';
import { DocSheet } from '../DocSheet';
import { ImagePicker, type PickResult } from '../ImagePicker';
import { CoinSheet } from './Coins';
import { getAt, setAt, type Data } from '../../lib/studio/ops';
import { docType, fieldAt } from '../../lib/studio/schema';
import { pageForPath } from '../../lib/studio/pages';

type Msg = Record<string, unknown> & { t: string; source?: string; id?: string };

const previewUrl = (path: string) => `/admin/preview${path === '/' ? '' : path}`;
const HINT_KEY = 'provident-studio-hint-closed';

export function Visual({ page }: { page: string }) {
  const { overview, saved, fail, confirm, toast } = useStudio();
  const frame = useRef<HTMLIFrameElement>(null);
  const [device, setDevice] = useState<'desktop' | 'phone'>(() => (matchMedia('(max-width: 700px)').matches ? 'phone' : 'desktop'));
  const [loading, setLoading] = useState(true);
  const [sheet, setSheet] = useState<null | { kind: 'doc'; doc: string; path: string; title?: string } | { kind: 'coin'; slug?: string } | { kind: 'page' }>(null);
  const [picker, setPicker] = useState<null | {
    title: string;
    folder: string;
    current: string | null;
    alt?: string | null;
    altRequired?: boolean;
    removable: boolean;
    removeLabel?: string;
    done: (r: PickResult) => Promise<void> | void;
    cancel?: () => void;
  }>(null);
  const [hint, setHint] = useState(() => {
    try {
      return localStorage.getItem(HINT_KEY) !== '1';
    } catch {
      return true;
    }
  });

  const current = pageForPath(page);
  const post = overview?.posts.find((p) => `/blog/${p.slug}` === page);
  const docOfPage = current ? `page:${current.id}` : post ? `post:${post.slug}` : null;

  const reply = useCallback((id: unknown, body: Record<string, unknown>) => {
    frame.current?.contentWindow?.postMessage({ source: 'studio-app', t: 'result', id, ...body }, location.origin);
  }, []);
  const reload = useCallback(() => {
    frame.current?.contentWindow?.postMessage({ source: 'studio-app', t: 'reload' }, location.origin);
  }, []);
  const go = useCallback((path: string) => {
    location.hash = `#/edit?page=${encodeURIComponent(path)}`;
  }, []);

  /** Save a photo (and its description) into a field of a document, as one change. */
  const savePhoto = useCallback(
    async (doc: string, path: string, altRef: string | null, r: PickResult, label: string) => {
      const d = await api.doc(doc);
      let data: Data = d.data;
      if (r.remove) data = setAt(data, path, '');
      else {
        data = setAt(data, path, r.src);
        if (altRef && r.alt !== undefined) data = setAt(data, altRef.split('|')[1], r.alt);
      }
      const top = path.split('.')[0];
      const tops = new Set([top, altRef ? altRef.split('|')[1].split('.')[0] : top]);
      const payload: Data = {};
      for (const k of tops) payload[k] = data[k];
      saved(label, await api.saveDoc(doc, payload));
    },
    [saved],
  );

  const addItem = useCallback(
    async (doc: string, path: string, index: number, canNew: boolean, noun: string) => {
      if (path === '@notable') return setSheet({ kind: 'coin' });
      const type = docType(doc);
      const f = type ? fieldAt(type, path) : null;
      if (!f || f.kind !== 'list') return;
      if (canNew || f.newItem) {
        saved(`Added a ${noun}`, await api.list(doc, path, 'add', index));
        reload();
        return;
      }
      // a new slide or photo needs a photo first
      const item = f.item.kind === 'object' ? f.item : null;
      const imgKey = item && Object.entries(item.fields).find(([, x]) => x.kind === 'image')?.[0];
      if (item && imgKey) {
        const imgField = item.fields[imgKey];
        setPicker({
          title: `Add a ${noun}`,
          folder: imgField.kind === 'image' ? imgField.folder : 'gallery',
          current: null,
          alt: '',
          removable: false,
          done: async (r) => {
            const altKey = imgField.kind === 'image' ? imgField.altField : undefined;
            saved(`Added a ${noun}`, await api.list(doc, path, 'add', index, { [imgKey]: r.src, ...(altKey ? { [altKey]: r.alt ?? '' } : {}) }));
            setPicker(null);
            reload();
          },
        });
        return;
      }
      setSheet({ kind: 'doc', doc, path, title: `Add a ${noun}` });
    },
    [saved, reload],
  );

  const onMessage = useCallback(
    async (e: MessageEvent) => {
      if (e.origin !== location.origin || e.source !== frame.current?.contentWindow) return;
      const m = e.data as Msg;
      if (!m || m.source !== 'studio-overlay') return;
      try {
        switch (m.t) {
          case 'ready': {
            setLoading(false);
            const p = String(m.path ?? '/');
            if (p !== page) go(p);
            break;
          }
          case 'navigate':
            go(String(m.path));
            break;
          case 'toast':
            toast(String(m.msg), 'info');
            break;
          case 'save': {
            try {
              const r = await api.field(String(m.doc), String(m.path), m.value);
              saved(String(m.label ?? 'text'), r);
              reply(m.id, { ok: true });
            } catch (err) {
              reply(m.id, { ok: false, error: err instanceof Error ? err.message : 'Could not save.' });
            }
            break;
          }
          case 'image': {
            const doc = String(m.doc);
            const path = String(m.path);
            const altRef = (m.alt as string | null) ?? null;
            let alt: string | undefined;
            if (altRef) alt = String(getAt((await api.doc(altRef.split('|')[0])).data, altRef.split('|')[1]) ?? '');
            const src = String(m.src ?? '').replace(/^\/api\/studio\/media/, '');
            setPicker({
              title: String(m.label ?? 'Photo'),
              folder: String(m.folder ?? 'gallery'),
              current: src || null,
              alt: altRef ? alt : undefined,
              removable: m.removable === true,
              done: async (r) => {
                await savePhoto(doc, path, altRef, r, r.remove ? 'Removed a photo' : 'Photo');
                setPicker(null);
                reload();
              },
            });
            break;
          }
          case 'pickImage': {
            const id = m.id;
            setPicker({
              title: m.src ? 'Photo in the text' : 'Insert a photo',
              folder: String(m.folder ?? 'pages'),
              current: m.src ? String(m.src).replace(/^\/api\/studio\/media/, '') : null,
              alt: String(m.alt ?? ''),
              altRequired: true,
              removable: m.removable === true,
              done: (r) => {
                reply(id, { ok: true, src: r.src ? (overview?.mode === 'github' ? `/api/studio/media${r.src}` : r.src) : undefined, alt: r.alt, remove: r.remove });
                setPicker(null);
              },
              cancel: () => reply(id, { ok: false }),
            });
            break;
          }
          case 'panel': {
            const doc = String(m.doc);
            const path = String(m.path ?? '');
            if (doc.startsWith('notable:') && !path) setSheet({ kind: 'coin', slug: doc.slice(8) });
            else setSheet({ kind: 'doc', doc, path });
            break;
          }
          case 'add':
            await addItem(String(m.doc), String(m.path), -1, false, String(m.path) === 'carousel' ? 'slideshow photo' : 'item');
            break;
          case 'list': {
            const doc = String(m.doc);
            const path = String(m.path);
            const op = m.op as 'up' | 'down' | 'add' | 'remove';
            const index = Number(m.index);
            const noun = String(m.noun ?? 'item');
            if (op === 'add') return void (await addItem(doc, path, index, m.canNew === true, noun));
            if (path === '@notable') {
              const slug = doc.slice('notable:'.length);
              if (op === 'remove') {
                if (!(await confirm({ title: 'Remove this coin from the website?', body: 'It disappears from the home page when you publish. You can undo this before you publish.', confirm: 'Remove coin', danger: true }))) return;
                saved('Removed a notable coin', await api.remove(doc));
              } else {
                const r = await api.moveCoin(slug, op);
                saved('Moved a notable coin', r.results);
              }
              reload();
              return;
            }
            if (op === 'remove' && !(await confirm({ title: `Remove this ${noun}?`, body: 'You can undo this until you publish.', confirm: `Remove ${noun}`, danger: true }))) return;
            saved(op === 'remove' ? `Removed a ${noun}` : `Moved a ${noun}`, await api.list(doc, path, op, index));
            reload();
            break;
          }
        }
      } catch (err) {
        fail(err);
      }
    },
    [page, go, toast, saved, reply, reload, savePhoto, addItem, confirm, fail, overview?.mode],
  );

  useEffect(() => {
    const h = (e: MessageEvent) => void onMessage(e);
    addEventListener('message', h);
    return () => removeEventListener('message', h);
  }, [onMessage]);

  useEffect(() => setLoading(true), [page]);

  const options = [
    ...(overview?.pages ?? []).map((p) => ({ value: p.path, label: p.label })),
  ];

  return (
    <div className="st-visual">
      <div className="st-vbar">
        <a className="st-btn st-btn-ghost st-btn-icon st-vbar-back" href="#/" aria-label="Back to the dashboard" title="Dashboard">
          <Icon name="back" />
        </a>
        <label className="st-pagepick">
          <span className="st-sr">Page</span>
          <Icon name="page" size={18} />
          <select value={page} onChange={(e) => go(e.target.value)}>
            <optgroup label="Pages">
              {options.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </optgroup>
            {overview && overview.posts.length > 0 && (
              <optgroup label="Journal posts">
                {overview.posts.map((p) => (
                  <option key={p.slug} value={`/blog/${p.slug}`}>
                    {p.title}
                    {p.draft ? ' (hidden)' : ''}
                  </option>
                ))}
              </optgroup>
            )}
            {!current && !post && <option value={page}>{page}</option>}
          </select>
        </label>
        <div className="st-seg" role="group" aria-label="Preview size">
          <button type="button" aria-pressed={device === 'desktop'} className={device === 'desktop' ? 'on' : ''} onClick={() => setDevice('desktop')} title="Computer">
            <Icon name="desktop" size={18} />
            <span className="st-hide-sm">Computer</span>
          </button>
          <button type="button" aria-pressed={device === 'phone'} className={device === 'phone' ? 'on' : ''} onClick={() => setDevice('phone')} title="Phone">
            <Icon name="phone" size={18} />
            <span className="st-hide-sm">Phone</span>
          </button>
        </div>
        <span className="st-grow" />
        {docOfPage && (
          <Button kind="ghost" icon="settings" onClick={() => setSheet(post ? { kind: 'doc', doc: docOfPage, path: '', title: 'Post settings' } : { kind: 'page' })}>
            <span className="st-hide-sm">{post ? 'Post settings' : 'Page settings'}</span>
          </Button>
        )}
        <a className="st-btn st-btn-ghost st-btn-icon" href={page} target="_blank" rel="noopener" title="Open the live page in a new tab" aria-label="Open the live page in a new tab">
          <Icon name="external" size={18} />
        </a>
      </div>
      {hint && (
        <div className="st-hint" role="note">
          <Icon name="edit" size={18} />
          <p>
            <strong>Click any words to change them,</strong> or a photo to replace it. Lists have <em>Move</em>, <em>Add</em> and <em>Remove</em> buttons when you point at them
            (tap them on a phone). Changes save as drafts until you publish.
          </p>
          <button
            type="button"
            className="st-btn st-btn-ghost st-btn-small"
            onClick={() => {
              setHint(false);
              try {
                localStorage.setItem(HINT_KEY, '1');
              } catch {
                /* private mode */
              }
            }}
          >
            Got it
          </button>
        </div>
      )}
      <div className={`st-stage st-stage-${device}`}>
        <div className="st-frame-wrap">
          {loading && (
            <div className="st-frame-loading" role="status">
              <span className="st-spin" aria-hidden="true" /> Loading the page…
            </div>
          )}
          <iframe ref={frame} key={page} src={previewUrl(page)} title={`Editable preview: ${current?.label ?? post?.title ?? page}`} />
        </div>
      </div>
      {sheet?.kind === 'doc' && <DocSheet doc={sheet.doc} path={sheet.path} title={sheet.title} onClose={() => setSheet(null)} onSaved={reload} />}
      {sheet?.kind === 'page' && docOfPage && (
        <DocSheet doc={docOfPage} title={`${current?.label ?? 'Page'}: settings`} subtitle="Everything on this page, including how it shows on Google." omit={['body']} onClose={() => setSheet(null)} onSaved={reload} />
      )}
      {sheet?.kind === 'coin' && <CoinSheet slug={sheet.slug} onClose={() => setSheet(null)} onSaved={reload} />}
      {picker && (
        <ImagePicker
          title={picker.title}
          folder={picker.folder}
          current={picker.current}
          alt={picker.alt}
          altRequired={picker.altRequired ?? true}
          removable={picker.removable}
          removeLabel={picker.removeLabel}
          onClose={() => {
            picker.cancel?.();
            setPicker(null);
          }}
          onDone={async (r) => {
            try {
              await picker.done(r);
            } catch (e) {
              fail(e);
            }
          }}
        />
      )}
    </div>
  );
}
