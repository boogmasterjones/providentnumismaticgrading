import { config, collection, fields, singleton } from '@keystatic/core';

/**
 * Keystatic editor config (Alex edits at /admin, which redirects to /keystatic).
 *
 * Storage:
 * - Local mode (default, for development): edits are written straight to the files in this folder.
 * - GitHub mode (production): set PUBLIC_KEYSTATIC_GITHUB_REPO=owner/repo in Netlify (plus the Keystatic GitHub app
 *   variables listed in README.md). Every save then becomes a commit in that repository, and Netlify rebuilds.
 *   Edits are made on a branch whose name starts with "edits/" and go live when Alex presses "publish"
 *   (merges the branch), so a day of edits is one Netlify build instead of one per save.
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

/** Fields every page has: search-engine title and description, the page heading, an intro and a free body. */
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
  heading: fields.text({ label: 'Page heading', validation: { isRequired: true } }),
  intro: fields.text({ label: 'Intro paragraph', multiline: true }),
  body: fields.markdoc({
    label: 'Page text',
    options: {
      image: { directory: 'public/images/pages', publicPath: '/images/pages/' },
    },
  }),
};

function page(label: string, file: string, extra: Record<string, ReturnType<typeof fields.text>> = {}) {
  return singleton({
    label,
    path: `content/pages/${file}`,
    format: { contentField: 'body' },
    schema: { ...pageFields, ...extra },
  });
}

export default config({
  storage,
  ui: {
    brand: { name: 'Website editor' },
    navigation: {
      'Site': ['settings', 'fees', 'faq', 'gallery'],
      'Blog': ['blog'],
      'Pages': [
        'pageHome',
        'pageHowToSubmit',
        'pageSubmit',
        'pageFees',
        'pageStandards',
        'pageFaq',
        'pageAbout',
        'pageContact',
        'pageBlog',
        'pageVerify',
        'pagePopulation',
        'pagePrivacy',
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
          description: 'Optional. Shown on the Contact page and in the footer.',
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
    fees: singleton({
      label: 'Fees and turnaround',
      path: 'content/fees',
      format: { data: 'json' },
      schema: {
        tiers: fields.array(
          fields.object({
            name: fields.text({ label: 'Service tier name', validation: { isRequired: true } }),
            price: fields.text({ label: 'Price per coin', description: 'e.g. $25' }),
            turnaround: fields.text({ label: 'Turnaround', description: 'e.g. 15 business days' }),
            notes: fields.text({ label: 'Notes', multiline: true }),
          }),
          { label: 'Service tiers', itemLabel: (p) => p.fields.name.value || 'Tier' },
        ),
        extraNotes: fields.array(fields.text({ label: 'Note', multiline: true }), {
          label: 'Shipping, insurance and other notes',
          itemLabel: (p) => p.value.slice(0, 60) || 'Note',
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
        primaryButton: fields.text({ label: 'Main button text', defaultValue: 'Submit coins' }),
        secondaryButton: fields.text({ label: 'Second button text', defaultValue: 'Talk to us' }),
      },
    }),
    pageHowToSubmit: page('How to submit', 'how-to-submit'),
    pageSubmit: page('Submission form', 'submit'),
    pageFees: page('Fees & turnaround', 'fees'),
    pageStandards: page('Grading standards', 'grading-standards'),
    pageFaq: page('FAQ page', 'faq'),
    pageAbout: page('About', 'about'),
    pageContact: page('Contact', 'contact'),
    pageBlog: page('Blog (list page)', 'blog'),
    pageVerify: page('Verify a certificate', 'verify'),
    pagePopulation: page('Population report', 'population'),
    pagePrivacy: page('Privacy', 'privacy'),
    pageThankYou: page('Thank-you page', 'thank-you'),
  },
  collections: {
    blog: collection({
      label: 'Blog posts',
      path: 'content/blog/*',
      slugField: 'title',
      format: { contentField: 'body' },
      entryLayout: 'content',
      columns: ['title', 'date'],
      schema: {
        title: fields.slug({ name: { label: 'Title', validation: { isRequired: true } } }),
        date: fields.date({ label: 'Date', defaultValue: { kind: 'today' }, validation: { isRequired: true } }),
        description: fields.text({
          label: 'Short summary (for the blog list and Google)',
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
