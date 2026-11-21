/**
 * Sends the form emails over SMTP (Hostinger email: smtp.hostinger.com, port 465, SSL). Settings come from the
 * server environment at request time; none of them is ever logged or sent to the browser.
 *
 *   SMTP_USER      the mailbox that sends, e.g. forms@<Alex's domain> (also the "From" address)
 *   SMTP_PASSWORD  that mailbox's password
 *   FORM_TO        where entries go (default: SMTP_USER); several addresses may be given, comma-separated
 *   SMTP_HOST      default smtp.hostinger.com
 *   SMTP_PORT      default 465 (SSL); 587 uses STARTTLS
 *   SMTP_SECURE    "false" only for a local test server without TLS
 */
import type { Email } from './forms';

export interface Mailer {
  send(email: Email): Promise<void>;
}

type Env = Record<string, string | undefined>;

export interface SmtpSettings {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  password: string;
  to: string;
  from: string;
}

/** The settings, or null when the mailbox is not set up yet. */
export function readSmtpSettings(env: Env = process.env): SmtpSettings | null {
  const v = (k: string) => (env[k] ?? '').trim();
  const user = v('SMTP_USER');
  const password = env.SMTP_PASSWORD ?? '';
  if (!user || !password) return null;
  const port = Number(v('SMTP_PORT') || 465);
  const secure = v('SMTP_SECURE') ? v('SMTP_SECURE').toLowerCase() !== 'false' : port === 465;
  return {
    host: v('SMTP_HOST') || 'smtp.hostinger.com',
    port: Number.isFinite(port) ? port : 465,
    secure,
    user,
    password,
    to: v('FORM_TO') || user,
    from: user,
  };
}

export function smtpMailer(s: SmtpSettings): Mailer {
  let transport: Promise<import('nodemailer').Transporter> | null = null;
  return {
    async send(email) {
      transport ??= import('nodemailer').then((m) =>
        m.createTransport({
          host: s.host,
          port: s.port,
          secure: s.secure,
          auth: { user: s.user, pass: s.password },
          connectionTimeout: 10_000,
          greetingTimeout: 10_000,
          socketTimeout: 20_000,
        }),
      );
      await (await transport).sendMail({
        to: email.to,
        from: email.from,
        replyTo: email.replyTo,
        subject: email.subject,
        text: email.text,
        disableFileAccess: true,
        disableUrlAccess: true,
      });
    },
  };
}

let override: Mailer | null = null;

/** Tests only: replace the mailer (null restores the real one). */
export function setMailerForTests(m: Mailer | null) {
  override = m;
}

export function getMailer(env: Env = process.env): { mailer: Mailer; settings: SmtpSettings } | null {
  const settings = readSmtpSettings(env);
  if (!settings) return null;
  return { mailer: override ?? smtpMailer(settings), settings };
}
