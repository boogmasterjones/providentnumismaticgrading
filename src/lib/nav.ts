/** Main menu: quiet, editorial. Contact sits apart on the right; everything else is in the footer. */
export const NAV = [
  { href: '/process', label: 'Process' },
  { href: '/grading-standards', label: 'Standards' },
  { href: '/holder', label: 'Holder & label' },
  { href: '/verify', label: 'Verify' },
  { href: '/population', label: 'Population' },
  { href: '/submit', label: 'Submissions' },
  { href: '/about', label: 'About' },
] as const;

export const FOOTER_NAV = {
  grading: [
    { href: '/process', label: 'Our process' },
    { href: '/grading-standards', label: 'Grading standards' },
    { href: '/holder', label: 'The holder & label' },
    { href: '/verify', label: 'Verify a certificate' },
  ],
  company: [
    { href: '/about', label: 'About the company' },
    { href: '/why-provident', label: 'Why Provident' },
    { href: '/submit', label: 'Submissions' },
    { href: '/faq', label: 'Questions' },
    { href: '/blog', label: 'Journal' },
    { href: '/contact', label: 'Contact' },
  ],
} as const;
