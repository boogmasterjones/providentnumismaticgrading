# Hosting on Hostinger (Node.js Web App)

Checked against Hostinger's official docs on 2026-11-20. Hostinger changes its product often: re-read the linked
pages before relying on a detail. Step-by-step setup for the owner is in the README ("Launch setup").

## What Hostinger's docs say

| Question | Answer | Source |
|---|---|---|
| Which plans | Node.js web apps need **Business** web hosting (now sold as "Unlimited" on some pages) or Cloud. The limits table lists **5 Node.js websites** on that plan. | [Add a Node.js web app](https://www.hostinger.com/support/how-to-deploy-a-nodejs-website-in-hostinger/), [Plan limits](https://www.hostinger.com/support/6976044-parameters-and-limits-of-hosting-plans-in-hostinger/) |
| Node versions | **18, 20 (LTS), 22 (LTS, default), 24**. Picked from `engines` in package.json and the lockfile; can be changed. This site needs **22** (Astro 7 asks for 22.22 or newer) or **24**. | [Build settings](https://docs.hostinger.com/node.js/build-settings), [Overview](https://docs.hostinger.com/node.js/overview) |
| Astro | Supported. Server mode needs `@astrojs/node` in **standalone** mode. hPanel: Framework **Astro**, Build script **build**, Output directory **dist**, Entry file **server/entry.mjs** (relative to `dist`; leaving it empty deploys a static site with no Node server). | [Astro guide](https://docs.hostinger.com/node.js/overview-1/astro.md) |
| Build and start | Hostinger installs dependencies (npm, auto-detected from `package-lock.json`), runs the build script, then starts **Node on the entry file** (there is no separate start-command field). The app must listen on `process.env.PORT`. Install and build each have a **15-minute limit**; one deploy at a time, up to 20 queued. Crashed apps are restarted; **idle apps are stopped and started again on the next visit** (a slower first page after a quiet spell). | [Build settings](https://docs.hostinger.com/node.js/build-settings), [Overview](https://docs.hostinger.com/node.js/overview) |
| Environment variables | hPanel → the site → **Environment variables** (or during setup), one by one or **Import .env**. Names: capitals, digits, underscores. Given to **both the build and the running app**, stored encrypted, kept across deploys. **Saving redeploys the app.** Hostinger also scans the repository (e.g. `.env.example`) for names and flags missing ones. Multi-line values are not documented: paste the GitHub key base64-encoded (one line). | [Environment variables](https://docs.hostinger.com/node.js/environment-variables) |
| Files written at runtime | **Do not persist.** Everything in `hbuilds/` and `public_html` is **overwritten on every deployment**; File Manager/FTP/SSH edits are lost; only the live build is kept. So nothing the site needs to keep may be written to disk: we use MySQL. | [File structure](https://docs.hostinger.com/node.js/file-structure), [Add a Node.js web app](https://www.hostinger.com/support/how-to-deploy-a-nodejs-website-in-hostinger/) |
| MySQL | Included on Business (limits table: 150 databases, 3 GB each, 75 connections per user). hPanel → **Databases → MySQL Databases** → Create (a user is made with it). From a Node app use host **`127.0.0.1`**, not `localhost` (Node may try IPv6 `::1`, which the user may not be allowed on). Port 3306. Remote access is off by default and not needed. | [Databases](https://docs.hostinger.com/websites/databases.md), [Plan limits](https://www.hostinger.com/support/6976044-parameters-and-limits-of-hosting-plans-in-hostinger/) |
| Outgoing email (SMTP) | Hostinger email: **`smtp.hostinger.com`, port 465, SSL**, user = the full mailbox address, password = the mailbox password (an app password if 2FA is on). The plan's limits table lists email sending at **10 a minute and 100 a day**. | [Email client settings](https://docs.hostinger.com/emails/setup-devices.md), [Plan limits](https://www.hostinger.com/support/6976044-parameters-and-limits-of-hosting-plans-in-hostinger/) |
| Does a GitHub push redeploy | **Yes**: each push to the connected branch (default: the repository's default branch) installs, builds and restarts. Only that branch deploys; there are no per-branch previews. One hosting plan connects to **one GitHub account** at a time (through the Hostinger GitHub App). No per-commit rollback: revert in Git and push. A failed build leaves the live version in place. | [GitHub and GitLab](https://docs.hostinger.com/node.js/git-deployments), [Deployments](https://docs.hostinger.com/node.js/deployments) |
| Logs | hPanel → Runtime Logs (stdout/stderr of the running app, last 5,000 lines, latest deploy only); build logs for the last 10 builds. | [Runtime logs](https://docs.hostinger.com/node.js/runtime-logs), [Deployments](https://docs.hostinger.com/node.js/deployments) |

Not documented (we planned around it): whether Hostinger keeps `node_modules` between builds (the photo cache in
`node_modules/.cache/provident-photos` may be cold every build: slower, same result), whether `devDependencies` are
installed (so `sharp`, needed by the build, is a normal dependency), and the proxy's exact `X-Forwarded-For` behaviour.

## How this site runs there

- **Adapter**: `@astrojs/node` (standalone). Pages stay static (`output: 'static'`; built HTML in `dist/client`).
  Rendered on request: Studio (`/admin`, `/api/studio/…`), `/api/verify`, `/api/form`, `/population` and the
  `/fees` and `/how-to-submit` 301 redirects.
- **Entry file: `server/start.mjs`** (not Hostinger's suggested `server/entry.mjs`). It is a few lines
  (`server/start.mjs` in the repo, copied into `dist/server/` by the build) that start Astro's handler and add, on every
  response including static files: the year-long cache on `/_img/*` and `/_astro/*` (what `netlify.toml` did), the
  security headers (`nosniff`, `Referrer-Policy`, `X-Frame-Options: SAMEORIGIN`, `frame-ancestors 'self'`,
  `Permissions-Policy`, HSTS over HTTPS), and the visitor's real IP behind Hostinger's proxy for the rate limits.
  `npm start` runs the same file locally.
- **Storage** (`src/lib/kv.ts`): the certificate cache and Studio's sign-in locks live in **MySQL** (one table,
  `provident_kv`, made automatically on first use). Nothing precious is in it. If the database is unreachable the
  site keeps working from memory and logs `[kv] database unavailable`.
- **Forms** (`src/lib/forms.ts`, `/api/form`): emailed over SMTP from a mailbox on the site's domain. Honeypot
  (`bot-field`), 5 an hour and 15 a day per visitor, and at most 80 a day in all (under Hostinger's 100/day sending
  limit). Reply-To is the visitor's address, so the owner just presses Reply.
- **Studio** still commits to GitHub through its GitHub App: saves go to the `studio-drafts` branch (no rebuild:
  Hostinger deploys only the live branch), Publish merges into `main`, and **that push makes Hostinger rebuild once**
  (a few minutes). Studio's storage must be GitHub on Hostinger: local mode would write into the app folder, which the
  next deploy wipes.
- **Photos** are still sized at build time (`src/integrations/photos.ts`, sharp, into `dist/client/_img/`). No image
  service at runtime.

## Environment variables (names only)

| Name | Needed | What |
|---|---|---|
| `STUDIO_EMAIL`, `STUDIO_PASSWORD_HASH`, `STUDIO_SESSION_SECRET` | yes | Studio sign-in (`npm run studio:hash`) |
| `STUDIO_GITHUB_REPO`, `STUDIO_GITHUB_APP_ID`, `STUDIO_GITHUB_APP_PRIVATE_KEY` | yes | Studio's GitHub App (key base64, one line) |
| `STUDIO_GITHUB_INSTALLATION_ID`, `STUDIO_LIVE_BRANCH`, `STUDIO_DRAFTS_BRANCH` | optional | defaults: looked up, `main`, `studio-drafts` |
| `DB_NAME`, `DB_USER`, `DB_PASSWORD` | yes | the MySQL database from hPanel |
| `DB_HOST`, `DB_PORT` | optional | defaults `127.0.0.1`, `3306` |
| `SMTP_USER`, `SMTP_PASSWORD` | yes | the mailbox that sends the form emails |
| `FORM_TO` | recommended | where form entries go (default: `SMTP_USER`) |
| `SMTP_HOST`, `SMTP_PORT` | optional | defaults `smtp.hostinger.com`, `465` |
| `CODA_DOC_ID`, `CODA_TABLE_ID`, `CODA_API_TOKEN`, `CODA_COLUMN_MAP`, `CODA_API_BASE` | at launch | the certificate database (all empty = DEMO records) |
| `SITE_HOSTS` | optional | extra addresses the site answers on (e.g. the temporary Hostinger address), read at build |

`PORT` is set by Hostinger; do not add it.

## Hostinger limits that matter

1. **Runtime files vanish on every deploy** (and Studio's Publish is a deploy). Hence MySQL for the cache and locks,
   and GitHub for content and photos. Never set `STUDIO_STORAGE=local` there.
2. **Email: about 100 a day.** The form endpoint stops at 80 a day; a spam wave cannot use up the mailbox.
3. **Idle stop**: the first visit after a quiet spell starts the app (a second or two). In-memory rate limits reset
   then, which is fine.
4. **One GitHub account per hosting plan.** While the repository is on our GitHub, Alex's plan connects to ours; when
   the repository moves to Alex, reconnect his account (Disconnect, connect his, pick the repo, same settings).
5. **15-minute build limit**: the build takes seconds plus the photo encoding (about a second per photo when the
   cache is cold).
6. **No previews**: test risky changes on a second Web App on a free subdomain, or locally (`npm run preview`).
