import type { APIRoute } from 'astro';
import { FormLimiter, fromHeader, handleForm } from '../../lib/forms';
import { getMailer } from '../../lib/mailer';
import { settings } from '../../lib/site';
import { clientIp } from '../../lib/client-ip';

// The contact and submission forms post here (src/components/SiteForm.astro). Runs on demand in the Node server.
export const prerender = false;

// One limiter per running server process (see FormLimiter).
const limiter = new FormLimiter();

export const POST: APIRoute = async (ctx) => {
  const m = getMailer();
  return handleForm(ctx.request, clientIp(ctx), {
    mailer: m?.mailer ?? null,
    to: m?.settings.to ?? '',
    from: m ? fromHeader(settings.siteName, m.settings.from) : '',
    siteName: settings.siteName,
    phone: settings.phone,
    contactEmail: settings.email,
    limiter,
    now: Date.now,
    dev: import.meta.env.DEV,
    log: (msg) => console.warn(msg),
  });
};
