/** The start screen: big cards for the jobs, and what has changed since the last publish. */
import { useStudio } from '../state';
import { Icon } from '../ui';
import { Changes } from './Changes';

export function Dashboard() {
  const { overview } = useStudio();
  if (!overview) return null;
  const h = new Date().getHours();
  const hello = h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
  const n = overview.changes.length;
  const cards = [
    { href: '#/edit', icon: 'edit', title: 'Edit my website', text: 'See your pages as visitors do and click any words or photo to change them.', stat: `${overview.pages.length} pages`, hero: true },
    { href: '#/coins', icon: 'coin', title: 'Notable coins', text: 'The showcase of standout coins on the home page.', stat: overview.notable.length ? `${overview.notable.length} coin${overview.notable.length === 1 ? '' : 's'}` : 'None yet' },
    { href: '#/slideshow', icon: 'slides', title: 'Homepage slideshow', text: 'The wide photos under the headline.', stat: overview.slides ? `${overview.slides} photo${overview.slides === 1 ? '' : 's'}` : 'No photos yet' },
    { href: '#/journal', icon: 'journal', title: 'Journal', text: 'Write and update articles.', stat: overview.posts.length ? `${overview.posts.length} post${overview.posts.length === 1 ? '' : 's'}` : 'No posts yet' },
    { href: '#/photos', icon: 'photo', title: 'Photo library', text: 'Every photo you have uploaded, and where it is used.', stat: 'Upload and reuse' },
    { href: '#/business', icon: 'info', title: 'Business info', text: 'Name, phone, email, hours, location, social links.', stat: 'Contact details' },
    { href: '#/publish', icon: 'publish', title: 'Publish', text: n ? 'Put your changes on the live website.' : 'Everything is live. Nothing to publish.', stat: n ? `${n} change${n === 1 ? '' : 's'} waiting` : 'Up to date', publish: n > 0 },
  ];
  return (
    <div className="st-page">
      <header className="st-pagehead">
        <p className="st-caps">Provident Studio</p>
        <h1>{hello}.</h1>
        <p className="st-lead">What would you like to do?</p>
      </header>
      <ul className="st-cards">
        {cards.map((c) => (
          <li key={c.href} className={`${c.hero ? 'st-card-hero' : ''}${c.publish ? ' st-card-attn' : ''}`}>
            <a className="st-card" href={c.href}>
              <span className="st-card-icon">
                <Icon name={c.icon} size={c.hero ? 30 : 24} />
              </span>
              <span className="st-card-text">
                <span className="st-card-title">{c.title}</span>
                <span className="st-card-desc">{c.text}</span>
              </span>
              <span className="st-card-stat">{c.stat}</span>
              <span className="st-card-go" aria-hidden="true">
                <Icon name="back" size={18} />
              </span>
            </a>
          </li>
        ))}
      </ul>
      <Changes />
    </div>
  );
}
