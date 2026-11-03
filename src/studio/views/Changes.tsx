/** "Not published yet": every changed page, coin, post or photo, each with Undo, plus Undo everything. */
import { useState } from 'react';
import { api } from '../api';
import { useStudio } from '../state';
import { Button, Empty, Icon } from '../ui';

const STATUS = { added: 'New', modified: 'Changed', deleted: 'Deleted' } as const;

export function Changes({ heading = 'Not published yet' }: { heading?: string }) {
  const { overview, confirm, toast, fail, refresh, bump } = useStudio();
  const [busy, setBusy] = useState<string | null>(null);
  if (!overview) return null;
  const list = overview.changes;

  async function undo(path: string, label: string) {
    if (!(await confirm({ title: `Undo all changes to “${label}”?`, body: 'It goes back to how it is on the live website. This cannot be undone.', confirm: 'Undo changes', danger: true }))) return;
    setBusy(path);
    try {
      await api.undo(path);
      toast(`“${label}” is back to the live version.`, 'info');
      bump();
      await refresh();
    } catch (e) {
      fail(e);
    } finally {
      setBusy(null);
    }
  }

  async function undoAll() {
    if (!(await confirm({ title: 'Undo everything?', body: `All ${list.length} unpublished changes go back to how they are on the live website. This cannot be undone.`, confirm: 'Undo everything', danger: true }))) return;
    setBusy('*');
    try {
      await api.undoAll();
      toast('Everything is back to the live version.', 'info');
      bump();
      await refresh();
    } catch (e) {
      fail(e);
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="st-panel" aria-labelledby="changes-h">
      <div className="st-panel-head">
        <h2 id="changes-h">{heading}</h2>
        {list.length > 1 && (
          <Button kind="ghost" small icon="undo" onClick={() => void undoAll()} busy={busy === '*'}>
            Undo everything
          </Button>
        )}
      </div>
      {list.length === 0 ? (
        <Empty icon="check" title="Everything is published">
          Changes you make are saved as drafts and listed here until you publish them.
        </Empty>
      ) : (
        <>
          <p className="st-help">These are saved, but visitors don't see them until you press Publish.</p>
          <ul className="st-changes">
            {list.map((c) => (
              <li key={c.path}>
                <span className={`st-chip st-chip-${c.status}`}>{STATUS[c.status]}</span>
                <span className="st-change-label">{c.label}</span>
                <span className="st-change-tools">
                  {c.href && c.status !== 'deleted' && (
                    <a className="st-btn st-btn-ghost st-btn-small" href={`#/edit?page=${encodeURIComponent(c.href)}`}>
                      <Icon name="eye" size={16} />
                      <span>See it</span>
                    </a>
                  )}
                  <Button small kind="ghost" icon="undo" onClick={() => void undo(c.path, c.label)} busy={busy === c.path}>
                    Undo
                  </Button>
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
