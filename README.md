# Provident grading website

Website for Alex Masella's coin grading company (Provident Numismatic Authentication, Venice FL; the final name is
Alex's call). Built by Biggify. At launch the repository moves to **Alex's own GitHub** and the site to **Alex's own
Netlify account**: he owns everything.

**Status: build steps 1–4 done (structure, editor, forms, certificate verification from Alex's own certificate database, optional population report).**
The look is design **"A, Coin River"** from the homepage prototype (branch `build/alex-prototype` in the Biggify repo):
dark, warm gold, Cormorant Garamond / Cinzel / Inter, with an endless sideways river of drawn coins behind the home
headline and a faint one behind every page title. The text is **draft copy** taken from Alex's current website; every
fact still to confirm is listed in [CONTENT_TO_CONFIRM.md](CONTENT_TO_CONFIRM.md) (no placeholder text on the pages).

### Design notes

- Tokens (colours, fonts, spacing) are in `src/styles/theme.css`; components in `src/styles/global.css`; the home
  page in `src/styles/home.css` and `src/pages/index.astro`.
- Coins are drawn by the coin engine (`src/scripts/coin-engine.js` + `src/styles/coin-engine.css`), ported from the
  prototype's fast version (commit 1bb0973): each face is drawn once to a canvas sprite and reused; rows move by one
  compositor animation; rivers pause offscreen. No photos, no downloaded images, no AI images.
- **Animations always play** (owner's rule): the engine's reduced-motion switch is fixed off. Add `?shot` to a URL to
  freeze the rivers for screenshots.
- Small site behaviour (header on scroll, phone menu, reveals, gold shimmer, page-title river): `src/scripts/site.ts`.

## Stack

- [Astro](https://astro.build) 7, TypeScript strict. Pages are static HTML (fast, cheap to host).
- [Keystatic](https://keystatic.com) editor at **/admin** (redirects to `/keystatic`). Content lives as files in
  `content/` and images in `public/images/`, so the Git repository is the whole website: no database.
- Netlify: hosting, **Netlify Forms** (submission + contact), and on-demand routes run as Netlify Functions through
  the Astro Netlify adapter: the editor (`/keystatic`, `/api/keystatic`), the certificate lookup (`/api/verify`) and
  the population report (`/population`, only when switched on).
- Certificates are **not** stored in this repository: they come live from Alex's own certificate database through its
  API. Netlify Blobs caches the answers (included in Netlify's free plan).

## Run it locally

Needs Node 22.22 or newer.

```sh
npm install
npm run dev        # http://localhost:4321  (editor: http://localhost:4321/admin)
npm test           # unit tests (certificate lookup, adapters, cache, rate limit, population)
npm run check      # TypeScript / Astro type check
npm run build      # production build into dist/
```

Locally the editor runs in **local mode**: saving writes straight to the files in `content/` and `public/images/`.
Without `CERT_API_URL` the Verify page runs in **demo mode** with three clearly labelled made-up records: try
`DEMO-0001`, `DEMO-0002` or `DEMO-0003` (anything else shows the "not found" state). Copy `.env.example` to `.env` to try settings.

## Where things are

| What | Where |
|---|---|
| Editor schema (what Alex can edit) | `keystatic.config.ts` |
| Site settings: name, phone, email, location, hours, social links, **population switch**, **launched switch** | `content/settings.json` |
| Fees table, FAQ, photo library | `content/fees.json`, `content/faq.json`, `content/gallery.json` |
| Each page's title, description, heading, intro and text | `content/pages/*.mdoc` |
| Blog posts | `content/blog/*.mdoc` (photos in `public/images/blog/`) |
| Theme tokens / site styles / home page styles | `src/styles/theme.css`, `global.css`, `home.css` |
| Coin engine (drawn coins, rivers, flips) | `src/scripts/coin-engine.js`, `src/styles/coin-engine.css` |
| Draft text still to confirm with Alex | `CONTENT_TO_CONFIRM.md` |
| Certificate shape + schema | `src/lib/certs/certificate.ts` |
| Adapter interface (website ↔ Alex's database) | `src/lib/certs/adapter.ts` |
| **Alex's database: the only provider-specific file** | `src/lib/certs/providers/registry-api.ts` |
| DEMO records (used when `CERT_API_URL` is unset) | `src/lib/certs/providers/mock.ts` |
| Lookup, cache, rate limit, population loader | `src/lib/certs/verify.ts`, `src/pages/api/verify.ts`, `src/lib/population.ts` |

### How certificate verification works

Alex already keeps his certificates in his own database, which has an API. That database is the source of truth: the
website only reads from it, so a certificate he enters there is verifiable on the site within minutes, with no
website edit or rebuild.

- A visitor types a number on `/verify`. The page calls `/api/verify?cert=…` and shows a certificate card (coin,
  year, country/denomination, grade, strike and surface scores, notes, obverse/reverse photos, date graded), or a
  "not found" message that tells them to contact Alex before buying or selling. Results have a shareable address:
  `/verify?cert=XXXX` loads the result directly.
- The card says what verification means: the number is on record in Alex's registry with these details; the visitor
  compares them and the photos with the coin and label in hand.
- `/api/verify` (Netlify Function) normalises the number (capitals, spaces, `#`, `No.` ignored; letters, digits and
  dashes only), applies a **per-visitor limit** (20 a minute, 300 a day per IP, per running copy of the function),
  checks the **cache** (Netlify Blobs store `cert-verify`: found 1 hour so corrections show quickly, not found
  5 minutes), then asks the adapter. The reply is validated against our certificate schema (https photo links only)
  and must be for the number asked. Errors reach the visitor only as a generic message; logs carry the error kind
  only. **The API key is read from server environment variables and is never sent to the browser or logged.**
- **Adapter**: `src/lib/certs/adapter.ts` is the small interface (`getCertificate(number)`, optional `listAll()`).
  `providers/registry-api.ts` is the one file that knows Alex's database; today it assumes a plain JSON API
  (`GET {CERT_API_URL}/certificates/{number}` with `Authorization: Bearer {CERT_API_KEY}`) and maps common field
  names. Once we know which system he uses, only that file changes. With `CERT_API_URL` unset, `providers/mock.ts`
  serves the DEMO records.
- **Population report** (`/population`): needs the database to list every certificate (`listAll()`). It is hidden
  (404, not in the menu or sitemap) until **Site settings → Show the population report** is ticked. With the DEMO
  records it shows demo numbers labelled DEMO; if the real database can't list certificates it says the report isn't
  available, so leave the switch off.

### What we need from Alex about his certificate database

1. **Which software or service** holds his certificates (name, or a link to it).
2. **Its API documentation** (or a link to it): how to fetch one certificate by number, and what the reply looks like.
3. **An API key with READ-ONLY access** (the website never needs to change his records). He creates it himself in
   his account and enters it in Netlify; we don't need his password.
4. **Can the API list all certificates?** If yes, the population report can be switched on.
5. **Does it hold the obverse/reverse photos**, and as web links (https) the site can show?

## How Alex edits the site (after launch)

1. Go to `https://<his domain>/admin` and sign in with his GitHub account.
2. Change text, prices, FAQ, photos, blog posts or certificates, and press **Save**. Saves go to an edits branch
   (named `edits/…`) and are **not live yet**.
3. When he's done, he publishes: in the editor's branch menu, **Create pull request**, then **Merge** it on GitHub.
   Netlify rebuilds once (about a minute) and the changes are live. One build per publish keeps Netlify's free
   build allowance safe.
4. Certificates are **not** edited here: Alex keeps entering them in his own certificate database as he does today.
   A new certificate is verifiable on the site within about 5 minutes; a correction shows within the hour.

## Launch setup (in Alex's name; he creates the accounts, we never hold his passwords)

1. **GitHub**: Alex creates a free GitHub account; we transfer this repository to him (or he creates an empty repo and
   we push to it).
2. **Netlify**: Alex creates a free Netlify account and imports the repository (build command `npm run build`,
   publish directory `dist`, production branch `main`). In Site configuration → Build & deploy → Branches and deploy
   contexts set **Branch deploys: None** and **Deploy previews: None** (so editor saves don't trigger builds).
3. **Keystatic GitHub app** (lets Alex sign in to /admin with GitHub):
   - Set `PUBLIC_KEYSTATIC_GITHUB_REPO=<owner>/<repo>` in Netlify environment variables and redeploy.
   - Visit `https://<domain>/keystatic` once: Keystatic offers to create a GitHub App. Create it under Alex's account
     (callback URL `https://<domain>/api/keystatic/github/oauth/callback`) and install it on the repository only.
   - Keystatic shows the values to add in Netlify: `KEYSTATIC_GITHUB_CLIENT_ID`, `KEYSTATIC_GITHUB_CLIENT_SECRET`,
     `KEYSTATIC_SECRET`, `PUBLIC_KEYSTATIC_GITHUB_APP_SLUG`. Add them, redeploy, sign in at /admin to test.
   - See https://keystatic.com/docs/github-mode for the current steps.
4. **Certificate database**: once `registry-api.ts` matches Alex's system, Alex creates a **read-only** API key
   in his database and adds two variables in Netlify (Site configuration → Environment variables, marked secret,
   Functions scope): `CERT_API_URL` (the API address) and `CERT_API_KEY`. Redeploy, then verify one real certificate
   number and one wrong number. If his API can list every certificate, tick **Show the population report** in Site
   settings and check the figures.
5. **Forms**: Netlify → Forms → enable form detection, redeploy, then Forms → Form notifications → email to Alex's
   address for both `submission` and `contact`. Send one test of each. (Free plan: 100 submissions a month.)
6. **Domain**: point Alex's domain at Netlify (Domain management), HTTPS on, and set **Website address** in Site
   settings to the final address (used by the sitemap and canonical links).
7. **Search Console**: add the domain under Alex's Google account and submit `/sitemap-index.xml` after launch.

## LAUNCH CHECKLIST

- [ ] `CERT_API_URL` + read-only `CERT_API_KEY` set in Netlify; one real certificate and one wrong number tested (the
      DEMO records disappear by themselves once `CERT_API_URL` is set).
- [ ] Population report switch: on only if Alex's database can list every certificate and the figures look right.
- [ ] Every item in `CONTENT_TO_CONFIRM.md` confirmed by Alex (name, headline, fees and turnaround, grading scale
      and standards, About text, FAQ answers, phone, email, hours, location, privacy text) and the text updated.
- [ ] Delete any demo blog posts.
- [ ] No credential or claim (years at NGC, memberships, guarantees, "best", "industry accepted") unless Alex confirms
      it and can back it up.
- [ ] Real photos only (Alex's own). No stock or AI images. The coins in the moving background are drawn by the site.
- [ ] Site settings → **Website address** = the real domain.
- [ ] Site settings → tick **Site is launched** (removes noindex, opens robots.txt, hides the preview banner).
- [ ] PageSpeed mobile checked on the live address.
- [ ] Netlify Forms detection on + notification emails set; test both forms.
- [ ] Keystatic GitHub app set up; Alex can sign in at /admin and publish.
- [ ] Domain + HTTPS; Search Console verified and sitemap submitted.
