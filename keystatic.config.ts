import { config, collection, fields, singleton } from '@keystatic/core';
import { MARKS } from './src/lib/marks';

/**
 * Keystatic editor config (the owner edits at /admin, which redirects to /keystatic).
 *
 * Storage:
 * - Local mode (default, for development): edits are written straight to the files in this folder.
 * - GitHub mode (production): set PUBLIC_KEYSTATIC_GITHUB_REPO=owner/repo in Netlify (plus the Keystatic GitHub app
 *   variables listed in README.md). Every save then becomes a commit in that repository, and Netlify rebuilds.
 *   Edits are made on a branch whose name starts with "edits/" and go live when the owner presses "publish"
 *   (merges the branch), so a day of edits is one Netlify build instead of one per save.
 *
 * There is deliberately no fee or price model: fees are quoted per submission (client, 2026-11-02).
 */
const githubRepo = import.meta.env.PUBLIC_KEYSTATIC_GITHUB_REPO as string | undefined;

const storage =
  githubRepo && githubRepo.includes('/')
    ? ({
        kind: 'github',
        repo: githubRepo as `${string}/${string}`,
        branchPrefix: 'edits/',
      } as const)
    : ({ kind: 'local' } as const);

/** Fields every page has: search-engine title and description, a small label, the heading, an intro and free text. */
const pageFields = {
  metaTitle: fields.text({
    label: 'Search title',
    description: 'Shown in the browser tab and on Google. About 50–60 characters.',
    validation: { isRequired: true, length: { max: 70 } },
  }),
  metaDescription: fields.text({
    label: 'Search description',
    description: 'Shown under the title on Google. About 150 characters.',
    multiline: true,
    validation: { isRequired: true, length: { max: 200 } },
  }),
  eyebrow: fields.text({ label: 'Small label above the heading', description: 'Optional, e.g. "Our process".' }),
  heading: fields.text({ label: 'Page heading', validation: { isRequired: true } }),
  intro: fields.text({ label: 'Intro paragraph', multiline: true }),
  body: fields.markdoc({
    label: 'Page text',
    options: {
      image: { directory: 'public/images/pages', publicPath: '/images/pages/' },
    },
  }),
};

const markField = fields.select({
  label: 'Symbol',
  description: 'A small line drawing shown with this item.',
  options: MARKS.map((m) => ({ label: m.label, value: m.value })),
  defaultValue: 'none',
});

/** A repeatable block: a step, a principle, a section. Text: leave a blank line between paragraphs. */
function sections(label: string, itemLabel: string) {
  return fields.array(
    fields.object({
      mark: markField,
      title: fields.text({ label: 'Title', validation: { isRequired: true } }),
      summary: fields.text({ label: 'One-line summary', multiline: true }),
      text: fields.text({ label: 'Text', description: 'Leave a blank line between paragraphs.', multiline: true }),
      points: fields.array(fields.text({ label: 'Point', multiline: true }), {
        label: 'Points (optional list)',
        itemLabel: (p) => p.value.slice(0, 60) || 'Point',
      }),
    }),
    { label, itemLabel: (p) => p.fields.title.value || itemLabel },
  );
}

/** A plain text field (multi-line) for the named blocks on the home and submissions pages. */
const t = (label: string, description?: string) => fields.text({ label, description, multiline: true });

export default config({
  storage,
  ui: {
    brand: { name: 'Website editor' },
    navigation: {
      'Site': ['settings', 'faq', 'gallery'],
      'Journal': ['blog'],
      'Pages': [
        'pageHome',
        'pageProcess',
        'pageStandards',
        'pageHolder',
        'pageVerify',
        'pageWhy',
        'pageAbout',
        'pageSubmit',
        'pageFaq',
        'pageContact',
        'pageBlog',
        'pagePopulation',
        'pagePrivacy',
        'pageTerms',
        'pageThankYou',
      ],
    },
  },
  singletons: {
    settings: singleton({
      label: 'Site settings',
      path: 'content/settings',
      format: { data: 'json' },
      schema: {
        siteName: fields.text({ label: 'Business name', validation: { isRequired: true } }),
        tagline: fields.text({ label: 'Short tagline' }),
        siteUrl: fields.url({
          label: 'Website address',
          description: 'The live address, e.g. https://www.example.com. Used for the sitemap and links.',
          validation: { isRequired: true },
        }),
        phone: fields.text({
          label: 'Phone',
          description: 'Written as you want it shown, e.g. (941) 555-0100. Visitors on phones can tap it to call.',
        }),
        email: fields.text({ label: 'Email' }),
        location: fields.text({ label: 'Location', description: 'e.g. "Venice, Florida". Leave out a home address.' }),
        hours: fields.text({ label: 'Hours', multiline: true }),
        contactNote: fields.text({
          label: 'Note under contact details',
          description: 'Optional. Shown on the Contact page.',
          multiline: true,
        }),
        socialLinks: fields.array(
          fields.object({
            label: fields.text({ label: 'Name (e.g. Instagram)', validation: { isRequired: true } }),
            url: fields.url({ label: 'Link', validation: { isRequired: true } }),
          }),
          { label: 'Social links', itemLabel: (p) => p.fields.label.value || 'Link' },
        ),
        showPopulation: fields.checkbox({
          label: 'Show the population report',
          description:
            'Leave OFF until we know the certificate database can list every certificate. While off, the Population page is hidden and not linked.',
          defaultValue: false,
        }),
        launched: fields.checkbox({
          label: 'Site is launched (let Google index it)',
          description:
            'Leave OFF until launch. While off, every page tells search engines not to index it, robots.txt blocks crawlers and a preview banner shows.',
          defaultValue: false,
        }),
      },
    }),
    faq: singleton({
      label: 'FAQ',
      path: 'content/faq',
      format: { data: 'json' },
      schema: {
        items: fields.array(
          fields.object({
            question: fields.text({ label: 'Question', validation: { isRequired: true } }),
            answer: fields.text({ label: 'Answer', multiline: true, validation: { isRequired: true } }),
          }),
          { label: 'Questions', itemLabel: (p) => p.fields.question.value || 'Question' },
        ),
      },
    }),
    gallery: singleton({
      label: 'Photo library',
      path: 'content/gallery',
      format: { data: 'json' },
      schema: {
        photos: fields.array(
          fields.object({
            image: fields.image({
              label: 'Photo',
              directory: 'public/images/gallery',
              publicPath: '/images/gallery/',
              validation: { isRequired: true },
            }),
            alt: fields.text({
              label: 'Describe the photo (for blind visitors and Google)',
              validation: { isRequired: true },
            }),
            caption: fields.text({ label: 'Caption (optional)' }),
          }),
          { label: 'Photos', itemLabel: (p) => p.fields.alt.value || 'Photo' },
        ),
      },
    }),
    pageHome: singleton({
      label: 'Home',
      path: 'content/pages/home',
      format: { contentField: 'body' },
      schema: {
        ...pageFields,
        primaryButton: fields.text({ label: 'First link under the headline', description: 'Goes to Our process.', defaultValue: 'Our process' }),
        secondaryButton: fields.text({ label: 'Second link under the headline', description: 'Goes to Verify a certificate.', defaultValue: 'Verify a certificate' }),
        gradeTitle: t('What we grade: heading'),
        gradeIntro: t('What we grade: intro'),
        grades: sections('What we grade: fields', 'Field'),
        approachTitle: t('Our approach: heading'),
        approachText: t('Our approach: text', 'Leave a blank line between paragraphs.'),
        principles: sections('Our approach: principles', 'Principle'),
        film: sections('Film: captions shown in turn as the footage scrubs (two at most; only the first two show)', 'Caption'),
        processTitle: t('Process at a glance: heading', 'The steps themselves come from the Our process page.'),
        processText: t('Process at a glance: intro'),
        holderTitle: t('Holder and label: heading'),
        holderText: t('Holder and label: text', 'Leave a blank line between paragraphs.'),
        verifyTitle: t('Verification: heading'),
        verifyText: t('Verification: text'),
        closingTitle: t('Closing statement'),
        closingText: t('Closing line under the statement'),
      },
    }),
    pageProcess: singleton({
      label: 'Our process',
      path: 'content/pages/process',
      format: { contentField: 'body' },
      schema: { ...pageFields, sections: sections('Steps', 'Step') },
    }),
    pageStandards: singleton({
      label: 'Grading standards',
      path: 'content/pages/grading-standards',
      format: { contentField: 'body' },
      schema: {
        ...pageFields,
        scale: fields.array(
          fields.object({
            range: fields.text({ label: 'Numbers', description: 'e.g. 60–70', validation: { isRequired: true } }),
            code: fields.text({ label: 'Abbreviation', description: 'e.g. MS' }),
            name: fields.text({ label: 'Name', description: 'e.g. Mint State', validation: { isRequired: true } }),
            text: fields.text({ label: 'What it means', multiline: true }),
          }),
          {
            label: 'The scale (one row per grade band)',
            itemLabel: (p) => [p.fields.range.value, p.fields.name.value].filter(Boolean).join(' ') || 'Band',
          },
        ),
        sections: sections('Sections', 'Section'),
      },
    }),
    pageHolder: singleton({
      label: 'The holder and label',
      path: 'content/pages/holder',
      format: { contentField: 'body' },
      schema: { ...pageFields, sections: sections('Sections', 'Section') },
    }),
    pageVerify: singleton({ label: 'Verify a certificate', path: 'content/pages/verify', format: { contentField: 'body' }, schema: pageFields }),
    pageWhy: singleton({
      label: 'Why Provident',
      path: 'content/pages/why-provident',
      format: { contentField: 'body' },
      schema: { ...pageFields, sections: sections('Reasons', 'Reason') },
    }),
    pageAbout: singleton({
      label: 'About',
      path: 'content/pages/about',
      format: { contentField: 'body' },
      schema: { ...pageFields, sections: sections('What we offer', 'Service') },
    }),
    pageSubmit: singleton({
      label: 'Submissions',
      path: 'content/pages/submit',
      format: { contentField: 'body' },
      schema: {
        ...pageFields,
        sections: sections('Steps', 'Step'),
        feesTitle: t('Fees note: heading'),
        feesText: t('Fees note: text', 'Leave a blank line between paragraphs. No price lists: fees are quoted per submission.'),
      },
    }),
    pageFaq: singleton({ label: 'FAQ page', path: 'content/pages/faq', format: { contentField: 'body' }, schema: pageFields }),
    pageContact: singleton({ label: 'Contact', path: 'content/pages/contact', format: { contentField: 'body' }, schema: pageFields }),
    pageBlog: singleton({ label: 'Journal (list page)', path: 'content/pages/blog', format: { contentField: 'body' }, schema: pageFields }),
    pagePopulation: singleton({ label: 'Population report', path: 'content/pages/population', format: { contentField: 'body' }, schema: pageFields }),
    pagePrivacy: singleton({ label: 'Privacy', path: 'content/pages/privacy', format: { contentField: 'body' }, schema: pageFields }),
    pageTerms: singleton({ label: 'Terms of use', path: 'content/pages/terms', format: { contentField: 'body' }, schema: pageFields }),
    pageThankYou: singleton({ label: 'Thank-you page', path: 'content/pages/thank-you', format: { contentField: 'body' }, schema: pageFields }),
  },
  collections: {
    blog: collection({
      label: 'Journal posts',
      path: 'content/blog/*',
      slugField: 'title',
      format: { contentField: 'body' },
      entryLayout: 'content',
      columns: ['title', 'date'],
      schema: {
        title: fields.slug({ name: { label: 'Title', validation: { isRequired: true } } }),
        date: fields.date({ label: 'Date', defaultValue: { kind: 'today' }, validation: { isRequired: true } }),
        description: fields.text({
          label: 'Short summary (for the list and Google)',
          multiline: true,
          validation: { isRequired: true, length: { max: 200 } },
        }),
        cover: fields.image({ label: 'Cover photo', directory: 'public/images/blog', publicPath: '/images/blog/' }),
        coverAlt: fields.text({ label: 'Describe the cover photo' }),
        draft: fields.checkbox({ label: 'Draft (hide from the site)', defaultValue: false }),
        body: fields.markdoc({
          label: 'Post',
          options: { image: { directory: 'public/images/blog', publicPath: '/images/blog/' } },
        }),
      },
    }),
  },
});
