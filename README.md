# Provident grading website

Website for Alex Masella's coin grading company (Provident Numismatic Authentication, Venice FL; the final name is
Alex's call). Built by Biggify. At launch the repository moves to **Alex's own GitHub** and the site to **Alex's own
Netlify account**: he owns everything.

**Status: build steps 1–4 done (structure, editor, forms, certificate lookup, population report, PCGS lookup).**
The look is a neutral placeholder: the design Alex picks (one of 7) is applied later in `src/styles/theme.css` plus
the home-page coin strip. Text marked `[PLACEHOLDER — Alex to confirm]` is waiting for his facts.

## Stack

- [Astro](https://astro.build) 7, TypeScript strict. Pages are static HTML (fast, cheap to host).
- [Keystatic](https://keystatic.com) editor at **/admin** (redirects to `/keystatic`). Content lives as files in
  `content/` and images in `public/images/`, so the Git repository is the whole website: no database.
- Netlify: hosting, **Netlify Forms** (submission + contact), and two on-demand routes run as Netlify Functions through
  the Astro Netlify adapter: the editor (`/keystatic`, `/api/keystatic`) and the PCGS lookup (`/api/pcgs`).
- Netlify Blobs caches PCGS results and counts the daily PCGS budget (included in Netlify's free plan).

## Run it locally

Needs Node 22.22 or newer.

```sh
npm install
npm run dev        # http://localhost:4321  (editor: http://localhost:4321/admin)
npm test           # unit tests (population, certificate index, PCGS function)
npm run check      # TypeScript / Astro type check
npm run build      # production build into dist/
```

Locally the editor runs in **local mode**: saving writes straight to the files in `content/` and `public/images/`.
Without `PCGS_API_TOKEN` the PCGS lookup runs in **demo mode** with clearly labelled fake data (numbers ending in
`0000` show the "not found" state). Copy `.env.example` to `.env` to try settings.

## Where things are

| What | Where |
|---|---|
| Editor schema (what Alex can edit) | `keystatic.config.ts` |
| Site settings: name, phone, email, location, hours, social links, **launched switch** | `content/settings.json` |
| Fees table, FAQ, photo library | `content/fees.json`, `content/faq.json`, `content/gallery.json` |
| Each page's title, description, heading, intro and text | `content/pages/*.mdoc` |
| Blog posts | `content/blog/*.mdoc` (photos in `public/images/blog/`) |
| Certificates (one file per slab) | `content/certificates/*.json` (photos in `public/images/certificates/`) |
| Theme tokens (the only file a design must replace) | `src/styles/theme.css` |
| Certificate lookup index / population maths | `src/lib/certIndex.ts`, `src/lib/population.ts` |
| PCGS lookup (server only) | `src/lib/pcgs/lookup.ts`, `src/pages/api/pcgs.ts` |

### How the certificate pages work

Every certificate becomes a static page at `/verify/<slug>/`. The build also writes `/verify/certificates.json`, a
small index the Verify page loads in the browser to find a typed number (capitals, spaces, `#` and `No.` are ignored).
Two certificates with the same number stop the build, so a typo can't hide a record. The population report is
computed at build time from the same records, grouped by coin type (country/denomination + year) and grade.

### PCGS lookup

`/api/pcgs?cert=12345678` or `/api/pcgs?barcode=…&service=PCGS|NGC`. The token stays on the server; responses never
contain it and errors are logged by kind only. Protections:

- **Cache**: found results 7 days, "not found" 1 hour (Netlify Blobs store `pcgs-lookup`; memory locally).
- **Per-visitor limit**: 10 lookups a minute and 60 a day per IP (per running copy of the function).
- **Daily PCGS budget**: `PCGS_DAILY_BUDGET` (default 900) real PCGS calls per UTC day across the site; after that
  visitors are sent to PCGS's own page. PCGS's free allowance is reported as 1,000 calls a day.
- Every result links to PCGS's own certificate page and says that a matching record does not rule out counterfeit or
  altered holders. NGC, CAC and ICG have no public API we can use, so the page links to their verification pages.
- PCGS photos and price guide values are **hidden** until PCGS's terms are checked (`PCGS_SHOW_IMAGES`,
  `PCGS_SHOW_PRICES`).

What was verified about the PCGS API (2026-11-02): endpoints, parameters and reply fields come from PCGS's own
Swagger spec (`https://api.pcgs.com/publicapi/swagger/docs/v1`). **Not verified** (PCGS's documentation page blocks
our tools): how the token is sent (we send `Authorization: bearer <token>`, as quoted by secondary sources; set
`PCGS_AUTH_MODE=query` to send it as `api_key=` instead if PCGS rejects the header), the daily allowance, how long a
token lasts, and whether PCGS's terms allow a public lookup tool, caching, photos and prices. Check all of this with
the first real token before launch.

## How Alex edits the site (after launch)

1. Go to `https://<his domain>/admin` and sign in with his GitHub account.
2. Change text, prices, FAQ, photos, blog posts or certificates, and press **Save**. Saves go to an edits branch
   (named `edits/…`) and are **not live yet**.
3. When he's done, he publishes: in the editor's branch menu, **Create pull request**, then **Merge** it on GitHub.
   Netlify rebuilds once (about a minute) and the changes are live. One build per publish keeps Netlify's free
   build allowance safe.
4. New certificate: Certificates → Add, type the number exactly as on the label, fill in the fields, add front and
   back photos. It appears on the Verify page and in the population report after the next publish.

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
4. **PCGS**: Alex requests PCGS Public API access with his PCGS login and generates the token himself. Put it in
   Netlify as `PCGS_API_TOKEN` (secret, Functions scope). Test one known cert number; if PCGS refuses the request, try
   `PCGS_AUTH_MODE=query`. Confirm PCGS's terms before turning on `PCGS_SHOW_IMAGES` / `PCGS_SHOW_PRICES`.
5. **Forms**: Netlify → Forms → enable form detection, redeploy, then Forms → Form notifications → email to Alex's
   address for both `submission` and `contact`. Send one test of each. (Free plan: 100 submissions a month.)
6. **Domain**: point Alex's domain at Netlify (Domain management), HTTPS on, and set **Website address** in Site
   settings to the final address (used by the sitemap and canonical links).
7. **Search Console**: add the domain under Alex's Google account and submit `/sitemap-index.xml` after launch.

## LAUNCH CHECKLIST

- [ ] Delete the three SAMPLE certificates (`content/certificates/sample-000*.json`) and add Alex's real records.
- [ ] Delete the sample blog post (`content/blog/sample-post-delete-before-launch.mdoc`).
- [ ] Replace every `[PLACEHOLDER — Alex to confirm]` (search the `content/` folder: none may remain). This includes
      the business name, headline, fees and turnaround, grading scale and standards, About text, FAQ answers, phone,
      email, hours, location and privacy text.
- [ ] No credential or claim (years at NGC, memberships, guarantees, "best", "industry accepted") unless Alex confirms
      it and can back it up.
- [ ] Real photos only (Alex's own, or public-domain museum images with the owner's OK per source). No stock or AI
      images.
- [ ] Site settings → **Website address** = the real domain.
- [ ] Site settings → tick **Site is launched** (removes noindex, opens robots.txt, hides the preview banner).
- [ ] Design applied (step 5) and PageSpeed mobile checked.
- [ ] Netlify Forms detection on + notification emails set; test both forms.
- [ ] `PCGS_API_TOKEN` set and one real lookup tested; PCGS terms checked.
- [ ] Keystatic GitHub app set up; Alex can sign in at /admin and publish.
- [ ] Domain + HTTPS; Search Console verified and sitemap submitted.
