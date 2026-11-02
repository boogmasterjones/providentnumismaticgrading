# Provident grading website

Website for a coin grading company (Provident Numismatic Authentication, Venice FL; the final name is the owner's
call). Built by Biggify. At launch the repository moves to **the owner's own GitHub** and the site to **the owner's own
Netlify account**: the owner owns everything.

**Anonymity rule (client request, 2026-11-02): the owner stays anonymous.** No name, title ("President",
"founder"), personal bio, photo of him, "he/his" phrasing about a specific person, schema.org Person data or personal
author name anywhere on the site, in meta tags or in structured data. The site speaks as the company ("we", "our
graders"). Journal posts carry no author name (the publisher is the company Organization).

**Not a lead-generation site (client, 2026-11-02).** Its job is to make the company look serious, rigorous and
state-of-the-art to a collector who holds one of its slabs or hears the name. Submission and contact stay available
but quiet: no sticky call button, no shouting "Submit" button, no price lists. **There is no fee model**: fees depend
on the coin and the service and are quoted per submission ("coins don't work that way"). The old `/fees` and
`/how-to-submit` addresses redirect to `/submit`.

**Status (2026-11-02): full site built**, draft text throughout. Every statement still to confirm is listed in
[CONTENT_TO_CONFIRM.md](CONTENT_TO_CONFIRM.md); while the site is not launched each page shows "Preview: draft text".

## Pages

| Page | Address | Editable in Keystatic as |
|---|---|---|
| Home | `/` | Pages → Home (headline, links, four fields, film captions, approach and principles, holder, verify and closing text) |
| Our process (9 steps) | `/process` | Pages → Our process (Steps) |
| Grading standards (1–70 scale, details grades, designations, ancients, label) | `/grading-standards` | Pages → Grading standards (the scale rows and Sections) |
| The holder and label | `/holder` | Pages → The holder and label |
| Verify a certificate | `/verify` | Pages → Verify a certificate (the lookup itself is code) |
| Why Provident | `/why-provident` | Pages → Why Provident |
| About the company | `/about` | Pages → About (text, and the "What we offer" services) |
| Submissions (steps, fees note, request form) | `/submit` | Pages → Submissions |
| Questions | `/faq` | Site → FAQ, and Pages → FAQ page |
| Contact | `/contact` | Site → Site settings (phone, hours, location) and Pages → Contact |
| Journal | `/blog`, `/blog/<post>` | Journal → Journal posts |
| Privacy, Terms of use, Thank you | `/privacy`, `/terms`, `/thank-you` | Pages → … |
| Population report (hidden until switched on) | `/population` | Site settings → Show the population report |
| 404 | any unknown address | code |

Every structured block (steps, sections, reasons, services) has a **Symbol** drop-down: one of the site's own line
drawings (`src/components/Mark.astro`, names in `src/lib/marks.ts`). Text fields take a blank line between paragraphs
and `[text](/path)` links.

## Design

Dark, warm ivory and a restrained gold; Cormorant Garamond (display), Cinzel (wordmark and numerals), Inter (text).
Approved references (owner, 2026-11-02): security printing, Art Deco, coin engraving, raking light, film titles,
watch movements, plus two effects from patek.com and rolex.com (below). No loupe, no hover flips, no pointer-driven
toys. **Animations always play** (owner's rule: no reduced-motion opt-out). Coins never flip, so they never show an edge.

| Effect | Where | How |
|---|---|---|
| Hero hold-and-release (after rolex.com's opening scroll: the hero media stays pinned full-screen while the headline scrolls up and away, then the page moves on) | Home hero | `.hero-pin` is 210% of the screen tall; the hero inside is sticky. As you scroll, the title lifts and fades, the coin river pushes in and darkens, an Art Deco frame closes in, and "Examined · Recorded · Sealed" rises in its place. Driven by `--p` from `src/scripts/scrollfx.ts`. |
| Scroll-scrubbed footage (after patek.com's scroll-driven video) | Home, between "What we grade" and "The process at a glance" | `.film` is pinned for four screens; scrolling scrubs 80 frames of real coin footage drawn to a canvas (`src/scripts/scrub.ts`), with three captions that change in turn and a fade through black where the clips change. Phones load every second frame. |
| Coin river (the one ambient signature) | Home hero | Slow, dimmed, desaturated; no interaction. `src/scripts/coin-engine.js`. |
| Guilloche rosettes, turning very slowly | Page titles, home hero, closing bands, certificate panels | `/guilloche.svg` is generated at build time (`src/lib/guilloche.ts`, about 20 KB) and rotated by CSS (4 minutes per turn). |
| Microtext borders | Footer edge, certificate panels | `.microtext` in `src/styles/deco.css`. |
| Holographic foil | Verify seal, label seal, certificate panels | Gradients that shift with scroll (`--scroll`). |
| Art Deco | Stepped corners, stepped rules under titles, sunbursts behind closing sections | `src/styles/deco.css`. |
| Raking light | Section titles | A light band sweeps once across each title when it scrolls into view. |
| Engraved line drawings | Steps, scope, principles, the grading scale rule | Inline SVG that draws itself once (stroke dash). |
| Exploded holder (after a watch-movement drawing) | Home and `/holder` | Back shell, insert, coin, label and front shell float apart in perspective and slide together as the section scrolls in (`src/components/HolderExplode.astro`). |

### Footage (stock, free licence, real footage only)

Both clips are from Pexels under the [Pexels licence](https://www.pexels.com/license/) (free for commercial use, no
attribution required; not to be resold as stock). They were reduced to stills in the browser and are served as
`public/media/scrub/coins/000.webp`–`079.webp` (80 frames, 1280×720, about 1.4 MB in total). The original videos are
not in the repository.

| Frames | Clip | Author | Downloaded file (size) |
|---|---|---|---|
| 000–043 | [Metal money silver macro](https://www.pexels.com/video/metal-money-silver-macro-5651766/) (0:00.15–0:07.35) | Tima Miroshnichenko | `5651766-hd_1280_720_25fps.mp4` (2.4 MB) |
| 044–079 | [Bronze coins on a turntable](https://www.pexels.com/video/bronze-coins-on-a-turntable-7348172/) (0:03–0:17) | Charlie Mounsey | `7348172-sd_960_506_30fps.mp4` (1.0 MB) |

A third clip was downloaded to look at and not used: [Close-up of ancient Turkish coins](https://www.pexels.com/video/close-up-of-ancient-turkish-coins-12848317/)
(`12848317-hd_1280_720_25fps.mp4`, 3.7 MB; it shows modern pocket change). When the owner sends real footage of his
own grading room, replace the frames (same names) and the film captions.

### Code map

- Tokens: `src/styles/theme.css`. Site styles: `global.css`; decorative system: `deco.css`; inner pages: `pages.css`;
  home: `home.css`; exploded holder: `explode.css`; coins: `coin-engine.css`.
- Scroll-linked values: `src/scripts/scrollfx.ts` (one rAF per scroll, layout measured only on load/resize).
- Header, phone menu, reveals: `src/scripts/site.ts`.
- Add `?shot` to a URL to freeze the coin river for screenshots.

## Stack

- [Astro](https://astro.build) 7, TypeScript strict. Pages are static HTML (fast, cheap to host).
- [Keystatic](https://keystatic.com) editor at **/admin** (redirects to `/keystatic`). Content lives as files in
  `content/` and images in `public/images/`, so the Git repository is the whole website: no database.
- Netlify: hosting, **Netlify Forms** (submission + contact), and on-demand routes run as Netlify Functions through
  the Astro Netlify adapter: the editor (`/keystatic`, `/api/keystatic`), the certificate lookup (`/api/verify`) and
  the population report (`/population`, only when switched on).
- Certificates are **not** stored in this repository: they come live from the owner's own certificate database through its
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
Without `CODA_DOC_ID` the Verify page runs in **demo mode** with three clearly labelled made-up records: try
`DEMO-0001`, `DEMO-0002` or `DEMO-0003` (anything else shows the "not found" state). Copy `.env.example` to `.env` to try settings.

## Where things are

| What | Where |
|---|---|
| Editor schema (what the owner can edit) | `keystatic.config.ts` |
| Site settings: name, phone, email, location, hours, social links, **population switch**, **launched switch** | `content/settings.json` |
| FAQ, photo library | `content/faq.json`, `content/gallery.json` |
| Each page's title, description, heading, intro and text | `content/pages/*.mdoc` |
| Blog posts | `content/blog/*.mdoc` (photos in `public/images/blog/`) |
| Styles | `src/styles/` (see Design above) |
| Coin engine (drawn coins, the hero river) | `src/scripts/coin-engine.js`, `src/styles/coin-engine.css` |
| Scroll effects, film scrubber | `src/scripts/scrollfx.ts`, `src/scripts/scrub.ts`, frames in `public/media/scrub/coins/` |
| Draft text still to confirm with the owner | `CONTENT_TO_CONFIRM.md` |
| Certificate shape + schema | `src/lib/certs/certificate.ts` |
| Adapter interface (website ↔ the owner's database) | `src/lib/certs/adapter.ts` |
| **The owner's database: the only provider-specific file** | `src/lib/certs/providers/coda.ts` |
| DEMO records (used when `CODA_DOC_ID` is unset) | `src/lib/certs/providers/mock.ts` |
| Lookup, cache, rate limit, population loader | `src/lib/certs/verify.ts`, `src/pages/api/verify.ts`, `src/lib/population.ts` |

### How certificate verification works

The owner already keeps the certificates in their own database, which has an API. That database is the source of truth: the
website only reads from it, so a certificate he enters there is verifiable on the site within minutes, with no
website edit or rebuild.

- A visitor types a number on `/verify`. The page calls `/api/verify?cert=…` and shows a certificate card (coin,
  year, country/denomination, grade, strike and surface scores, notes, obverse/reverse photos, date graded), or a
  "not found" message that tells them to contact the owner before buying or selling. Results have a shareable address:
  `/verify?cert=XXXX` loads the result directly.
- The card says what verification means: the number is on record in the owner's registry with these details; the visitor
  compares them and the photos with the coin and label in hand.
- `/api/verify` (Netlify Function) normalises the number (capitals, spaces, `#`, `No.` ignored; letters, digits and
  dashes only), applies a **per-visitor limit** (20 a minute, 300 a day per IP, per running copy of the function),
  checks the **cache** (Netlify Blobs store `cert-verify`: found 1 hour so corrections show quickly, not found
  5 minutes), then asks the adapter. The reply is validated against our certificate schema (https photo links only)
  and must be for the number asked. Errors reach the visitor only as a generic message; logs carry the error kind
  only. **The API key is read from server environment variables and is never sent to the browser or logged.**
- **Adapter**: `src/lib/certs/adapter.ts` is the small interface (`getCertificate(number)`, optional `listAll()`).
  `providers/coda.ts` is the one file that knows the owner's database; today it assumes a plain JSON API
  (`GET {CODA_DOC_ID}/certificates/{number}` with `Authorization: Bearer {CODA_API_TOKEN}`) and maps common field
  names. Once we know which system he uses, only that file changes. With `CODA_DOC_ID` unset, `providers/mock.ts`
  serves the DEMO records.
- **Population report** (`/population`): needs the database to list every certificate (`listAll()`). It is hidden
  (404, not in the menu or sitemap) until **Site settings → Show the population report** is ticked. With the DEMO
  records it shows demo numbers labelled DEMO; if the real database can't list certificates it says the report isn't
  available, so leave the switch off.

### What we need from the owner about the certificate database

1. **Which software or service** holds his certificates (name, or a link to it).
2. **Its API documentation** (or a link to it): how to fetch one certificate by number, and what the reply looks like.
3. **An API key with READ-ONLY access** (the website never needs to change his records). He creates it himself in
   his account and enters it in Netlify; we don't need his password.
4. **Can the API list all certificates?** If yes, the population report can be switched on.
5. **Does it hold the obverse/reverse photos**, and as web links (https) the site can show?

## How the owner edits the site (after launch)

1. Go to `https://<his domain>/admin` and sign in with his GitHub account.
2. Change text, FAQ, photos or journal posts, and press **Save**. Saves go to an edits branch
   (named `edits/…`) and are **not live yet**.
3. When he's done, he publishes: in the editor's branch menu, **Create pull request**, then **Merge** it on GitHub.
   Netlify rebuilds once (about a minute) and the changes are live. One build per publish keeps Netlify's free
   build allowance safe.
4. Certificates are **not** edited here: the owner keeps entering them in the existing certificate database as he does today.
   A new certificate is verifiable on the site within about 5 minutes; a correction shows within the hour.

## Launch setup (in the owner's name; he creates the accounts, we never hold his passwords)

1. **GitHub**: the owner creates a free GitHub account; we transfer this repository to him (or he creates an empty repo and
   we push to it).
2. **Netlify**: the owner creates a free Netlify account and imports the repository (build command `npm run build`,
   publish directory `dist`, production branch `main`). In Site configuration → Build & deploy → Branches and deploy
   contexts set **Branch deploys: None** and **Deploy previews: None** (so editor saves don't trigger builds).
3. **Keystatic GitHub app** (lets the owner sign in to /admin with GitHub):
   - Set `PUBLIC_KEYSTATIC_GITHUB_REPO=<owner>/<repo>` in Netlify environment variables and redeploy.
   - Visit `https://<domain>/keystatic` once: Keystatic offers to create a GitHub App. Create it under the owner's account
     (callback URL `https://<domain>/api/keystatic/github/oauth/callback`) and install it on the repository only.
   - Keystatic shows the values to add in Netlify: `KEYSTATIC_GITHUB_CLIENT_ID`, `KEYSTATIC_GITHUB_CLIENT_SECRET`,
     `KEYSTATIC_SECRET`, `PUBLIC_KEYSTATIC_GITHUB_APP_SLUG`. Add them, redeploy, sign in at /admin to test.
   - See https://keystatic.com/docs/github-mode for the current steps.
4. **Certificate database**: once `coda.ts` matches the owner's system, the owner creates a **read-only** API key
   in his database and adds two variables in Netlify (Site configuration → Environment variables, marked secret,
   Functions scope): `CODA_DOC_ID` (the API address) and `CODA_API_TOKEN`. Redeploy, then verify one real certificate
   number and one wrong number. If his API can list every certificate, tick **Show the population report** in Site
   settings and check the figures.
5. **Forms**: Netlify → Forms → enable form detection, redeploy, then Forms → Form notifications → email to the owner's
   address for both `submission` and `contact`. Send one test of each. (Free plan: 100 submissions a month.)
6. **Domain**: point the owner's domain at Netlify (Domain management), HTTPS on, and set **Website address** in Site
   settings to the final address (used by the sitemap and canonical links).
7. **Search Console**: add the domain under the owner's Google account and submit `/sitemap-index.xml` after launch.

## LAUNCH CHECKLIST

- [ ] `CODA_DOC_ID` + read-only `CODA_API_TOKEN` set in Netlify; one real certificate and one wrong number tested (the
      DEMO records disappear by themselves once `CODA_DOC_ID` is set).
- [ ] Population report switch: on only if the owner's database can list every certificate and the figures look right.
- [ ] Every item in `CONTENT_TO_CONFIRM.md` confirmed by the owner (name, headline, process claims, grading scale
      and standards, About text, FAQ answers, phone, email, hours, location, privacy text) and the text updated.
- [ ] Delete any demo journal posts.
- [ ] Replace the stock-footage frames with the owner's own footage if he has some (optional; the Pexels licence allows the current ones).
- [ ] No credential or claim (years at another grading service, memberships, guarantees, "best", "industry accepted") unless the owner confirms
      it and can back it up.
- [ ] Real photos only (the owner's slabs and coins; never a photo of him). No stock or AI images. The coins in the moving background are drawn by the site.
- [ ] Site settings → **Website address** = the real domain.
- [ ] Site settings → tick **Site is launched** (removes noindex, opens robots.txt, hides the preview banner).
- [ ] PageSpeed mobile checked on the live address.
- [ ] Netlify Forms detection on + notification emails set; test both forms.
- [ ] Keystatic GitHub app set up; the owner can sign in at /admin and publish.
- [ ] Domain + HTTPS; Search Console verified and sitemap submitted.
- [ ] Anonymity check: search the built `dist/` for the owner's name, "President" and "founder": zero hits.
