/**
 * Every page Provident Studio can show and edit, in the order of the page picker. `id` is the file in content/pages.
 * Journal posts are added to the picker from content/blog.
 */
export interface StudioPage {
  id: string;
  path: string;
  label: string;
  /** a short line under the label in the picker */
  hint: string;
  /** may be the target of a link the owner picks */
  linkable: boolean;
}

export const PAGES: readonly StudioPage[] = [
  { id: 'home', path: '/', label: 'Home', hint: 'Headline, slideshow, notable coins, sections', linkable: true },
  { id: 'process', path: '/process', label: 'Our process', hint: 'The nine steps', linkable: true },
  { id: 'grading-standards', path: '/grading-standards', label: 'Grading standards', hint: 'The scale and sections', linkable: true },
  { id: 'holder', path: '/holder', label: 'The holder and label', hint: 'The holder drawing and sections', linkable: true },
  { id: 'verify', path: '/verify', label: 'Verify a certificate', hint: 'Texts around the lookup', linkable: true },
  { id: 'why-provident', path: '/why-provident', label: 'Why Provident', hint: 'Reasons', linkable: true },
  { id: 'about', path: '/about', label: 'About the company', hint: 'Story and services', linkable: true },
  { id: 'submit', path: '/submit', label: 'Submissions', hint: 'Steps, fees note, request form', linkable: true },
  { id: 'faq', path: '/faq', label: 'Questions', hint: 'Questions and answers', linkable: true },
  { id: 'contact', path: '/contact', label: 'Contact', hint: 'Contact details and form', linkable: true },
  { id: 'blog', path: '/blog', label: 'Journal (list)', hint: 'The list of posts', linkable: true },
  { id: 'population', path: '/population', label: 'Population report', hint: 'Only shows when switched on', linkable: false },
  { id: 'privacy', path: '/privacy', label: 'Privacy', hint: 'Legal text', linkable: true },
  { id: 'terms', path: '/terms', label: 'Terms of use', hint: 'Legal text', linkable: true },
  { id: 'thank-you', path: '/thank-you', label: 'Thank-you page', hint: 'Shown after a form is sent', linkable: false },
];

/** The page shown at a public address ("/process/" and "/process" alike), or null. */
export function pageForPath(path: string): StudioPage | null {
  const p = path.replace(/\/+$/, '') || '/';
  return PAGES.find((x) => x.path === p) ?? null;
}
