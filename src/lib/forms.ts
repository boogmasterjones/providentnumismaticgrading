/**
 * The site's own form handling (it replaced Netlify Forms when the site moved to Hostinger).
 *
 * The contact and submission-request forms post to /api/form. This file checks the entry (known form, known
 * fields, required fields, sane lengths), drops spam (the hidden "bot-field" honeypot, and a per-visitor and daily
 * limit) and turns the entry into a plain-text email. Sending is done by a Mailer (SMTP in production,
 * src/lib/mailer.ts), so tests never touch the network.
 *
 * Server-only. Visitors' entries are never logged.
 */

export interface FormField {
  name: string;
  label: string;
  required?: boolean;
  /** longest accepted value, in characters */
  max: number;
  kind?: 'email' | 'text';
}

const NAME: FormField = { name: 'name', label: 'Name', required: true, max: 200 };
const EMAIL: FormField = { name: 'email', label: 'Email', required: true, max: 254, kind: 'email' };
const PHONE: FormField = { name: 'phone', label: 'Phone', max: 50 };

/** Every form on the site and its fields, in the order they appear on the page. Keep in step with the pages. */
export const FORMS: Record<string, { title: string; fields: FormField[] }> = {
  contact: {
    title: 'Contact message',
    fields: [NAME, EMAIL, PHONE, { name: 'message', label: 'Message', required: true, max: 10_000 }],
  },
  submission: {
    title: 'Submission request',
    fields: [
      NAME,
      EMAIL,
      PHONE,
      { name: 'coin-count', label: 'Number of coins', required: true, max: 20 },
      { name: 'coin-type', label: 'Kind of coins', max: 200 },
      { name: 'service', label: 'Service', required: true, max: 200 },
      { name: 'coin-list', label: 'The coins', required: true, max: 20_000 },
      { name: 'declared-value', label: 'Approximate total value (US$)', max: 100 },
      { name: 'label-design', label: 'Label', max: 200 },
      { name: 'message', label: 'Anything else', max: 10_000 },
    ],
  },
};

export const HONEYPOT = 'bot-field';
/** Largest form post accepted, in bytes. */
export const MAX_BODY_BYTES = 64 * 1024;

const EMAIL_RE = /^[^\s@<>()",;:]+@[^\s@<>()",;:]+\.[^\s@<>()",;:]+$/;

export type FormCheck =
  | { ok: true; spam: true }
  | { ok: true; spam: false; form: string; values: { field: FormField; value: string }[]; replyTo: string; name: string }
  | { ok: false; reason: 'unknown-form' | 'missing' | 'too-long' | 'bad-email' };

/** Checks one posted entry. Line endings are made \n; surrounding spaces are trimmed. */
export function checkEntry(data: URLSearchParams | FormData): FormCheck {
  const get = (k: string) => {
    const v = data.get(k);
    return typeof v === 'string' ? v.replace(/\r\n?/g, '\n').trim() : '';
  };
  // Humans never see the honeypot; anything in it means a bot. Pretend it worked.
  if (get(HONEYPOT)) return { ok: true, spam: true };
  const form = get('form-name');
  const def = Object.hasOwn(FORMS, form) ? FORMS[form] : undefined;
  if (!def) return { ok: false, reason: 'unknown-form' };
  const values: { field: FormField; value: string }[] = [];
  for (const field of def.fields) {
    const value = get(field.name);
    if (field.required && !value) return { ok: false, reason: 'missing' };
    if (value.length > field.max) return { ok: false, reason: 'too-long' };
    if (field.kind === 'email' && value && !EMAIL_RE.test(value)) return { ok: false, reason: 'bad-email' };
    values.push({ field, value });
  }
  return { ok: true, spam: false, form, values, replyTo: get('email'), name: get('name') };
}

export interface Email {
  to: string;
  from: string;
  replyTo?: string;
  subject: string;
  text: string;
}

/** One line, no control characters (header injection), at most `max` characters. */
export const oneLine = (s: string, max = 120) => s.replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);

/** "Display name" <address> for the From header; quotes and backslashes are dropped from the name. */
export const fromHeader = (name: string, address: string) => `"${oneLine(name, 100).replace(/["\\]/g, '')}" <${oneLine(address, 254)}>`;

export function buildEmail(entry: Extract<FormCheck, { spam: false }>, opts: { to: string; from: string; siteName: string; at: Date }): Email {
  const def = FORMS[entry.form];
  const lines = [`${def.title} from the ${opts.siteName} website`, `Sent ${opts.at.toISOString().replace('T', ' ').slice(0, 16)} UTC`, ''];
  for (const { field, value } of entry.values) {
    if (!value) continue;
    lines.push(value.includes('\n') ? `${field.label}:\n${value}\n` : `${field.label}: ${value}`);
  }
  lines.push('', 'Reply to this email to answer them directly.');
  return {
    to: opts.to,
    from: opts.from,
    replyTo: entry.replyTo && EMAIL_RE.test(entry.replyTo) ? oneLine(entry.replyTo, 254) : undefined,
    subject: oneLine(`${def.title}: ${entry.name || 'website visitor'}`),
    text: lines.join('\n'),
  };
}

/**
 * Spam limits, in memory per running server: a few entries per visitor, and a daily total kept under Hostinger's
 * outgoing email limit (about 100 a day per mailbox) so a flood cannot use it all up.
 */
export class FormLimiter {
  private hits = new Map<string, number[]>();
  private day = -1;
  private dayCount = 0;
  constructor(
    private perVisitorPerHour = 5,
    private perVisitorPerDay = 15,
    private perDay = 80,
  ) {}

  /** true when allowed (and counted) */
  allow(ip: string, now: number): boolean {
    const day = Math.floor(now / 86_400_000);
    if (day !== this.day) {
      this.day = day;
      this.dayCount = 0;
      this.hits.clear();
    }
    if (this.dayCount >= this.perDay) return false;
    const list = (this.hits.get(ip || 'unknown') ?? []).filter((t) => now - t < 86_400_000);
    if (list.length >= this.perVisitorPerDay) return false;
    if (list.filter((t) => now - t < 3_600_000).length >= this.perVisitorPerHour) return false;
    list.push(now);
    this.hits.set(ip || 'unknown', list);
    this.dayCount++;
    return true;
  }
}

// ------------------------------------------------------------------------------------------------ POST /api/form

export interface FormDeps {
  /** null when SMTP is not set up */
  mailer: { send(email: Email): Promise<void> } | null;
  to: string;
  from: string;
  siteName: string;
  phone: string;
  contactEmail: string;
  limiter: FormLimiter;
  now: () => number;
  /** under `astro dev`, with no SMTP set, entries are accepted and only noted in the console */
  dev: boolean;
  log?: (m: string) => void;
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

const PROBLEMS: Record<string, string> = {
  missing: 'A required field was empty.',
  'too-long': 'One of the fields was too long.',
  'bad-email': 'The email address does not look right.',
  'unknown-form': 'The form could not be read.',
  busy: 'Too many messages were sent from your connection. Please wait an hour and try again.',
  send: 'Our email system did not accept the message just now.',
  big: 'The message was too long.',
};

/** A plain page saying what went wrong and how else to reach the business. Nothing typed is echoed back. */
function problemPage(reason: string, deps: FormDeps, status: number): Response {
  const contact = [
    deps.phone && `call or text <a href="tel:${esc(deps.phone.replace(/[^\d+]/g, ''))}">${esc(deps.phone)}</a>`,
    deps.contactEmail && `email <a href="mailto:${esc(deps.contactEmail)}">${esc(deps.contactEmail)}</a>`,
  ].filter(Boolean);
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex"><title>Message not sent | ${esc(deps.siteName)}</title>
<style>body{font:17px/1.6 system-ui,sans-serif;max-width:36rem;margin:12vh auto;padding:0 20px;color:#1d1a16;background:#f7f3ea}a{color:#7a5a1e}h1{font-weight:600;font-size:1.6rem}</style></head>
<body><h1>Your message was not sent.</h1><p>${esc(PROBLEMS[reason] ?? PROBLEMS.send)} Nothing was lost on your screen: go back, check the form and try again.</p>
${contact.length ? `<p>Or ${contact.join(', or ')}.</p>` : ''}
<p><a href="javascript:history.back()">Go back to the form</a> &middot; <a href="/">Home page</a></p></body></html>`;
  return new Response(html, { status, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' } });
}

const seeOther = (location: string) => new Response(null, { status: 303, headers: { Location: location, 'Cache-Control': 'no-store' } });

export async function handleForm(request: Request, ip: string, deps: FormDeps): Promise<Response> {
  if (request.method !== 'POST') return new Response('Use POST.', { status: 405, headers: { Allow: 'POST' } });
  const ct = request.headers.get('content-type') ?? '';
  if (!ct.includes('application/x-www-form-urlencoded') && !ct.includes('multipart/form-data')) return problemPage('unknown-form', deps, 415);
  const declared = Number(request.headers.get('content-length') ?? 0);
  if (declared > MAX_BODY_BYTES) return problemPage('big', deps, 413);
  let data: URLSearchParams | FormData;
  try {
    if (ct.includes('multipart/form-data')) data = await request.formData();
    else {
      const text = await request.text();
      if (text.length > MAX_BODY_BYTES) return problemPage('big', deps, 413);
      data = new URLSearchParams(text);
    }
  } catch {
    return problemPage('unknown-form', deps, 400);
  }

  const entry = checkEntry(data);
  if (!entry.ok) return problemPage(entry.reason, deps, 400);
  if (entry.spam) return seeOther('/thank-you');
  if (!deps.limiter.allow(ip, deps.now())) return problemPage('busy', deps, 429);

  if (!deps.mailer) {
    if (deps.dev) {
      deps.log?.(`[form] ${entry.form}: SMTP is not set up, so nothing was emailed (local development)`);
      return seeOther('/thank-you');
    }
    deps.log?.(`[form] ${entry.form}: not sent, SMTP is not set up (SMTP_USER, SMTP_PASSWORD)`);
    return problemPage('send', deps, 503);
  }
  const email = buildEmail(entry, { to: deps.to, from: deps.from, siteName: deps.siteName, at: new Date(deps.now()) });
  try {
    await deps.mailer.send(email);
  } catch (e) {
    const code = e && typeof e === 'object' && 'code' in e ? String((e as { code: unknown }).code) : 'unknown';
    deps.log?.(`[form] ${entry.form}: email failed (${code})`);
    return problemPage('send', deps, 502);
  }
  return seeOther('/thank-you');
}
