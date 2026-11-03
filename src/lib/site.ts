/**
 * Singleton data edited in Provident Studio (Business info, Questions, spare slideshow photos), read at build time.
 * Templates read them through src/lib/content.ts, which swaps in the drafts inside Studio's preview.
 */
import settingsJson from '../../content/settings.json';
import faqJson from '../../content/faq.json';
import galleryJson from '../../content/gallery.json';

export interface SiteSettings {
  siteName: string;
  tagline: string;
  /** the line under the name in the footer */
  footerText: string;
  siteUrl: string;
  phone: string;
  email: string;
  location: string;
  hours: string;
  contactNote: string;
  socialLinks: { label: string; url: string }[];
  /** Show the population report page (only once the certificate database can list every certificate). */
  showPopulation: boolean;
  launched: boolean;
}

/** Settings with every optional field filled in. */
export function withSettingsDefaults(raw: unknown): SiteSettings {
  return {
    tagline: '',
    footerText: '',
    phone: '',
    email: '',
    location: '',
    hours: '',
    contactNote: '',
    socialLinks: [],
    showPopulation: false,
    launched: false,
    ...(raw as Partial<SiteSettings>),
  } as SiteSettings;
}

export type Faq = { items: { question: string; answer: string }[] };
export type Gallery = { photos: { image: string; alt: string; caption?: string | null }[] };

export const withFaqDefaults = (raw: unknown): Faq => ({ items: [], ...(raw as object) });
export const withGalleryDefaults = (raw: unknown): Gallery => ({ photos: [], ...(raw as object) });

export const settings: SiteSettings = withSettingsDefaults(settingsJson);
export const faq: Faq = withFaqDefaults(faqJson);
export const gallery: Gallery = withGalleryDefaults(galleryJson);

/** "(941) 800-1585" -> "tel:+19418001585". Returns null when there are not enough digits to dial. */
export function telHref(phone: string | undefined | null): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) return `tel:+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `tel:+${digits}`;
  if (digits.length >= 7 && digits.length <= 15) return `tel:+${digits}`;
  return null;
}

/** Only real email addresses become mailto links (a placeholder note stays plain text). */
export function mailtoHref(email: string | undefined | null): string | null {
  if (!email) return null;
  const e = email.trim();
  return /^[^\s@\[\]]+@[^\s@\[\]]+\.[^\s@\[\]]+$/.test(e) ? `mailto:${e}` : null;
}

/** Split editor text into paragraphs on blank lines (single line breaks stay inside a paragraph). */
export function paragraphs(text: string | undefined | null): string[] {
  return (text ?? '')
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\s*\n\s*/g, ' ').trim())
    .filter(Boolean);
}
