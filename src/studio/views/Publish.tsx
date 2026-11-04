/** Publish: everything changed since the last publish goes live at once (one website rebuild). */
import { useState } from 'react';
import { api } from '../api';
import { useStudio } from '../state';
import { Button, Icon, PageHead } from '../ui';
import { Changes } from './Changes';
import type { PublishResult } from '../../lib/studio/store';

export function Publish() {
  const { overview, confirm, fail, refresh, toast, bump, forget } = useStudio();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<PublishResult | null>(null);
  if (!overview) return null;
  const n = overview.changes.length;
  const local = overview.mode === 'local';

  async function publish() {
    if (
      !(await confirm({
        title: `Publish ${n} change${n === 1 ? '' : 's'}?`,
        body: local
          ? 'Local preview mode: nothing goes live. You will see exactly what would be published.'
          : 'Your changes go on the live website. It takes a minute or two to update. You can keep editing meanwhile.',
        confirm: 'Publish now',
      }))
    )
      return;
    setBusy(true);
    try {
      const r = await api.publish();
      setResult(r);
      if (r.published) {
        toast('Published! The live website updates in a minute or two.');
        forget();
        bump();
        await refresh();
      } else if (r.simulated) toast('Publish simulated: nothing was published in local mode.', 'info');
      else toast('There was nothing to publish.', 'info');
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="st-page st-page-narrow">
      <PageHead back title="Publish" lead="Your edits are saved as drafts. Publishing puts all of them on the live website at once." />
      {result?.published && (
        <div className="st-success" role="status">
          <Icon name="check" size={28} />
          <div>
            <h2>Published</h2>
            <p>The live website is updating now and will show your changes in a minute or two.</p>
            <a className="st-btn st-btn-secondary" href="/" target="_blank" rel="noopener">
              <Icon name="external" size={16} />
              <span>View the live website</span>
            </a>
          </div>
        </div>
      )}
      {result?.simulated && (
        <div className="st-notice" role="status">
          <h2>Publish simulated (local mode)</h2>
          <p>
            Nothing was published. On the live website these {result.changes.length} files would have gone live in one update:
          </p>
          <ul className="st-filelist">
            {result.changes.map((c) => (
              <li key={c.path}>
                <code>{c.path}</code> <span className={`st-chip st-chip-${c.status}`}>{c.status}</span>
              </li>
            ))}
          </ul>
          {result.diff && (
            <details>
              <summary>Show the exact text changes</summary>
              <pre className="st-diff">
                {result.diff.split('\n').map((l, i) => (
                  <span key={i} className={l.startsWith('+') && !l.startsWith('+++') ? 'add' : l.startsWith('-') && !l.startsWith('---') ? 'del' : l.startsWith('@@') ? 'hunk' : ''}>
                    {l + '\n'}
                  </span>
                ))}
              </pre>
            </details>
          )}
        </div>
      )}
      <div className="st-publish-box">
        <div>
          <p className="st-publish-count">{n === 0 ? 'Nothing to publish' : `${n} change${n === 1 ? '' : 's'} ready`}</p>
          <p className="st-help">{n === 0 ? 'Everything you have saved is already live.' : 'All of them go live together, in one update of the website.'}</p>
        </div>
        <Button kind="publish" icon="publish" onClick={() => void publish()} busy={busy} disabled={n === 0}>
          {n === 0 ? 'Up to date' : `Publish ${n} change${n === 1 ? '' : 's'}`}
        </Button>
      </div>
      <Changes heading="What will be published" />
    </div>
  );
}
