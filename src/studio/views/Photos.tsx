/** The photo library: every uploaded photo, where it is used, upload new ones, delete unused ones. */
import { useCallback, useEffect, useRef, useState } from 'react';
import { api, viewSrc } from '../api';
import { prepareImage } from '../image';
import { useStudio } from '../state';
import { Button, Empty, Loading, PageHead } from '../ui';
import type { Photo } from '../../lib/studio/service';

const FOLDERS: Record<string, string> = { home: 'Slideshow', notable: 'Notable coins', blog: 'Journal', gallery: 'Library', pages: 'Pages', certificates: 'Certificates' };

export function Photos() {
  const { fail, toast, confirm, version, refresh } = useStudio();
  const [photos, setPhotos] = useState<Photo[] | null>(null);
  const [filter, setFilter] = useState('all');
  const [busy, setBusy] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  const load = useCallback(() => {
    api.photos().then(setPhotos, fail);
  }, [fail]);
  useEffect(load, [load, version]);

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    try {
      for (const [i, f] of [...files].entries()) {
        setBusy(`Uploading ${i + 1} of ${files.length}…`);
        await api.upload(await prepareImage(f), 'gallery');
      }
      toast(files.length === 1 ? 'Photo uploaded.' : `${files.length} photos uploaded.`);
      load();
      void refresh();
    } catch (e) {
      fail(e);
    } finally {
      setBusy(null);
      if (input.current) input.current.value = '';
    }
  }

  async function remove(p: Photo) {
    if (!(await confirm({ title: 'Delete this photo?', body: `“${p.name}” is not used anywhere on the website. It is removed from the library when you publish.`, confirm: 'Delete photo', danger: true }))) return;
    try {
      await api.deletePhoto(p.path);
      toast('Photo deleted.');
      load();
      void refresh();
    } catch (e) {
      fail(e);
    }
  }

  const folders = photos ? [...new Set(photos.map((p) => p.folder))] : [];
  const shown = photos?.filter((p) => filter === 'all' || p.folder === filter) ?? [];

  return (
    <div className="st-page">
      <PageHead
        back
        title="Photo library"
        lead="Every photo you have uploaded. Upload photos here to use them anywhere: choose “Your photos” when you change a photo on a page."
        actions={
          <>
            <Button kind="primary" icon="upload" onClick={() => input.current?.click()} busy={!!busy}>
              {busy ?? 'Upload photos'}
            </Button>
            <input ref={input} type="file" accept="image/*" multiple hidden onChange={(e) => void upload(e.target.files)} />
          </>
        }
      />
      {!photos ? (
        <Loading />
      ) : photos.length === 0 ? (
        <Empty icon="photo" title="No photos yet" action={<Button kind="primary" icon="upload" onClick={() => input.current?.click()}>Upload photos</Button>}>
          Real photos only: your slabs, coins and grading room. Large photos are made smaller automatically.
        </Empty>
      ) : (
        <>
          {folders.length > 1 && (
            <div className="st-filters" role="group" aria-label="Show photos from">
              {['all', ...folders].map((f) => (
                <button key={f} type="button" className={filter === f ? 'on' : ''} aria-pressed={filter === f} onClick={() => setFilter(f)}>
                  {f === 'all' ? 'All' : FOLDERS[f] ?? f}
                </button>
              ))}
            </div>
          )}
          <ul className="st-photo-grid">
            {shown.map((p) => (
              <li key={p.path} className="st-photo">
                <img src={viewSrc(p.src)} alt="" loading="lazy" />
                <div className="st-photo-meta">
                  <span className="st-photo-name" title={p.name}>
                    {p.name}
                  </span>
                  <span className="st-muted">{p.usedBy.length ? `Used on: ${p.usedBy.join(', ')}` : 'Not used yet'}</span>
                </div>
                {!p.usedBy.length && FOLDERS[p.folder] && p.folder !== 'certificates' && (
                  <Button small kind="ghost" icon="trash" label={`Delete ${p.name}`} onClick={() => void remove(p)} />
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
