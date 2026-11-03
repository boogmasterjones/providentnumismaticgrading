/** Notable coins: the showcase on the home page. Add, edit, reorder and remove coins. */
import { useEffect, useState } from 'react';
import { api, viewSrc } from '../api';
import { useStudio } from '../state';
import { FieldForm } from '../FieldForm';
import { Button, Empty, Loading, PageHead, Sheet } from '../ui';
import { notableDoc } from '../../lib/studio/schema';
import { validateDoc, type Data, type FieldProblem } from '../../lib/studio/ops';

export function Coins() {
  const { overview, saved, fail, confirm } = useStudio();
  const [edit, setEdit] = useState<{ slug?: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  if (!overview) return <Loading />;
  const coins = overview.notable;

  async function move(slug: string, dir: 'up' | 'down') {
    setBusy(slug + dir);
    try {
      saved('Moved a notable coin', (await api.moveCoin(slug, dir)).results, { quiet: true });
    } catch (e) {
      fail(e);
    } finally {
      setBusy(null);
    }
  }

  async function remove(slug: string, name: string) {
    if (!(await confirm({ title: `Remove “${name}”?`, body: 'The coin disappears from the home page when you publish. You can undo this before you publish.', confirm: 'Remove coin', danger: true }))) return;
    try {
      saved(`Removed ${name}`, await api.remove(`notable:${slug}`));
    } catch (e) {
      fail(e);
    }
  }

  return (
    <div className="st-page">
      <PageHead
        back
        title="Notable coins"
        lead="Standout coins from your registry, shown on the home page (the first six). Only show coins and grades you can stand behind."
        actions={
          <Button kind="primary" icon="plus" onClick={() => setEdit({})}>
            Add a notable coin
          </Button>
        }
      />
      {coins.length === 0 ? (
        <Empty
          icon="coin"
          title="No notable coins yet"
          action={
            <Button kind="primary" icon="plus" onClick={() => setEdit({})}>
              Add your first coin
            </Button>
          }
        >
          Until you add one, the home page shows three placeholder cards marked "Coming soon".
        </Empty>
      ) : (
        <ol className="st-coins">
          {coins.map((c, i) => (
            <li key={c.slug} className="st-coin">
              <span className="st-coin-pos" aria-label={`Position ${i + 1}`}>
                {i + 1}
              </span>
              <span className="st-coin-disc">{c.obverse ? <img src={viewSrc(String(c.obverse))} alt="" /> : null}</span>
              <span className="st-coin-text">
                <strong>{String(c.name ?? '')}</strong>
                <span>
                  {String(c.grade ?? '')} · Certificate No. {String(c.cert ?? '')}
                </span>
                {i >= 6 && <em className="st-muted">Not shown: only the first six appear on the home page.</em>}
              </span>
              <span className="st-coin-tools">
                <Button small kind="ghost" icon="up" label={`Move ${String(c.name)} up`} disabled={i === 0} busy={busy === c.slug + 'up'} onClick={() => void move(c.slug, 'up')} />
                <Button small kind="ghost" icon="down" label={`Move ${String(c.name)} down`} disabled={i === coins.length - 1} busy={busy === c.slug + 'down'} onClick={() => void move(c.slug, 'down')} />
                <Button small icon="edit" onClick={() => setEdit({ slug: c.slug })}>
                  Edit
                </Button>
                <Button small kind="ghost" icon="trash" label={`Remove ${String(c.name)}`} onClick={() => void remove(c.slug, String(c.name))} />
              </span>
            </li>
          ))}
        </ol>
      )}
      <p className="st-help st-center">
        <a href="#/edit?page=%2F">See the coins on the home page</a>
      </p>
      {edit && <CoinSheet slug={edit.slug} onClose={() => setEdit(null)} />}
    </div>
  );
}

/** Add or edit one coin. */
export function CoinSheet({ slug, onClose, onSaved }: { slug?: string; onClose: () => void; onSaved?: () => void }) {
  const { saved, fail } = useStudio();
  const [data, setData] = useState<Data | null>(slug ? null : { name: '', grade: '', cert: '', note: '', obverse: '', reverse: '' });
  const [problems, setProblems] = useState<FieldProblem[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (slug) api.doc(`notable:${slug}`).then((r) => setData(r.data), (e) => (fail(e), onClose()));
  }, [slug, fail, onClose]);

  async function save() {
    if (!data) return;
    const p = validateDoc(notableDoc, data);
    setProblems(p);
    if (p.length) return;
    setBusy(true);
    try {
      if (slug) saved(String(data.name), await api.saveDoc(`notable:${slug}`, data));
      else saved(`Added ${String(data.name)}`, await api.createCoin(data));
      onSaved?.();
      onClose();
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet
      title={slug ? 'Edit notable coin' : 'Add a notable coin'}
      subtitle="As it appears on the label. The certificate number links to its Verify page."
      onClose={onClose}
      footer={
        <>
          <span className="st-grow" />
          <Button kind="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button kind="primary" icon="check" onClick={() => void save()} busy={busy} disabled={!data}>
            {slug ? 'Save' : 'Add coin'}
          </Button>
        </>
      }
    >
      {!data ? <Loading /> : <FieldForm fields={notableDoc.fields} value={data} onChange={setData} problems={problems} omit={['order']} />}
    </Sheet>
  );
}
