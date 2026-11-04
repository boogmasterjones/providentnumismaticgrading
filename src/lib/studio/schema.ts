/**
 * Provident Studio's field registry: every editable content file, its fields, their plain-English labels, help text
 * and limits. One source of truth for the server's validation (validate.ts), the Studio forms (src/studio/) and the
 * visual editor's data attributes (src/lib/edit.ts). Runs in the browser and on the server: no Node imports here.
 *
 * Documents ("docs") are named:
 *   settings · faq · gallery · page:<id> · notable:<slug> · post:<slug>
 * and fields inside them by a dotted path, e.g. "grades.2.title" or "body".
 */
import { MARKS } from '../marks';
import { PAGES } from './pages';

export type Field =
  | LineField
  | TextField
  | RichField
  | ImageField
  | BoolField
  | SelectField
  | DateField
  | UrlField
  | NumberField
  | ListField
  | ObjectField;

interface Base {
  label: string;
  help?: string;
  required?: boolean;
}
/** One line of plain text (a heading, a label). */
export interface LineField extends Base { kind: 'line'; max?: number; placeholder?: string; email?: boolean }
/** Plain text that may run to several paragraphs (blank line = new paragraph); `links` allows [text](/path). */
export interface TextField extends Base { kind: 'text'; max?: number; links?: boolean }
/** Formatted text (Markdoc): headings, bold, italic, links, lists and photos. */
export interface RichField extends Base { kind: 'rich' }
export interface ImageField extends Base { kind: 'image'; folder: ImageFolder; altField?: string }
export interface BoolField extends Base { kind: 'bool'; confirmOn?: string }
export interface SelectField extends Base { kind: 'select'; options: readonly { value: string; label: string }[] }
export interface DateField extends Base { kind: 'date' }
export interface UrlField extends Base { kind: 'url' }
export interface NumberField extends Base { kind: 'number'; min?: number; max?: number }
export interface ListField extends Base {
  kind: 'list';
  item: Field;
  /** what one item is called: "step", "question" */
  noun: string;
  maxItems?: number;
  /** a new item's starting value; with no factory a new item is made in a form first (e.g. it needs a photo) */
  newItem?: () => unknown;
  /** short label for an item in lists */
  itemLabel?: (value: unknown, index: number) => string;
}
export interface ObjectField extends Base { kind: 'object'; fields: Record<string, Field> }

export const IMAGE_FOLDERS = ['home', 'notable', 'blog', 'gallery', 'pages'] as const;
export type ImageFolder = (typeof IMAGE_FOLDERS)[number];

// ------------------------------------------------------------------------------------------------ building blocks

const line = (label: string, o: Partial<LineField> = {}): LineField => ({ kind: 'line', label, ...o });
const text = (label: string, o: Partial<TextField> = {}): TextField => ({ kind: 'text', label, links: true, ...o });
const str = (v: unknown) => (typeof v === 'string' ? v : '');
const firstWords = (s: string, n = 60) => (s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s);

const markField: SelectField = {
  kind: 'select',
  label: 'Symbol',
  help: 'A small line drawing shown with this item.',
  options: MARKS,
};

/** A repeatable block: a step, a reason, a section. */
function sections(label: string, noun: string, help?: string): ListField {
  return {
    kind: 'list',
    label,
    help,
    noun,
    item: {
      kind: 'object',
      label: noun[0].toUpperCase() + noun.slice(1),
      fields: {
        title: line('Title', { required: true, max: 120 }),
        summary: text('One-line summary', { max: 300, links: false, help: 'Optional. A short line under the title.' }),
        text: text('Text', { max: 3000, help: 'Leave a blank line between paragraphs.' }),
        points: {
          kind: 'list',
          label: 'Points (optional list)',
          noun: 'point',
          item: text('Point', { max: 400 }),
          newItem: () => 'New point',
          itemLabel: (v) => firstWords(str(v)) || 'Point',
        },
        mark: markField,
      },
    },
    newItem: () => ({ mark: 'none', title: `New ${noun}`, summary: '', text: '', points: [] }),
    itemLabel: (v, i) => str((v as { title?: string })?.title) || `${noun} ${i + 1}`,
  };
}

const pageLinkOptions = PAGES.filter((p) => p.linkable).map((p) => ({ value: p.path, label: p.label }));

const coda: ObjectField = {
  kind: 'object',
  label: 'Closing band',
  help: 'The statement and links at the bottom of the page.',
  fields: {
    title: line('Closing statement', { required: true, max: 120 }),
    text: text('Line under it (optional)', { max: 300, links: false }),
    links: {
      kind: 'list',
      label: 'Links',
      noun: 'link',
      maxItems: 3,
      item: {
        kind: 'object',
        label: 'Link',
        fields: {
          label: line('Words shown', { required: true, max: 50 }),
          href: { kind: 'select', label: 'Goes to', options: pageLinkOptions, required: true },
        },
      },
      newItem: () => ({ label: 'Contact', href: '/contact' }),
      itemLabel: (v) => str((v as { label?: string })?.label) || 'Link',
    },
  },
};

/** Fields every page has. */
const pageCommon: Record<string, Field> = {
  eyebrow: line('Small label above the heading', { max: 60, help: 'Optional, e.g. "Our process".' }),
  heading: line('Page heading', { required: true, max: 160 }),
  intro: text('Intro paragraph', { max: 800 }),
  body: { kind: 'rich', label: 'Page text' },
  metaTitle: line('Title on Google', {
    required: true,
    max: 70,
    help: 'Shown in the browser tab and on Google. About 50–60 characters.',
  }),
  metaDescription: text('Description on Google', {
    required: true,
    max: 200,
    links: false,
    help: 'Shown under the title on Google. About 150 characters.',
  }),
};

const eyebrow = (label: string) => line(label, { max: 60, help: 'The small capital letters above a heading.' });

const pageExtra: Record<string, Record<string, Field>> = {
  home: {
    primaryButton: line('First link under the headline', { max: 40, help: 'Goes to Our process.' }),
    secondaryButton: line('Second link under the headline', { max: 40, help: 'Goes to Verify a certificate.' }),
    carousel: {
      kind: 'list',
      label: 'Homepage slideshow',
      help: 'Wide photos (landscape) work best. Slides change on their own every few seconds.',
      noun: 'slide',
      maxItems: 12,
      item: {
        kind: 'object',
        label: 'Slide',
        fields: {
          image: { kind: 'image', label: 'Photo', folder: 'home', required: true, altField: 'alt' },
          alt: line('Describe the photo', { required: true, max: 160, help: 'For blind visitors and Google.' }),
          caption: line('Short caption (optional)', { max: 120 }),
        },
      },
      itemLabel: (v) => str((v as { alt?: string })?.alt) || 'Photo',
    },
    notableEyebrow: eyebrow('Notable coins: small label'),
    notableTitle: line('Notable coins: heading', { max: 120 }),
    notableIntro: text('Notable coins: intro', { max: 400, links: false }),
    gradeEyebrow: eyebrow('What we grade: small label'),
    gradeTitle: line('What we grade: heading', { max: 120 }),
    grades: sections('What we grade', 'field'),
    film: {
      ...sections('Footage panels: captions', 'caption'),
      maxItems: 2,
      help: 'Two at most, one for each footage panel.',
      item: {
        kind: 'object',
        label: 'Caption',
        fields: {
          summary: line('Small line above', { max: 40 }),
          title: line('Line over the footage', { required: true, max: 90 }),
        },
      },
    },
    processEyebrow: eyebrow('Process: small label'),
    processTitle: line('Process: heading', { max: 120 }),
    processText: text('Process: intro', { max: 400, links: false }),
    processLink: line('Process: link', { max: 50 }),
    holderEyebrow: eyebrow('Holder: small label'),
    holderTitle: line('Holder: heading', { max: 120 }),
    holderText: text('Holder: text', { max: 500, help: 'Keep it to one or two sentences.' }),
    holderLink: line('Holder: link', { max: 50 }),
    verifyEyebrow: eyebrow('Verification: small label'),
    verifyTitle: line('Verification: heading', { max: 120 }),
    verifyText: text('Verification: text', { max: 400, links: false }),
  },
  process: { sections: sections('Steps', 'step'), coda },
  'grading-standards': {
    scaleEyebrow: eyebrow('Scale: small label'),
    scaleTitle: line('Scale: heading', { max: 120 }),
    scale: {
      kind: 'list',
      label: 'The scale (one row per grade band)',
      noun: 'grade band',
      item: {
        kind: 'object',
        label: 'Grade band',
        fields: {
          range: line('Numbers', { required: true, max: 12, help: 'e.g. 60–70' }),
          code: line('Abbreviation', { max: 12, help: 'e.g. MS' }),
          name: line('Name', { required: true, max: 60, help: 'e.g. Mint State' }),
          text: text('What it means', { max: 600, links: false }),
        },
      },
      newItem: () => ({ range: '1', code: '', name: 'New grade band', text: '' }),
      itemLabel: (v) => {
        const b = v as { range?: string; name?: string };
        return [str(b?.range), str(b?.name)].filter(Boolean).join(' ') || 'Band';
      },
    },
    sections: sections('Sections', 'section'),
    coda,
  },
  holder: {
    anatomyEyebrow: eyebrow('Drawing: small label'),
    anatomyText: text('Drawing: text', { max: 500, links: false }),
    sections: sections('Sections', 'section'),
    coda,
  },
  'why-provident': { sections: sections('Reasons', 'reason'), coda },
  about: {
    servicesEyebrow: eyebrow('Services: small label'),
    servicesTitle: line('Services: heading', { max: 120 }),
    sections: sections('What we offer', 'service'),
    coda,
  },
  submit: {
    sections: sections('Steps', 'step'),
    feesEyebrow: eyebrow('Fees: small label'),
    feesTitle: line('Fees: heading', { max: 120 }),
    feesText: text('Fees: text', { max: 1500, help: 'No price lists: fees are quoted per submission.' }),
    feesLink: line('Fees: link', { max: 50 }),
    requestEyebrow: eyebrow('Request form: small label'),
    requestTitle: line('Request form: heading', { max: 120 }),
    requestText: text('Request form: line under the heading', { max: 300, links: false }),
  },
  contact: {
    directTitle: line('Heading over the contact details', { max: 60 }),
    formTitle: line('Heading over the form', { max: 60 }),
  },
  verify: {
    verifyNote: text('Note under the lookup', { max: 500, links: false }),
  },
  blog: {
    emptyText: line('Shown while there are no posts', { max: 160 }),
  },
};

// ------------------------------------------------------------------------------------------------ documents

export interface DocType {
  /** "page", "settings", … */
  type: 'settings' | 'faq' | 'gallery' | 'page' | 'notable' | 'post';
  label: string;
  fields: Record<string, Field>;
  /** the file has a Markdoc body (the "body" field) after YAML front matter */
  hasBody: boolean;
}

const settingsDoc: DocType = {
  type: 'settings',
  label: 'Business info',
  hasBody: false,
  fields: {
    siteName: line('Business name', { required: true, max: 80, help: 'Shown in the header, the footer and on Google.' }),
    tagline: line('Short tagline', { max: 100 }),
    footerText: text('Line in the footer', { max: 200, links: false }),
    phone: line('Phone', { max: 30, help: 'Written as you want it shown, e.g. (941) 555-0100. Phones can tap it to call.' }),
    email: line('Email', { max: 120, email: true, help: 'Leave empty to hide it.' }),
    location: line('Location', { max: 80, help: 'e.g. "Venice, Florida". Leave out a street address.' }),
    hours: text('Hours', { max: 200, links: false }),
    contactNote: text('Note under the contact details', { max: 400, links: false, help: 'Optional. Shown on the Contact page.' }),
    socialLinks: {
      kind: 'list',
      label: 'Social links',
      noun: 'link',
      maxItems: 8,
      item: {
        kind: 'object',
        label: 'Social link',
        fields: {
          label: line('Name', { required: true, max: 40, help: 'e.g. Instagram' }),
          url: { kind: 'url', label: 'Link', required: true, help: 'The full address, starting with https://' },
        },
      },
      itemLabel: (v) => str((v as { label?: string })?.label) || 'Link',
    },
    showPopulation: {
      kind: 'bool',
      label: 'Show the population report',
      help: 'Leave off until we know the certificate database can list every certificate. While off, the Population page is hidden.',
    },
    siteUrl: { kind: 'url', label: 'Website address', required: true, help: 'The live address, e.g. https://www.example.com. Used for Google.' },
    launched: {
      kind: 'bool',
      label: 'The site is launched (let Google find it)',
      help: 'Leave off until launch. While off, search engines are asked not to list the site and a "Preview" banner shows.',
      confirmOn: 'Turn this on only when the site is ready for the public: Google will start listing it.',
    },
  },
};

const faqDoc: DocType = {
  type: 'faq',
  label: 'Questions',
  hasBody: false,
  fields: {
    items: {
      kind: 'list',
      label: 'Questions and answers',
      noun: 'question',
      item: {
        kind: 'object',
        label: 'Question',
        fields: {
          question: line('Question', { required: true, max: 200 }),
          answer: text('Answer', { required: true, max: 2000, links: false }),
        },
      },
      newItem: () => ({ question: 'New question?', answer: 'The answer.' }),
      itemLabel: (v) => str((v as { question?: string })?.question) || 'Question',
    },
  },
};

const galleryDoc: DocType = {
  type: 'gallery',
  label: 'Spare slideshow photos',
  hasBody: false,
  fields: {
    photos: {
      kind: 'list',
      label: 'Photos',
      help: 'Shown in the homepage slideshow only while the slideshow itself has no photos.',
      noun: 'photo',
      item: {
        kind: 'object',
        label: 'Photo',
        fields: {
          image: { kind: 'image', label: 'Photo', folder: 'gallery', required: true, altField: 'alt' },
          alt: line('Describe the photo', { required: true, max: 160, help: 'For blind visitors and Google.' }),
          caption: line('Caption (optional)', { max: 120 }),
        },
      },
      itemLabel: (v) => str((v as { alt?: string })?.alt) || 'Photo',
    },
  },
};

export const notableDoc: DocType = {
  type: 'notable',
  label: 'Notable coin',
  hasBody: false,
  fields: {
    name: line('Coin', { required: true, max: 120, help: 'As on the label: year, mint, denomination, variety.' }),
    grade: line('Grade', { required: true, max: 24, help: 'Exactly as on the label, e.g. MS 66.' }),
    cert: line('Certificate number', { required: true, max: 40, help: 'Links to the Verify page for this certificate.' }),
    note: line('One-line note (optional)', { max: 160, help: 'Only facts you can stand behind.' }),
    obverse: { kind: 'image', label: 'Photo: front', folder: 'notable', required: true, help: 'The coin on a plain dark background, cropped close.' },
    reverse: { kind: 'image', label: 'Photo: back (optional)', folder: 'notable' },
    order: { kind: 'number', label: 'Position', min: 0, max: 9999, help: 'Lower numbers show first.' },
  },
};

export const postDoc: DocType = {
  type: 'post',
  label: 'Journal post',
  hasBody: true,
  fields: {
    title: line('Title', { required: true, max: 120 }),
    date: { kind: 'date', label: 'Date', required: true },
    description: text('Short summary', { required: true, max: 200, links: false, help: 'Shown in the Journal list and on Google.' }),
    cover: { kind: 'image', label: 'Cover photo (optional)', folder: 'blog', altField: 'coverAlt' },
    coverAlt: line('Describe the cover photo', { max: 160 }),
    draft: { kind: 'bool', label: 'Hidden (keep it off the site for now)' },
    body: { kind: 'rich', label: 'Post' },
  },
};

export function pageDoc(id: string): DocType {
  const meta = PAGES.find((p) => p.id === id);
  return {
    type: 'page',
    label: meta ? meta.label : id,
    hasBody: true,
    fields: { ...pageCommon, ...(pageExtra[id] ?? {}) },
  };
}

export const DOC_ID = /^(settings|faq|gallery|page:[a-z0-9-]{1,60}|notable:[a-z0-9-]{1,80}|post:[a-z0-9-]{1,100})$/;

/** The registry entry for a document id, or null for an unknown one. */
export function docType(doc: string): DocType | null {
  if (!DOC_ID.test(doc)) return null;
  if (doc === 'settings') return settingsDoc;
  if (doc === 'faq') return faqDoc;
  if (doc === 'gallery') return galleryDoc;
  const [kind, id] = doc.split(':');
  if (kind === 'page') return PAGES.some((p) => p.id === id) ? pageDoc(id) : null;
  if (kind === 'notable') return notableDoc;
  if (kind === 'post') return postDoc;
  return null;
}

/** The repository file that holds a document. */
export function docFile(doc: string): string {
  if (doc === 'settings' || doc === 'faq' || doc === 'gallery') return `content/${doc}.json`;
  const [kind, id] = doc.split(':');
  if (kind === 'page') return `content/pages/${id}.mdoc`;
  if (kind === 'notable') return `content/notable/${id}.json`;
  return `content/blog/${id}.mdoc`;
}

/** The document a repository file holds, or null (an image or an unknown file). */
export function fileDoc(path: string): string | null {
  let m: RegExpMatchArray | null;
  if ((m = path.match(/^content\/(settings|faq|gallery)\.json$/))) return m[1];
  if ((m = path.match(/^content\/pages\/([a-z0-9-]+)\.mdoc$/))) return `page:${m[1]}`;
  if ((m = path.match(/^content\/notable\/([a-z0-9-]+)\.json$/))) return `notable:${m[1]}`;
  if ((m = path.match(/^content\/blog\/([a-z0-9-]+)\.mdoc$/))) return `post:${m[1]}`;
  return null;
}

/** "grades.2.title" -> ["grades", 2, "title"]. */
export function splitPath(path: string): (string | number)[] {
  if (!path) return [];
  return path.split('.').map((p) => (/^\d+$/.test(p) ? Number(p) : p));
}

/** The field definition at a path inside a document type (list indexes step into the item), or null. */
export function fieldAt(type: DocType, path: string): Field | null {
  const parts = splitPath(path);
  let fields: Record<string, Field> | null = type.fields;
  let f: Field | null = null;
  for (const p of parts) {
    if (typeof p === 'number') {
      if (!f || f.kind !== 'list') return null;
      f = f.item;
      fields = f.kind === 'object' ? f.fields : null;
      continue;
    }
    if (!fields || !(p in fields)) return null;
    f = fields[p];
    fields = f.kind === 'object' ? f.fields : null;
  }
  return f;
}
