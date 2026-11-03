/** Choosing a photo: upload a new one (resized in the browser) or pick one already in the photo library. */
import { useEffect, useRef, useState } from 'react';
import { api, viewSrc } from './api';
import { prepareImage } from './image';
import { Button, Icon, Loading, Sheet } from './ui';
import type { Photo } from '../lib/studio/service';

export interface PickResult {
  src?: string;
  alt?: string;
  remove?: boolean;
}

export function ImagePicker({
  title = 'Photo',
  folder,
  current,
  alt,
  altRequired = true,
  removable,
  removeLabel = 'Remove photo',
  onDone,
  onClose,
}: {
  title?: string;
  folder: string;
  current?: string | null;
  /** the photo's description; undefined = this photo has no description field */
  alt?: string | null;
  altRequired?: boolean;
  removable?: boolean;
  removeLabel?: string;
  onDone: (r: PickResult) => void | Promise<void>;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<'upload' | 'library'>('upload');
  const [src, setSrc] = useState<string>(current ?? '');
  const [desc, setDesc] = useState<string>(alt ?? '');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [photos, setPhotos] = useState<Photo[] | null>(null);
  const [drag, setDrag] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const hasAlt = alt !== undefined;

  useEffect(() => {
    if (tab === 'library' && !photos) api.photos().then(setPhotos, (e: Error) => setError(e.message));
  }, [tab, photos]);

  async function upload(file: File | undefined) {
    if (!file) return;
    setError(null);
    setBusy('Preparing the photo…');
    try {
      const ready = await prepareImage(file, folder === 'notable' ? 1600 : undefined);
      setBusy('Uploading…');
      const r = await api.upload(ready, folder);
      setSrc(r.src);
      setPhotos(null);
      if (hasAlt && !desc) setDesc('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The upload failed.');
    } finally {
      setBusy(null);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function finish() {
    if (!src) return setError('Choose or upload a photo first.');
    if (hasAlt && altRequired && !desc.trim()) return setError('Describe the photo in a few words (for blind visitors and Google).');
    setBusy('Saving…');
    try {
      await onDone({ src, alt: hasAlt ? desc.trim() : undefined });
    } finally {
      setBusy(null);
    }
  }

  const changed = src !== (current ?? '') || (hasAlt && desc !== (alt ?? ''));

  return (
    <Sheet
      title={title}
      subtitle="Upload a new photo, or choose one you have already uploaded."
      onClose={onClose}
      footer={
        <>
          {removable && current && (
            <Button kind="danger" icon="trash" onClick={() => void onDone({ remove: true })} disabled={!!busy}>
              {removeLabel}
            </Button>
          )}
          <span className="st-grow" />
          <Button kind="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button kind="primary" icon="check" onClick={() => void finish()} busy={busy === 'Saving…'} disabled={!!busy || !src || (!changed && !!current)}>
            {current ? 'Save' : 'Use this photo'}
          </Button>
        </>
      }
    >
      <div className="st-picker-preview">
        {src ? <img src={viewSrc(src)} alt="" /> : <div className="st-picker-none"><Icon name="photo" size={34} /><span>No photo chosen yet</span></div>}
      </div>
      {hasAlt && (
        <label className="st-field">
          <span className="st-field-label">
            Describe the photo{altRequired && <span className="st-req"> (needed)</span>}
          </span>
          <span className="st-help">A few words for blind visitors and for Google, e.g. "1909-S VDB cent in its holder, front".</span>
          <input type="text" value={desc} maxLength={160} onChange={(e) => setDesc(e.target.value)} />
        </label>
      )}
      <div className="st-tabs" role="tablist" aria-label="Where the photo comes from">
        <button type="button" role="tab" aria-selected={tab === 'upload'} className={tab === 'upload' ? 'on' : ''} onClick={() => setTab('upload')}>
          <Icon name="upload" size={16} /> Upload a new photo
        </button>
        <button type="button" role="tab" aria-selected={tab === 'library'} className={tab === 'library' ? 'on' : ''} onClick={() => setTab('library')}>
          <Icon name="photo" size={16} /> Your photos
        </button>
      </div>
      {error && (
        <p className="st-alert" role="alert">
          {error}
        </p>
      )}
      {tab === 'upload' ? (
        <div
          className={`st-drop${drag ? ' on' : ''}`}
          onDragOver={(e) => {
            e.preventDefault();
            setDrag(true);
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDrag(false);
            void upload(e.dataTransfer.files[0]);
          }}
        >
          {busy && busy !== 'Saving…' ? (
            <Loading text={busy} />
          ) : (
            <>
              <Icon name="upload" size={28} />
              <p>
                <strong>Choose a photo</strong> from this {matchMedia('(hover: none)').matches ? 'phone' : 'computer'}, or drag one here.
              </p>
              <p className="st-help">JPEG, PNG or WebP. Large photos are made smaller automatically.</p>
              <Button kind="primary" icon="upload" onClick={() => fileRef.current?.click()}>
                Choose a photo
              </Button>
            </>
          )}
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/*" hidden onChange={(e) => void upload(e.target.files?.[0])} />
        </div>
      ) : !photos ? (
        <Loading />
      ) : photos.length === 0 ? (
        <p className="st-muted">No photos uploaded yet. Use "Upload a new photo".</p>
      ) : (
        <ul className="st-photo-grid st-photo-grid-pick">
          {photos.map((p) => (
            <li key={p.path}>
              <button type="button" className={src === p.src ? 'on' : ''} onClick={() => setSrc(p.src)} aria-pressed={src === p.src} title={p.name}>
                <img src={viewSrc(p.src)} alt="" loading="lazy" />
                {src === p.src && (
                  <span className="st-picked">
                    <Icon name="check" size={16} />
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </Sheet>
  );
}
