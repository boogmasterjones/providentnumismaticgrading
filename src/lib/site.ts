/** Singleton data edited in Keystatic (Site section), read at build time. */
import settingsJson from '../../content/settings.json';
import feesJson from '../../content/fees.json';
import faqJson from '../../content/faq.json';
import galleryJson from '../../content/gallery.json';

export interface SiteSettings {
  siteName: string;
  tagline: string;
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

export interface FeeTier {
  /** Group heading on the Fees page, e.g. "US coins". */
  category: string;
  name: string;
  price: string;
  /** Highest coin value the tier covers, e.g. "$2,000". */
  maxValue: string;
  turnaround: string;
  notes: string;
}

export interface FeeExtra {
  name: string;
  price: string;
}

export interface Fees {
  tiers: FeeTier[];
  extras: FeeExtra[];
  shipping: FeeExtra[];
  extraNotes: string[];
}

export const settings: SiteSettings = {
  tagline: '',
  phone: '',
  email: '',
  location: '',
  hours: '',
  contactNote: '',
  socialLinks: [],
  showPopulation: false,
  launched: false,
  ...(settingsJson as Partial<SiteSettings>),
} as SiteSettings;

export const fees: Fees = {
  tiers: [],
  extras: [],
  shipping: [],
  extraNotes: [],
  ...(feesJson as object),
};

export const faq: { items: { question: string; answer: string }[] } = { items: [], ...(faqJson as object) };

export const gallery: { photos: { image: string; alt: string; caption?: string }[] } = {
  photos: [],
  ...(galleryJson as object),
};

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


/** Fee tiers grouped by category, in the order they appear. */
export function feeGroups(tiers: FeeTier[]): { category: string; tiers: FeeTier[] }[] {
  const out: { category: string; tiers: FeeTier[] }[] = [];
  for (const t of tiers) {
    const cat = (t.category || 'Grading').trim();
    let g = out.find((x) => x.category === cat);
    if (!g) out.push((g = { category: cat, tiers: [] }));
    g.tiers.push({ ...t, category: cat });
  }
  return out;
}

/** Lowest dollar price in a group ("$18" -> 18), or null when no tier has a number (e.g. "Call"). */
export function lowestPrice(tiers: FeeTier[]): number | null {
  const nums: number[] = [];
  for (const t of tiers) {
    const m = (t.price ?? '').match(/\$\s*(\d+(?:\.\d+)?)/);
    if (m) nums.push(Number(m[1]));
  }
  return nums.length ? Math.min(...nums) : null;
}
