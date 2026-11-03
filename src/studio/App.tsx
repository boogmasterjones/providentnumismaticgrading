/**
 * Provident Studio: the owner's website editor at /admin. Organised by the jobs he does, not by data types:
 * edit the website visually, notable coins, the homepage slideshow, the journal, photos, business info, publish.
 * Screens are chosen by the address's #hash, so the browser's Back button works (also on phones).
 */
import { useEffect, useState } from 'react';
import { StudioProvider, useStudio } from './state';
import { api } from './api';
import { Button, Icon, Loading } from './ui';
import { Dashboard } from './views/Dashboard';
import { Visual } from './views/Visual';
import { Coins } from './views/Coins';
import { Slideshow } from './views/Slideshow';
import { Journal, PostEditor } from './views/Journal';
import { Photos } from './views/Photos';
import { Business } from './views/Business';
import { Publish } from './views/Publish';

function useRoute() {
  const read = () => {
    const h = location.hash.replace(/^#/, '') || '/';
    const [path, query = ''] = h.split('?');
    return { path, query: new URLSearchParams(query) };
  };
  const [r, setR] = useState(read);
  useEffect(() => {
    const on = () => {
      setR(read());
      window.scrollTo({ top: 0 });
    };
    addEventListener('hashchange', on);
    return () => removeEventListener('hashchange', on);
  }, []);
  return r;
}

export default function App() {
  return (
    <StudioProvider>
      <Shell />
    </StudioProvider>
  );
}

function Shell() {
  const { overview, history, undoLast, confirm } = useStudio();
  const { path, query } = useRoute();
  const [menu, setMenu] = useState(false);
  const changes = overview?.changes.length ?? 0;
  const visual = path === '/edit';

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey && !t.closest('input, textarea, [contenteditable="true"]')) {
        e.preventDefault();
        void undoLast();
      }
    };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, [undoLast]);

  let view = null;
  if (!overview) view = <Loading text="Opening Studio…" />;
  else if (path === '/' || path === '') view = <Dashboard />;
  else if (visual) view = <Visual page={query.get('page') ?? '/'} />;
  else if (path === '/coins') view = <Coins />;
  else if (path === '/slideshow') view = <Slideshow />;
  else if (path === '/journal') view = <Journal />;
  else if (path.startsWith('/journal/')) view = <PostEditor slug={path.slice('/journal/'.length)} />;
  else if (path === '/photos') view = <Photos />;
  else if (path === '/business') view = <Business />;
  else if (path === '/publish') view = <Publish />;
  else view = <Dashboard />;

  const last = history[history.length - 1];

  return (
    <div className={`st-app${visual ? ' st-app-visual' : ''}`}>
      <a className="st-skip" href="#st-main" onClick={(e) => { e.preventDefault(); document.getElementById('st-main')?.focus(); }}>
        Skip to content
      </a>
      <header className="st-top">
        <a className="st-brand" href="#/" aria-label="Provident Studio, dashboard">
          <svg viewBox="0 0 64 64" width="30" height="30" aria-hidden="true" fill="none" stroke="currentColor">
            <circle cx="32" cy="32" r="23" strokeWidth="1.4" />
            <circle cx="32" cy="32" r="17.6" strokeWidth="1" />
            <text x="32" y="39.5" textAnchor="middle" fill="currentColor" stroke="none" fontFamily="Cormorant Garamond, Georgia, serif" fontSize="22" fontWeight="600">
              P
            </text>
          </svg>
          <span>
            <b>Provident</b> Studio
          </span>
        </a>
        {overview?.mode === 'local' && <span className="st-mode" title="Edits are saved to the files on this computer. Publishing is simulated.">Local preview mode</span>}
        <span className="st-grow" />
        {last && (
          <Button kind="ghost" icon="undo" onClick={() => void undoLast()} title={`Undo: ${last.label} (Ctrl+Z)`}>
            <span className="st-hide-sm">Undo</span>
          </Button>
        )}
        <a className={`st-btn st-btn-publish${changes ? '' : ' is-quiet'}`} href="#/publish">
          <Icon name="publish" size={18} />
          <span>
            Publish<span className="st-hide-sm">{changes ? ` ${changes} change${changes === 1 ? '' : 's'}` : ''}</span>
          </span>
          {changes > 0 && <span className="st-badge st-show-sm">{changes}</span>}
        </a>
        <div className="st-menu">
          <button type="button" className="st-btn st-btn-ghost st-btn-icon" aria-expanded={menu} aria-haspopup="menu" aria-label="Account menu" onClick={() => setMenu(!menu)}>
            <Icon name="settings" />
          </button>
          {menu && (
            <div className="st-menu-list" role="menu" onKeyDown={(e) => e.key === 'Escape' && setMenu(false)}>
              {overview && <p className="st-menu-who">Signed in as {overview.email}</p>}
              <a role="menuitem" href="/" target="_blank" rel="noopener" onClick={() => setMenu(false)}>
                <Icon name="external" size={16} /> View the live website
              </a>
              <button
                role="menuitem"
                type="button"
                onClick={async () => {
                  setMenu(false);
                  if (changes && !(await confirm({ title: 'Sign out?', body: `Your ${changes} unpublished change${changes === 1 ? ' is' : 's are'} kept as drafts. You can publish them next time.`, confirm: 'Sign out' }))) return;
                  await api.logout().catch(() => {});
                  location.href = '/admin/login';
                }}
              >
                <Icon name="out" size={16} /> Sign out
              </button>
            </div>
          )}
        </div>
      </header>
      <main id="st-main" className="st-main" tabIndex={-1}>
        {view}
      </main>
    </div>
  );
}
