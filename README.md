# Provident grading website

Website for a coin grading company (Provident Numismatic Authentication, Venice FL; the final name is the owner's
call). Built by Biggify. Hosted as a **Node.js Web App on the owner's own Hostinger Business plan** (moved from
Netlify on 2026-11-20; details and sources: [docs/HOSTINGER_DEPLOY.md](docs/HOSTINGER_DEPLOY.md)). The repository
moves to **the owner's own GitHub** later: the owner owns everything.

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

Every page is edited in **Provident Studio** (`/admin`, see below): **Edit my website** shows the real page and every
word and photo that comes from content can be clicked and changed there. The content file behind each page:

| Page | Address | Content |
|---|---|---|
| Home | `/` | `content/pages/home.mdoc` (headline, links, slideshow, small labels, headings, four fields, footage captions, holder, verify); notable coins in `content/notable/`; the nine steps come from the process page |
| Our process (9 steps) | `/process` | `content/pages/process.mdoc` |
| Grading standards (1–70 scale, details grades, designations, ancients, label) | `/grading-standards` | `content/pages/grading-standards.mdoc` |
| The holder and label | `/holder` | `content/pages/holder.mdoc` |
| Verify a certificate | `/verify` | `content/pages/verify.mdoc` (the lookup itself is code) |
| Why Provident | `/why-provident` | `content/pages/why-provident.mdoc` |
| About the company | `/about` | `content/pages/about.mdoc` |
| Submissions (steps, fees note, request form) | `/submit` | `content/pages/submit.mdoc` (the form's field labels are code) |
| Questions | `/faq` | `content/faq.json` and `content/pages/faq.mdoc` |
| Contact | `/contact` | Business info (`content/settings.json`) and `content/pages/contact.mdoc` |
| Journal | `/blog`, `/blog/<post>` | `content/pages/blog.mdoc`, posts in `content/blog/` |
| Privacy, Terms of use, Thank you | `/privacy`, `/terms`, `/thank-you` | `content/pages/….mdoc` |
| Population report (hidden until switched on) | `/population` | `content/pages/population.mdoc`; Business info → Show the population report |
| 404 | any unknown address | code |

Every structured block (steps, sections, reasons, services) has a **Symbol** drop-down: one of the site's own line
drawings (`src/components/Mark.astro`, names in `src/lib/marks.ts`). Plain text fields take a blank line between
paragraphs and `[text](/path)` links (Studio's **Link** button writes these). The inner pages' closing bands (statement
and links) are content too (`coda` in each page file). Still code on purpose: the menu, footer column headings, form
field labels and options, system messages (verify "not found", 404), the holder illustration and decorative microtext.

## Design

Dark, warm ivory and a restrained gold; Cormorant Garamond (display), Cinzel (wordmark, numerals and the inscription
capitals of labels), Inter (text). All three are self-hosted (`public/fonts/`, Latin subset, variable weights,
`font-display: swap`, the upright faces preloaded; faces in `src/styles/fonts.css`; SIL Open Font License): no Google
Fonts request.
Approved references (owner, 2026-11-02): security printing, Art Deco, coin engraving, raking light, film titles,
watch movements, and patek.com's footage panels (below). No loupe, no hover flips, no pointer-driven toys.
**Animations always play** (owner's rule: no reduced-motion opt-out). Coins never show an edge: the only flip (the home opening) is an edge-free 2D turn.

**Nothing pins and nothing follows the scroll position, anywhere** (owner, 2026-11-02: the scroll stories were "long
and annoying"; do them like patek.com). The page scrolls normally the whole time. Footage simply plays while it is on
screen; everything else reveals quickly (about 0.5 s, small stagger) as soon as it starts entering view, and line
drawings finish within a second. Only the header is sticky. **Shine** (owner: "it needs shine/flash/sparkle"):
short, bright, classy accents, like light catching polished metal in a jeweller's window.

**Home, in order:** hero → photo carousel → notable coins → footage I → what we grade → the nine steps → footage II →
holder and label (compact) → verify (compact) → footer.

| Effect | Where | How |
|---|---|---|
| Footage panels (after patek.com) | Home: after Notable coins ("Raking light") and after the nine steps ("Recorded and sealed") | Full-bleed panels about 86% of the screen tall (78% on phones), never pinned. Real coin footage, muted, inline: each panel cycles through three clips with a 1 s crossfade (never a hard cut or loop seam; see Footage below); the first clip loads about one screen before the panel arrives (poster first), the next one a few seconds before it is needed; it plays while on screen and pauses when it leaves (`src/components/Reel.astro`, `src/scripts/film.ts`). Dimmed and gold-graded in CSS (sepia/brightness filter, a gold `mix-blend-mode: color` layer, vignette). Caption: roman numeral + eyebrow and one line, Deco corners and a slowly turning guilloché rosette; it fades in once. Phones get the 640-wide renditions. |
| Opening (coin flip and iris) | Home, first visit in a browser session | About 2.3 s, after the prototype's coin-toss intro (`src/components/Intro.astro`, all inline: no extra request). A Provident medallion (PNA seal in a laurel wreath and inscription ring; the laurel P on the back) appears on the dark (0–0.3 s), catches the light: a glint on the rim (0.18 s) and a light sweep across the relief (0.26–0.88 s); flips twice with weight, a small wind-up, a fast middle and a small settle (0.64–1.5 s), with a second sweep and a glint as it lands; then zooms toward the viewer and its rim becomes the edge of an iris that opens onto the hero (1.56–2.32 s), with a short gold flash, a fading gold ring at the iris edge and four glints off the rim. The hero title sets in as the iris opens. **Never shows an edge**: a 2D turn, width = cos(angle), faces swap exactly at zero width, shading follows the angle (as `CoinEngine.flip`). Any click, key, wheel, scroll or touch skips to the site (a skipping click is not passed to a link underneath). Plays once per browser session (sessionStorage `pna-intro-seen`); `?intro` in the address always plays it, `?shot` never. **To change:** the constants at the top of the script in `Intro.astro`: `ONCE_PER_SESSION`, `KEY`, and `T` (appear, glint, sweep/sweepMs, flip/flipMs/turns, reveal/revealMs, in ms). Without JavaScript it never shows. |
| Home hero | Home | Static. The title sets itself once on load in under a second (letter-spacing settles, metal gold), then one bright light sweep and a glint or two. The coin river keeps drifting behind it. |
| Photo carousel | Home, right under the hero | Wide, matted slides; a slide every 5 s with a gold progress line under the active dot; arrows; native swipe on phones, drag with a mouse; pauses on hover, keyboard focus, off screen and in a hidden tab (`src/components/Carousel.astro`, `src/scripts/carousel.ts`). Photos come from Studio → Homepage slideshow (falls back to the spare photos in `content/gallery.json`); until there are any, three slides marked "Placeholder · Photo coming soon". |
| Notable coins | Home, under the carousel | Showcase cards on dark velvet: large round coin photo (reverse as a small inset if given), grade in metal gold (anything after the first comma, such as "Strike 5/5, Surface 4/5", goes on a small line under it), coin, note, "Certificate No. …" linking to `/verify?cert=…`. Studio → Notable coins (`content/notable/*.json`, `src/lib/notable.ts`). Until there are entries, three cards marked "Placeholder · Coming soon: notable coin". Never invent coins, grades or numbers. |
| Coin river (the one ambient signature) | Home hero | Slow, dimmed, desaturated; no interaction. `src/scripts/coin-engine.js`. |
| Shine: specular glints | Visible gold elements site-wide: monogram, the big title, gold rules, Deco corners, grade numbers, buttons, seals, medallions | One small four-point star (near-white, warm) flares and fades in 0.8 s on a random visible gold element every 3–7 s; never more than one; paused while the tab is hidden (`src/scripts/shine.ts`, `.glint` in `src/styles/shine.css`). |
| Shine: light sweeps | Section titles as they enter; the hero title on load; buttons, the Contact button and notable-coin cards on hover/focus (cards also once on entering); gold rules once drawn | A crisp near-white band crosses the type (background band, 0.9 s) or the box (skewed pseudo-element, 0.75 s), eased like a flick of light. |
| Shine: proof-coin flash | Notable coin discs as they enter view and when their card is hovered | A bright band turns across the coin's field (`.proof`, 0.85 s). |
| Metal gold | Hero title, grade numbers | `--metal`: deep bronze to near-white highlights, so the gold reads as metal. |
| Guilloche rosettes, turning very slowly | Page titles, home hero, footage panels, carousel placeholders, certificate panels, closing bands | `/guilloche.svg` is generated at build time (`src/lib/guilloche.ts`, about 20 KB) and rotated by CSS (4 minutes per turn). |
| Microtext borders | Footer edge, certificate panels, microtext dividers | `.microtext` in `src/styles/deco.css`; `.divider-micro` in `detail.css`. |
| Holographic foil | Verify seal, label seal, certificate panels | Spectral gradients that drift slowly on their own (time-based; no longer tied to scroll). |
| Art Deco | Stepped corners, stepped rules under titles, sunbursts behind closing sections | `src/styles/deco.css`. |
| Raking light | Section titles | A bright light band flicks once across each title as it enters view (0.9 s). |
| Engraved line drawings | Steps, scope, the grading scale rule | Inline SVG that draws itself once (stroke dash, under a second). |
| Exploded holder (after a watch-movement drawing) | Home and `/holder` | Back shell, insert, coin, label and front shell float apart in perspective and slide together on their own in about 0.9 s once the drawing comes into view; not scroll-driven (`src/components/HolderExplode.astro`, `src/styles/explode.css`). |

### Fine detail on every page (`src/styles/detail.css`, `src/components/Divider.astro`)

Quiet, finely made detail in the same security-print / Deco / engraving language: gold at 10–40% opacity, hairlines,
generous spacing, all CSS and inline SVG (no image files).

| Detail | Where |
|---|---|
| Stepped Deco corners + double hairline frame (brightens on focus/hover) | Forms (submit, contact), certificate card (verify), certificate panels, notable-coin cards, carousel slides, quotes in text |
| A small stepped corner on each block | Feature grids (why-provident, about services, holder, grading standards) |
| Ornamental dividers, varied: lozenge, rosette, microtext, guilloché band | Laurel (since the Rome accents): above every closing band (process, standards, holder, why, about) and at the end of each journal post. Rosette: above Verify on home. Microtext: home (before the nine steps), privacy/terms/thank-you. Meander: about, grading standards. Lozenge: submit, holder, verify. Band: submit (above the form), faq. |
| Eyebrow ornament (hairline ending in a lozenge) | Every eyebrow label |
| Flourish under page titles + a lozenge on the title's base rule | Every inner page title, 404 |
| Roman numerals | Steps (process, submit, home), footage captions |
| Faint guilloché in section corners, soft vignettes | Every inner page body, home "What we grade" and the nine steps |
| Lozenge bullets, roman-numeral ordered lists, rosette `<hr>`, dotted leaders in definition lists, lozenges on step rules | Text pages, journal, certificate facts, process and home steps |
| Inset museum mat with a thin gold line | Images in text and journal posts, certificate photos, carousel |
| Gold focus line that draws across inputs; hairline gold checkbox (lozenge tick) and radio | All forms |
| Fine gold underline that draws in on hover | Footer links, process step index, journal list, contact details |
| Footer: guilloché band with the seal (now the Roman seal, see below), small-caps legal line | Every page |

### Ancient-Rome accents (`src/styles/roman.css`, `src/lib/roman.ts`)

Client, 2026-11-02: "a sort of ancient Rome type of feel for the accents", keeping the simple, modern, dark and gold
look. Added after the saved look `look-v1-dark-shine` as refined accents, not a theme: hairlines, gold at low
opacity, inline SVG and CSS only (no images; the one added file is the Cinzel font, Latin subset, 26 KB).

| Accent | Where |
|---|---|
| Inscription lettering: Cinzel capitals (after the Trajan column) with interpuncts between words, "WHAT · WE · GRADE" (`src/components/Inscr.astro`; commas give way to the dots; labels over five words stay as written) | Every eyebrow label (all pages, footage captions, notable coins), footer column headings; Cinzel also on "Certificate No." |
| Laurel wreath, fine line | Around the P monogram in the header and footer (`BrandMark.astro`), and on the footer seal |
| Laurel sprigs | Flanking the grade on notable-coin cards; the laurel divider (two sprigs and a ring) that opens every inner closing band (process, standards, holder, why, about) and ends each journal post |
| Bead-and-reel moulding | A thin band under the header (on home it appears with the header's background) |
| Egg-and-dart moulding | A thin band along the top edge of the footer, every page |
| Meander (Greek key), sparingly | Two dividers only: About and Grading standards (replacing the microtext line there) |
| Fluted column rules | Between the footer columns (desktop) |
| Denarius bead ring | A ring of fine dots just outside each round notable-coin image (and placeholder) |
| Marble veining, barely visible | Inner-page closing bands and the home holder section |
| Seal | Footer seal: the company initials (PNA, from the site name; never "SPQR") inside a laurel wreath, a beaded ring and the full name cut in an inscription ring (`Seal.astro`) |
| Glints | The shine system now also catches the laurel monogram, the seal, the grade sprigs and the laurel dividers |

Roman numerals stay where they were (steps, footage captions). To compare with the look before these accents:
`git diff look-v1-dark-shine`.

### Footage (stock, free licence, real footage only)

Each footage panel cycles through **three different real coin clips** (owner, 2026-11-02: "multiple videos that it
cycles through", no ugly cut). Two stacked `<video>` elements take turns: while one plays the good part of its clip
(in to out point, 5 to 7 s), the other fetches the next clip about 3 s before it is needed and waits at its in-point;
1 s before the out-point the next clip starts on top and fades in (CSS opacity, 1 s, eased). After the last clip it
crossfades back to the first, so there is never a hard cut or a loop seam. Only the current and the next clip are
ever loaded, nothing before the panel is about one screen away, and it all pauses off screen. Sequences and in/out
points: `src/pages/index.astro` (`clips`); timing: `src/lib/film.ts` (`FADE`, `LEAD`, tested in
`tests/film.test.ts`); player: `src/scripts/film.ts`.

All clips are from Pexels under the [Pexels licence](https://www.pexels.com/license/) (free for commercial use, no
attribution required; not to be resold as stock). They are the original Pexels MP4 renditions (no re-encoding; ffmpeg
is not available here), served from `public/media/film/`. Posters are single frames from each panel's first clip
(`silver-poster.webp`, 15 KB; `bronze-poster.webp`, 16 KB). Phones (720 px wide or less) get the 640-wide file.

| Panel | # | Clip (Pexels ID) | Author | Desktop file (size) | Phone file (size) | In–out |
|---|---|---|---|---|---|---|
| I, "Raking light" | 1 | [Close-up of British coins in macro view (5651766)](https://www.pexels.com/video/metal-money-silver-macro-5651766/) | Tima Miroshnichenko | `5651766-hd_1280_720_25fps.mp4` (2.4 MB) | `5651766-sd_640_360_25fps.mp4` (0.45 MB) | 0:00.15–0:06.6 |
| I | 2 | [Close-up footage of US money coins (5651775)](https://www.pexels.com/video/close-up-footage-of-us-money-coins-5651775/): slow macro slide across a heap of coins | Tima Miroshnichenko | `5651775-sd_960_540_25fps.mp4` (1.17 MB) | `5651775-sd_640_360_25fps.mp4` (0.51 MB) | 0:02–0:08.4 |
| I | 3 | [Close-up video of coins (5651783)](https://www.pexels.com/video/close-up-video-of-coins-5651783/): shallow-focus macro gliding over coin relief | Tima Miroshnichenko | `5651783-sd_960_540_25fps.mp4` (1.53 MB) | `5651783-sd_640_360_25fps.mp4` (0.52 MB) | 0:01.4–0:07.6 |
| II, "Recorded and sealed" | 1 | [Bronze coins on a turntable (7348172)](https://www.pexels.com/video/bronze-coins-on-a-turntable-7348172/) | Charlie Mounsey | `7348172-sd_960_506_30fps.mp4` (0.99 MB, all screens; despite its name the file is 426×226, the only small rendition Pexels serves; the next one up is 6.7 MB) | same | 0:03–0:10 |
| II | 2 | [Close up footage of coins (5253412)](https://www.pexels.com/video/close-up-footage-of-a-coins-5253412/): coins on a dark wooden table, low warm light | Jerms | `5253412-sd_640_360_24fps.mp4` (1.50 MB, all screens; the 960 file is 2.8 MB) | same | 0:07–0:13.5 |
| II | 3 | [US coins of different value (5651769)](https://www.pexels.com/video/us-coins-of-different-value-5651769/): slow pull back from a pile of coins | Tima Miroshnichenko | `5651769-sd_960_540_25fps.mp4` (1.42 MB) | `5651769-sd_640_360_25fps.mp4` (0.48 MB) | 0:00.2–0:06 |

Added for the cycling (2026-11-02): 7.1 MB on disk; a desktop visitor loads at most about 5.6 MB of it, a phone
about 3 MB, and only as each clip comes up. Download address pattern:
`https://videos.pexels.com/video-files/<id>/<file name>`. Looked at and not used: Pexels has no real ancient or Roman
coin footage (searched "ancient coins", "roman coins", "old coins"); the "gold coin" macro clips there are Bitcoin
tokens; the magnifying-glass clips show banknotes; spinning-coin clips show the coin edge (the site never shows an
edge). [Close-up of ancient Turkish coins](https://www.pexels.com/video/close-up-of-ancient-turkish-coins-12848317/)
shows modern pocket change. When the owner sends real footage of his own grading room, replace the files and the
captions (Studio, home page, or `film` in `content/pages/home.mdoc`).

### Saved looks

Approved looks are kept as annotated git tags, so we can always go back to one.

| Tag | Saved | What it contains |
|---|---|---|
| `look-v1-dark-shine` | 2026-11-02, commit `8c211ec` | The owner-approved look: dark theme with warm ivory and restrained gold, the shine system (glints, light sweeps, proof-coin flash, metal gold), the fine framing and detail (Deco corners, guilloché, microtext, dividers), Patek-style footage panels cycling through three clips each with crossfades, the photo carousel and notable coins. Before the ancient-Rome accents. |

- See it again: `git checkout look-v1-dark-shine` (a read-only look; `git checkout master` comes back).
- Compare today's site with it: `git diff look-v1-dark-shine` (add `--stat` for a list of changed files, or a path such as `-- src/styles`).
- Go back to it for good: `git switch -c restore-look-v1 look-v1-dark-shine`, check it, then merge that branch.
- List saved looks: `git tag -n1 "look-*"`.

### Code map

- Tokens: `src/styles/theme.css`. Site styles: `global.css`; decorative system: `deco.css`; shine: `shine.css`; fine
  detail: `detail.css`; ancient-Rome accents: `roman.css`; inner pages: `pages.css`; home: `home.css`; exploded holder: `explode.css`; coins:
  `coin-engine.css`.
- Header, phone menu, reveals: `src/scripts/site.ts`. Glints, sweeps and flashes: `src/scripts/shine.ts`. Footage:
  `src/scripts/film.ts`. Carousel: `src/scripts/carousel.ts`.
- Add `?shot` to a URL to freeze the coin river for screenshots.
- Photos: `src/components/Photo.astro` (carousel, notable coins, journal covers, photos in page/journal text via
  `markdoc.config.mjs`). After `astro build`, `src/integrations/photos.ts` writes every photo in `public/images/` at
  320–1920 px wide as AVIF and WebP into `dist/client/_img/` with sharp (hash-named, cached a year by
  `server/headers.mjs`; encoded sizes are kept in `node_modules/.cache/provident-photos` so a rebuild only encodes new
  photos when the host keeps that folder). The page gets `<picture>` with srcset/sizes, width and height, lazy loading
  except a journal post's cover. No image service at runtime. In `astro dev` and Studio's preview photos are plain `<img>`.

## Stack

- [Astro](https://astro.build) 7, TypeScript strict. Pages are static HTML (fast, cheap to host).
- **Provident Studio**, the owner's editor at **/admin** (built in: `src/studio/`, `src/lib/studio/`; setup and how it
  works: [docs/STUDIO_SETUP.md](docs/STUDIO_SETUP.md)). Content lives as files in `content/` and images in
  `public/images/`, so the Git repository is the whole website: no database. On the live site Studio saves to a
  drafts branch through a GitHub App and Publish merges the drafts into `main` (Hostinger rebuilds once per publish).
  [Keystatic](https://keystatic.com) remains as a fallback editor in local development only (`/keystatic`).
- Hostinger Web App (Node.js) with `@astrojs/node` (standalone). Static pages are served from `dist/client` by the
  Node server `server/start.mjs` (adds cache and security headers). Rendered on request: Studio (`/admin`,
  `/api/studio/…`, signed in only), the certificate lookup (`/api/verify`), the forms (`/api/form`, emailed over SMTP:
  `src/lib/forms.ts`, `src/lib/mailer.ts`) and the population report (`/population`, only when switched on).
- Certificates are **not** stored in this repository: they come live from the owner's own certificate database through its
  API. The answers are cached in Hostinger MySQL (`src/lib/kv.ts`, one table `provident_kv`; files under `.data/kv`
  locally). Studio's sign-in locks live there too.

## Run it locally

Needs Node 22.22 or newer.

```sh
npm install
npm run dev        # http://localhost:4321  (Studio: http://localhost:4321/admin)
npm test           # unit tests (certificate lookup, adapters, cache, rate limit, population, notable coins, Studio)
npm run check      # TypeScript / Astro type check
npm run build      # production build into dist/
npm start          # run the built site like Hostinger does (http://localhost:4321)
npm run studio:hash  # make the Studio password hash and session secret
```

Locally the forms work without email settings under `npm run dev` (entries are only noted in the console); with
`npm start` they need the `SMTP_*` variables (any test SMTP server will do: `SMTP_HOST`, `SMTP_PORT`,
`SMTP_SECURE=false`).

Locally Studio runs in **local mode**: saving writes straight to the files in `content/` and `public/images/`,
"What's changed" is what git sees as changed, Undo restores the committed version, and Publish is simulated (it shows
the diff; nothing is committed or pushed). To sign in, put `STUDIO_EMAIL`, `STUDIO_PASSWORD_HASH` and
`STUDIO_SESSION_SECRET` in `.env` (see `.env.example`; `npm run studio:hash` makes the last two).
Without `CODA_DOC_ID` the Verify page runs in **demo mode** with three clearly labelled made-up records: try
`DEMO-0001`, `DEMO-0002` or `DEMO-0003` (anything else shows the "not found" state). Copy `.env.example` to `.env` to try settings.

## Where things are

| What | Where |
|---|---|
| What the owner can edit: labels, help text, limits (Studio) | `src/lib/studio/schema.ts` (the Keystatic fallback: `keystatic.config.ts`, keep in step) |
| Which element shows which field (editing annotations) | `src/lib/edit.ts`, used in the page templates; content loading in `src/lib/content.ts` |
| Business info: name, footer line, phone, email, location, hours, social links, **population switch**, **launched switch** | `content/settings.json` |
| FAQ, spare slideshow photos | `content/faq.json`, `content/gallery.json` (the home slideshow falls back to these while it has none) |
| Each page's title, description, heading, intro and text | `content/pages/*.mdoc` |
| Blog posts | `content/blog/*.mdoc` (photos in `public/images/blog/`) |
| Styles | `src/styles/` (see Design above) |
| Coin engine (drawn coins, the hero river) | `src/scripts/coin-engine.js`, `src/styles/coin-engine.css` |
| Footage panels, carousel, shine | `src/scripts/film.ts` (clips in `public/media/film/`), `src/scripts/carousel.ts`, `src/scripts/shine.ts` |
| Notable coins | `content/notable/*.json` (Studio → Notable coins), photos in `public/images/notable/`, `src/lib/notable.ts` |
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
- `/api/verify` (rendered on request) normalises the number (capitals, spaces, `#`, `No.` ignored; letters, digits and
  dashes only), applies a **per-visitor limit** (20 a minute, 300 a day per IP, per running server),
  checks the **cache** (MySQL, namespace `cert-verify`: found 1 hour so corrections show quickly, not found
  5 minutes), then asks the adapter. The reply is validated against our certificate schema (https photo links only)
  and must be for the number asked. Errors reach the visitor only as a generic message; logs carry the error kind
  only. **The API key is read from server environment variables and is never sent to the browser or logged.**
- **Adapter**: `src/lib/certs/adapter.ts` is the small interface (`getCertificate(number)`, optional `listAll()`).
  `providers/coda.ts` is the one file that knows the owner's database: his certificate table in Coda (coda.io, now
  also called Superhuman Docs), read with a read-only, doc-restricted API token. Column names are mapped with
  `CODA_COLUMN_MAP`. With no `CODA_*` variable set, `providers/mock.ts` serves the DEMO records. Setup steps:
  `docs/CODA_SETUP.md`.
- **Population report** (`/population`): needs the database to list every certificate (`listAll()`). It is hidden
  (404, not in the menu or sitemap) until **Business info → Show the population report** is switched on. With the DEMO
  records it shows demo numbers labelled DEMO; if the real database can't list certificates it says the report isn't
  available, so leave the switch off.

### What we need from the owner about the certificate database (Coda)

See `docs/CODA_SETUP.md`: the doc link, the table name, a screenshot of the header row, how photos and cert numbers
are stored, and (at launch) a read-only token restricted to that doc, pasted into Hostinger's environment variables only.

## How the owner edits the site (after launch)

1. Go to `https://<his domain>/admin` and sign in with his email and password (Provident Studio).
2. The dashboard is organised by job: **Edit my website** (the real pages: click any words to type over them, click a
   photo to replace it; lists have Move, Add, Details and Remove buttons; computer and phone views), **Notable
   coins**, **Homepage slideshow**, **Journal**, **Photo library**, **Business info** and **Publish**. Every change
   is saved at once as a draft and is **not live yet**; "Not published yet" lists them, each with Undo.
3. When he's done he presses **Publish**: all drafts go live together, Hostinger rebuilds once (a few minutes). How
   it works: [docs/STUDIO_SETUP.md](docs/STUDIO_SETUP.md).
4. Certificates are **not** edited here: the owner keeps entering them in the existing certificate database as he does today.
   A new certificate is verifiable on the site within about 5 minutes; a correction shows within the hour.

## Launch setup (in the owner's name; he creates the accounts, we never hold his passwords)

### Put the site on Hostinger, click by click

You need: Alex's Hostinger login (he signs in, or shares the screen; we never hold his password), the GitHub
account that holds this repository (ours for now: `boogmasterjones/providentnumismaticgrading`), and about 30
minutes. Never paste a password or key into a chat or an email: only into hPanel.

**Step 1: make the database** (the site keeps its lookup cache and sign-in locks here)

1. Sign in at hpanel.hostinger.com.
2. Click **Websites** in the left menu. If his domain is already listed, click **Dashboard** next to it; if not, any
   website dashboard on the plan works for this step.
3. In the left menu click **Databases**, then **MySQL Databases**.
4. Under "Create a new MySQL database", type a name such as `provident` and click **Create**. Hostinger adds a
   user to it. Write down three things in a safe place: the **database name**, the **user name** (both start with
   `u` and some numbers, like `u123456789_provident`) and the **password** (click the eye or "Change password" to set
   one you can copy).
5. You do not need to create any tables: the website makes its own table the first time it runs.

**Step 2: make the mailbox that sends the form emails**

1. In hPanel click **Emails** in the left menu, pick his domain, and click **Create email account**.
2. Name it `forms` (so it reads `forms@hisdomain.com`), set a strong password, click **Create**.
3. Write down the address and the password. The website signs in to this mailbox to send each form entry to Alex.

**Step 3: create the Web App and connect GitHub**

1. In hPanel click **Websites**, then **Add website** (or **Create site**), and choose **Web App** /
   **Node.js web app**.
2. Pick the domain: his real domain if it is already on Hostinger, or the **temporary domain** Hostinger offers if
   you want to test first (you can add his domain later).
3. Choose **Import your Git repository** → **GitHub**. A GitHub window opens: sign in, click **Install** for the
   Hostinger app, choose **Only select repositories**, pick `providentnumismaticgrading`, and click **Install**.
   (One Hostinger plan can be connected to one GitHub account at a time.)
4. Back in hPanel pick the repository and click **Next**.
5. Check the settings exactly like this, then click **Continue**:
   - Framework: **Astro**
   - Branch: **main**
   - Node version: **22** (or 24)
   - Root directory: leave as is (the top of the repository)
   - Package manager: **npm**
   - Build command / build script: **build**
   - Output directory: **dist**
   - Entry file: **server/start.mjs** (type it exactly; NOT `dist/server/start.mjs`, and do not leave it empty, or
     the forms, certificate lookup and Studio will not work)

**Step 4: add the settings (environment variables)**

On the "Environment variables" part of the setup (or later: the website's dashboard → **Environment variables**),
click **Add** for each name below and paste its value. Hostinger may already list some names it found in the
code with "Action required"; fill those in. Leave out any you do not have yet.

| Name | What to paste |
|---|---|
| `DB_NAME` | the database name from Step 1 |
| `DB_USER` | the database user from Step 1 |
| `DB_PASSWORD` | the database password from Step 1 |
| `SMTP_USER` | the mailbox address from Step 2 (`forms@hisdomain.com`) |
| `SMTP_PASSWORD` | that mailbox's password |
| `FORM_TO` | the address that should receive the forms (Alex's own email) |
| `STUDIO_EMAIL` | the email Alex signs in to Studio with |
| `STUDIO_PASSWORD_HASH` | from `npm run studio:hash` (we run it with Alex typing his password; paste the base64 line) |
| `STUDIO_SESSION_SECRET` | the second line `npm run studio:hash` prints |
| `STUDIO_GITHUB_REPO` | `boogmasterjones/providentnumismaticgrading` (his own after the transfer) |
| `STUDIO_GITHUB_APP_ID` | from the Studio GitHub App ([docs/STUDIO_SETUP.md](docs/STUDIO_SETUP.md)) |
| `STUDIO_GITHUB_APP_PRIVATE_KEY` | the app's private key, **base64-encoded on one line** |
| `CODA_DOC_ID`, `CODA_TABLE_ID`, `CODA_API_TOKEN`, `CODA_COLUMN_MAP` | the certificate database ([docs/CODA_SETUP.md](docs/CODA_SETUP.md)); leave all out to show the DEMO records |
| `SITE_HOSTS` | only while testing on the temporary address: that address, e.g. `something.hostingersite.com` |

Do **not** add `PORT` (Hostinger sets it) or `STUDIO_STORAGE`. Never set any value in the code or in GitHub. Saving
the variables redeploys the site (a few minutes).

**Step 5: deploy and test**

1. Click **Deploy**. Wait for "Deployment completed". If it fails, open the build log: Hostinger shows the error.
2. Open the site. Check: the home page loads; `/verify` → type `DEMO-0001` → a DEMO card shows (or a real number once
   Coda is set); send the **contact** form and the **submission** form once each and check that both emails reach
   `FORM_TO` (look in spam the first time); `/admin` → sign in.
3. In Studio change one word: the live site does **not** rebuild. Press **Publish**: hPanel → Deployments shows one
   new deployment, and a few minutes later the word is live. Then undo the test word and publish again.

**Step 6: point the domain**

1. If his domain is registered at Hostinger and the Web App was created on it, there is nothing to do.
2. If the Web App was made on the temporary domain: website dashboard → **Domains** (or "Connect domain") → add his
   domain, then follow Hostinger's prompt. If the domain is registered elsewhere, Hostinger shows the two
   **nameservers** (or the A record) to enter at that registrar.
3. Wait for the free SSL certificate to show **Active** (website dashboard → **Security → SSL**), and switch on
   **Force HTTPS** if it is offered.
4. In Studio → **Business info**, set **Website address** to `https://` + the domain (it feeds the sitemap and tells
   the server which address to trust), and Publish. Then remove `SITE_HOSTS` if you added it.
5. **Search Console**: add the domain under Alex's Google account and submit `/sitemap-index.xml`.

**When the repository moves to Alex's GitHub:** hPanel → the website → GitHub settings → **Disconnect**, connect
Alex's GitHub account, pick his repository with the same settings as Step 3, and change `STUDIO_GITHUB_REPO` (and the
Studio GitHub App, installed on his account).

More detail, sources and Hostinger's limits: [docs/HOSTINGER_DEPLOY.md](docs/HOSTINGER_DEPLOY.md).

## LAUNCH CHECKLIST

- [ ] `CODA_*` variables + read-only `CODA_API_TOKEN` set in Hostinger; one real certificate and one wrong number tested (the
      DEMO records disappear by themselves once the `CODA_*` variables are set).
- [ ] Population report switch: on only if the owner's database can list every certificate and the figures look right.
- [ ] Every item in `CONTENT_TO_CONFIRM.md` confirmed by the owner (name, headline, process claims, grading scale
      and standards, About text, FAQ answers, phone, email, hours, location, privacy text) and the text updated.
- [ ] Replace the stock-footage frames with the owner's own footage if he has some (optional; the Pexels licence allows the current ones).
- [ ] No credential or claim (years at another grading service, memberships, guarantees, "best", "industry accepted") unless the owner confirms
      it and can back it up.
- [ ] Real photos only (the owner's slabs and coins; never a photo of him). No stock or AI images. The coins in the moving background are drawn by the site.
- [ ] Business info → **Website address** = the real domain.
- [ ] Business info → switch on **The site is launched** (removes noindex, opens robots.txt, hides the preview banner).
- [ ] PageSpeed mobile checked on the live address.
- [ ] Hostinger Web App: entry file `server/start.mjs`, branch `main`, Node 22 or 24; `DB_*` and `SMTP_*` / `FORM_TO`
      set; both forms tested and both emails arrived; Runtime Logs show no `[kv] database unavailable` or `[form]` errors.
- [ ] Provident Studio: GitHub App installed on this repository only; the six `STUDIO_*` variables set in Hostinger;
      the owner can sign in at /admin, a test edit does not rebuild, Publish rebuilds once and the change goes live;
      Undo the test edit afterwards.
- [ ] `/api/studio/changes` in a private window answers 401; `/keystatic` is a 404 on the live site.
- [ ] Domain + HTTPS; Search Console verified and sitemap submitted.
- [ ] Anonymity check: search the built `dist/` for the owner's name, "President" and "founder": zero hits.
