/** The homepage slideshow: wide photos under the headline. Add, describe, reorder and remove slides. */
import { useCallback, useEffect, useState } from 'react';
import { api, viewSrc } from '../api';
import { useStudio } from '../state';
import { ImagePicker } from '../ImagePicker';
import { Button, Empty, Loading, PageHead, Sheet } from '../ui';
import { FieldForm } from '../FieldForm';
import { pageDoc, type ObjectField } from '../../lib/studio/schema';
import type { Data } from '../../lib/studio/ops';

type Slide = { image: string; alt: string; caption?: string };
const slideField = (pageDoc('home').fields.carousel as { item: ObjectField }).item;

export function Slideshow() {
  const { saved, fail, confirm, version } = useStudio();
  const [slides, setSlides] = useState<Slide[] | null>(null);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<number | null>(null);
  const [draft, setDraft] = useState<Data>({});
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    api.doc('page:home').then((r) => setSlides((r.data.carousel as Slide[] | undefined) ?? []), fail);
  }, [fail]);
  useEffect(load, [load, version]);

  async function op(o: 'up' | 'down' | 'remove', i: number) {
    if (o === 'remove' && !(await confirm({ title: 'Remove this photo from the slideshow?', body: 'The photo stays in your photo library. You can undo this until you publish.', confirm: 'Remove', danger: true }))) return;
    try {
      saved(o === 'remove' ? 'Removed a slideshow photo' : 'Moved a slideshow photo', await api.list('page:home', 'carousel', o, i), { quiet: o !== 'remove' });
    } catch (e) {
      fail(e);
    }
  }

  async function saveEdit() {
    if (editing === null || !slides) return;
    if (!String(draft.alt ?? '').trim()) return fail(new Error('Describe the photo in a few words.'));
    setBusy(true);
    try {
      const next = slides.map((s, i) => (i === editing ? { ...s, ...draft } : s));
      saved('Slideshow photo', await api.saveDoc('page:home', { carousel: next }));
      setEditing(null);
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="st-page">
      <PageHead
        back
        title="Homepage slideshow"
        lead="Wide photos (landscape) of your slabs, coins and grading room. They change on their own every few seconds."
        actions={
          <Button kind="primary" icon="plus" onClick={() => setAdding(true)}>
            Add a photo
          </Button>
        }
      />
      {!slides ? (
        <Loading />
      ) : slides.length === 0 ? (
        <Empty icon="slides" title="No slideshow photos yet" action={<Button kind="primary" icon="plus" onClick={() => setAdding(true)}>Add your first photo</Button>}>
          Until you add some, the home page shows placeholder slides marked "Photo coming soon".
        </Empty>
      ) : (
        <ol className="st-slides">
          {slides.map((s, i) => (
            <li key={`${s.image}-${i}`} className="st-slide">
              <span className="st-slide-img">
                <img src={viewSrc(s.image)} alt="" />
                <span className="st-slide-n">{i + 1}</span>
              </span>
              <span className="st-slide-text">
                <strong>{s.caption || <span className="st-muted">No caption</span>}</strong>
                <span className="st-muted">{s.alt}</span>
              </span>
              <span className="st-coin-tools">
                <Button small kind="ghost" icon="up" label={`Move photo ${i + 1} earlier`} disabled={i === 0} onClick={() => void op('up', i)} />
                <Button small kind="ghost" icon="down" label={`Move photo ${i + 1} later`} disabled={i === slides.length - 1} onClick={() => void op('down', i)} />
                <Button
                  small
                  icon="edit"
                  onClick={() => {
                    setDraft({ ...s });
                    setEditing(i);
                  }}
                >
                  Edit
                </Button>
                <Button small kind="ghost" icon="trash" label={`Remove photo ${i + 1}`} onClick={() => void op('remove', i)} />
              </span>
            </li>
          ))}
        </ol>
      )}
      <p className="st-help st-center">
        <a href="#/edit?page=%2F">See the slideshow on the home page</a>
      </p>
      {adding && (
        <ImagePicker
          title="Add a slideshow photo"
          folder="home"
          alt=""
          removable={false}
          onClose={() => setAdding(false)}
          onDone={async (r) => {
            try {
              saved('Added a slideshow photo', await api.list('page:home', 'carousel', 'add', -1, { image: r.src, alt: r.alt ?? '' }));
              setAdding(false);
            } catch (e) {
              fail(e);
            }
          }}
        />
      )}
      {editing !== null && (
        <Sheet
          title={`Slideshow photo ${editing + 1}`}
          onClose={() => setEditing(null)}
          footer={
            <>
              <span className="st-grow" />
              <Button kind="ghost" onClick={() => setEditing(null)}>
                Cancel
              </Button>
              <Button kind="primary" icon="check" onClick={() => void saveEdit()} busy={busy}>
                Save
              </Button>
            </>
          }
        >
          <FieldForm fields={slideField.fields} value={draft} onChange={setDraft} />
        </Sheet>
      )}
    </div>
  );
}
