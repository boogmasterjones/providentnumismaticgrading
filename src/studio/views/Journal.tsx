/** The journal: the list of posts, and writing or editing one post. */
import { useEffect, useState } from 'react';
import { api, viewSrc, type DocReply } from '../api';
import { useStudio } from '../state';
import { FieldForm } from '../FieldForm';
import { Button, Empty, Loading, PageHead, fmtDate } from '../ui';
import { postDoc } from '../../lib/studio/schema';
import { validateDoc, type Data, type FieldProblem } from '../../lib/studio/ops';

export function Journal() {
  const { overview } = useStudio();
  if (!overview) return <Loading />;
  const posts = overview.posts;
  return (
    <div className="st-page">
      <PageHead
        back
        title="Journal"
        lead="Articles on grading, authentication and collecting. Newest first."
        actions={
          <a className="st-btn st-btn-primary" href="#/journal/new">
            <span>Write a new post</span>
          </a>
        }
      />
      {posts.length === 0 ? (
        <Empty icon="journal" title="No posts yet" action={<a className="st-btn st-btn-primary" href="#/journal/new">Write your first post</a>}>
          The Journal page says "The first articles are in preparation" until there is one.
        </Empty>
      ) : (
        <ul className="st-posts">
          {posts.map((p) => (
            <li key={p.slug}>
              <a className="st-post" href={`#/journal/${p.slug}`}>
                <span className="st-post-img">{p.cover ? <img src={viewSrc(p.cover)} alt="" /> : null}</span>
                <span className="st-post-text">
                  <strong>{p.title}</strong>
                  <span className="st-muted">
                    {fmtDate(p.date)}
                    {p.draft && <span className="st-chip st-chip-hidden">Hidden</span>}
                  </span>
                </span>
                <span className="st-btn st-btn-ghost st-btn-small">Edit</span>
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const today = () => new Date().toISOString().slice(0, 10);

export function PostEditor({ slug }: { slug: string }) {
  const isNew = slug === 'new';
  const { saved, fail, confirm, toast } = useStudio();
  const [reply, setReply] = useState<DocReply | null>(null);
  const [data, setData] = useState<Data | null>(isNew ? { title: '', date: today(), description: '', cover: '', coverAlt: '', draft: false } : null);
  const [problems, setProblems] = useState<FieldProblem[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!isNew)
      api.doc(`post:${slug}`).then(
        (r) => {
          if (!r.exists) {
            toast('That post no longer exists.', 'error');
            location.hash = '#/journal';
            return;
          }
          setReply(r);
          setData(r.data);
        },
        fail,
      );
  }, [slug, isNew, fail, toast]);

  if (!data) return <Loading />;
  const { body, ...fields } = data as Data & { body?: string };
  const dirty = isNew ? Boolean(String(fields.title ?? '').trim() || body) : JSON.stringify(reply?.data) !== JSON.stringify(fields) || body !== undefined;

  async function save() {
    const p = validateDoc(postDoc, fields, typeof body === 'string' ? body : reply?.body ?? '');
    setProblems(p);
    if (p.length) {
      toast(p[0].message, 'error');
      return;
    }
    setBusy(true);
    try {
      if (isNew) {
        const r = await api.createPost(fields, typeof body === 'string' ? body : '');
        saved(`New post “${String(fields.title)}”`, r);
        location.hash = `#/journal/${r.slug}`;
      } else {
        saved(`Post “${String(fields.title)}”`, await api.saveDoc(`post:${slug}`, fields, typeof body === 'string' ? body : undefined));
        const r = await api.doc(`post:${slug}`);
        setReply(r);
        setData(r.data);
      }
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!(await confirm({ title: `Delete “${String(fields.title)}”?`, body: 'The post is removed from the website when you publish. You can undo this before you publish.', confirm: 'Delete post', danger: true }))) return;
    try {
      saved('Deleted a journal post', await api.remove(`post:${slug}`));
      location.hash = '#/journal';
    } catch (e) {
      fail(e);
    }
  }

  return (
    <div className="st-page st-page-narrow">
      <PageHead
        title={isNew ? 'New journal post' : 'Edit journal post'}
        lead={isNew ? 'Write it here. It is saved as a draft until you publish.' : undefined}
        actions={
          !isNew && (
            <>
              <a className="st-btn st-btn-secondary" href={`#/edit?page=${encodeURIComponent(`/blog/${slug}`)}`}>
                <span>See it on the page</span>
              </a>
            </>
          )
        }
      />
      <a className="st-back" href="#/journal">
        ← All posts
      </a>
      <FieldForm
        fields={postDoc.fields}
        value={data}
        onChange={setData}
        problems={problems}
        bodyHtml={reply?.bodyHtml ?? ''}
        groups={[
          { title: 'The post', keys: ['title', 'body'] },
          { title: 'In the Journal list and on Google', keys: ['description', 'date', 'cover', 'draft'] },
        ]}
      />
      <div className="st-savebar">
        {!isNew && (
          <Button kind="danger" icon="trash" onClick={() => void remove()}>
            Delete post
          </Button>
        )}
        <span className="st-grow" />
        <a className="st-btn st-btn-ghost" href="#/journal">
          {dirty ? 'Cancel' : 'Back'}
        </a>
        <Button kind="primary" icon="check" onClick={() => void save()} busy={busy} disabled={!dirty}>
          {isNew ? 'Save post' : 'Save changes'}
        </Button>
      </div>
    </div>
  );
}
