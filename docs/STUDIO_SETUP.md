# Provident Studio: setup and how it works

Provident Studio is the owner's editor at **`https://<his domain>/admin`**. He signs in with an email and a password,
sees his real pages, clicks any words or photo to change them, and presses **Publish** when he is done. Everything is
saved in the website's own GitHub repository, so there is no database and nothing else to pay for.

This page is for whoever sets the site up (Biggify now, the owner's web person later). It lists the settings by
**name only**: the values are secrets and live only in Netlify.

## What Studio is made of

| Part | Where |
|---|---|
| Studio app (dashboard, visual editor, coins, slideshow, journal, photos, business info, publish) | `src/studio/`, page `src/pages/admin/index.astro`, styles `src/styles/studio.css` |
| Sign-in page | `src/pages/admin/login.astro` |
| Live preview of the real pages (drafts, with editing switched on) | `src/pages/admin/preview/…` → the normal page templates |
| In-page editor (only loaded inside the preview) | `src/scripts/studio-overlay.ts`, annotations from `src/lib/edit.ts` |
| Which words and photos are editable, labels, limits | `src/lib/studio/schema.ts` |
| Server routes (all need a signed-in session) | `src/pages/api/studio/…`, guarded by `src/middleware.ts` |
| Sign-in, session, rate limit, lockout | `src/lib/studio/auth.ts` |
| Storage: local files, or GitHub drafts branch | `src/lib/studio/store-local.ts`, `src/lib/studio/store-github.ts` |

The public pages are unchanged static HTML: they carry no editor code and no extra markup. The editing markers
(`data-sf…` attributes) are only added when a page is rendered inside Studio's preview.

## Settings (Netlify → Site configuration → Environment variables)

Add each one with **Scopes: Functions** (Studio runs as a Netlify Function; the build does not need them) and tick
**Contains secret values** where Netlify offers it.

| Name | What it is | Secret |
|---|---|---|
| `STUDIO_EMAIL` | The email the owner signs in with. | no |
| `STUDIO_PASSWORD_HASH` | A bcrypt hash of his password (never the password itself). Make it with `npm run studio:hash`. | yes |
| `STUDIO_SESSION_SECRET` | A long random value that signs the session cookie. `npm run studio:hash` prints one. Changing it signs everyone out. | yes |
| `STUDIO_GITHUB_REPO` | The repository, as `owner/repository`. | no |
| `STUDIO_GITHUB_APP_ID` | The GitHub App's "App ID" (a number). | no |
| `STUDIO_GITHUB_APP_PRIVATE_KEY` | The App's private key (the whole `.pem` file; real line breaks, `\n`, or base64 of the file all work). | yes |
| `STUDIO_GITHUB_INSTALLATION_ID` | Optional. Looked up automatically when empty. | no |
| `STUDIO_LIVE_BRANCH` | Optional. The branch Netlify publishes, default `main`. | no |
| `STUDIO_DRAFTS_BRANCH` | Optional. Where unpublished edits are kept, default `studio-drafts`. | no |

Without the three sign-in settings nobody can sign in (the sign-in page says so). Without the GitHub settings the live
Studio refuses to save and says it is not connected; it never falls back to anything else.

**Locally** none of the GitHub settings are needed: `npm run dev` runs Studio in *local mode*, which edits the files
in this folder directly, and Publish only shows what would be published (nothing is committed or pushed). Put the
three sign-in settings in `.env` (git-ignored); `astro.config.mjs` loads it for the server code in development.

## Making the password (once, and whenever it changes)

1. In this folder run `npm run studio:hash` and type the new password (at least 12 characters; a short sentence is
   easiest). It is not shown and not stored.
2. Copy the printed hash into `STUDIO_PASSWORD_HASH` in Netlify (either printed line works), and, the first time, the
   printed secret into `STUDIO_SESSION_SECRET`.
3. **Deploys → Trigger deploy → Deploy site** so the Function picks up the new value. Changing the hash signs out
   every open session.

Studio never emails passwords and has no "forgot password" link on purpose (no email service to attack). If the owner
forgets it, his web person repeats the three steps above.

## The GitHub App (one time, in the owner's own GitHub account)

Studio saves through a small GitHub App that the owner owns. It can only read and write the files of this one
repository; it cannot see his other repositories or change any GitHub settings. Do this signed in to **the owner's
GitHub account** (the account that owns the website repository).

1. Open **github.com → your profile picture (top right) → Settings**.
2. At the bottom of the left menu: **Developer settings → GitHub Apps → New GitHub App**.
3. Fill in:
   - **GitHub App name**: `Provident Studio` (it must be unique on GitHub; add the domain if the name is taken).
   - **Homepage URL**: the website address, e.g. `https://www.example.com`.
   - **Callback URL**: leave empty. Leave "Request user authorization (OAuth) during installation" **unticked**.
   - **Webhook**: **untick "Active"** (Studio needs no webhooks).
4. **Permissions → Repository permissions**:
   - **Contents: Read and write**.
   - **Metadata: Read-only** (GitHub sets this one by itself).
   - Everything else stays **No access**. No organization or account permissions.
5. **Where can this GitHub App be installed?** → **Only on this account**.
6. Press **Create GitHub App**. On the page that opens, copy the **App ID** (a number near the top) into Netlify as
   `STUDIO_GITHUB_APP_ID`.
7. On the same page scroll to **Private keys → Generate a private key**. A `.pem` file downloads. Open it in Notepad,
   copy **everything** (including the `-----BEGIN` and `-----END` lines) and paste it into Netlify as
   `STUDIO_GITHUB_APP_PRIVATE_KEY`. Then delete the downloaded file (GitHub keeps no copy; you can always generate a
   new key and delete the old one on the same page).
8. In the left menu of the App: **Install App → Install** next to the owner's account → **Only select repositories**
   → choose the website repository → **Install**.
9. In Netlify set `STUDIO_GITHUB_REPO` to `owner/repository` (exactly as in the repository's web address).
10. **Deploys → Trigger deploy → Deploy site**. Then sign in at `/admin`, change a word, and check that the
    "Publish" button shows 1 change.

### Netlify: build only what is published

Studio commits every save to the drafts branch. Those commits must not start a build:

- **Site configuration → Build & deploy → Continuous deployment → Branches and deploy contexts → Configure**:
  **Production branch** `main`, **Branch deploys: Deploy only the production branch**, **Deploy Previews: Don't
  deploy pull requests**. Save.

## How saving and Publish work

```
 owner edits in Studio ──► commit on "studio-drafts" (one per save; live site untouched, no build)
                                   │
            "What's changed" = GitHub's comparison of main … studio-drafts
                                   │
 owner presses Publish ──► one merge of studio-drafts into main ──► Netlify builds once ──► live in 1–2 minutes
                                   │
                    studio-drafts moves up to the published commit, ready for the next edits
```

- **Every save is a draft.** Visitors see nothing until Publish. Studio's preview always shows the drafts, rendered
  by the same templates as the live site, so what he sees is what will go live.
- **Undo** (top bar, or Ctrl+Z) puts back the text from before his last change. **Undo** next to an item in "What's
  changed" puts that page, coin, post or photo back to the live version; **Undo everything** resets all drafts.
- **Publish** merges all drafts in one commit, so a day of edits costs one Netlify build. If someone changed the same
  file on `main` in the meantime and GitHub cannot merge, Studio says so and nothing goes live; a web person merges
  the branches by hand.
- **Photos** are made web-ready in the browser before upload (turned upright, longest side at most 2400 px, or
  1600 px for coins, saved as WebP; JPEG where a browser cannot write WebP). The server accepts only real JPEG, PNG or
  WebP files up to 6 MB and saves them in `public/images/<home|notable|blog|gallery|pages>/` through the same commit
  path. A photo still used somewhere cannot be deleted.
- Studio can only write content files (`content/…`) and photos (`public/images/…`): never code, settings or
  anything else in the repository, whatever a request asks for.

## Sign-in and security

- **Email + password**: the password is checked against the bcrypt hash in `STUDIO_PASSWORD_HASH` (the same work
  for a wrong email as for a wrong password, so neither is revealed). On success Studio sets a session cookie:
  signed with `STUDIO_SESSION_SECRET` (HMAC-SHA256), `HttpOnly`, `Secure`, `SameSite=Lax`, `__Host-` prefixed, valid
  7 days. It stops working when the password or the secret changes. Signing out deletes the cookie in that browser;
  to sign out every device, change `STUDIO_SESSION_SECRET` and redeploy.
- **Limits**: at most 10 sign-in attempts per 15 minutes from one address; 5 wrong passwords in a row lock that
  address for 15 minutes; 30 wrong passwords within an hour from anywhere lock the account for 15 minutes (a slow,
  spread-out attack). Counters live in Netlify Blobs (store `studio-auth`), with addresses stored only as keyed hashes.
- **Every Studio route needs a session** (`src/middleware.ts`): `/admin…` redirects to the sign-in page, `/api/studio…`
  answers 401. Requests that change anything must come from Studio's own pages (same origin, JSON or a photo upload);
  together with the SameSite cookie this blocks cross-site requests. Studio pages are never cached, never indexed and
  can only be framed by Studio itself.
- **Secrets stay on the server**: the GitHub App key, the installation token (kept in memory, renewed every hour) and
  the session secret are never sent to the browser or written to logs; error messages from GitHub are replaced by
  plain ones before they reach the browser.
- The public site has **no write routes**: Keystatic (the old editor) is now only part of local development
  (`npm run dev` → `/keystatic`), not of the production build.

### Why email + password, and the alternative

| | Email + password (chosen) | GitHub sign-in (alternative) |
|---|---|---|
| What the owner needs | An email and a password he chooses | A GitHub account, and to understand GitHub's sign-in and two-factor prompts |
| Day-to-day | Type email and password; stays signed in for a week | Bounce to github.com and back; GitHub's own screens |
| Who can sign in | Exactly one person, set in Netlify | Anyone with write access to the repository |
| Moving parts | One hash and one secret in Netlify | An OAuth app (client ID, client secret, callback URL), token storage and refresh |
| Password reset | Web person runs `npm run studio:hash` | GitHub's own reset |

He is not technical and the owner asked for an editor he can "actually use", so Studio uses its own simple sign-in and
keeps GitHub out of his way entirely: GitHub is only the storage, reached by the App on the server. GitHub sign-in
would make sense if several people with their own GitHub accounts were to edit; it could be added later by turning
the GitHub App's "Request user authorization (OAuth)" on and checking that the signed-in user may write to the
repository, without changing how saving and publishing work.

## Checks after setup

- `/admin` asks to sign in; a wrong password says so; the right one opens the dashboard.
- Change a word in **Edit my website**: the Publish button shows 1 change; the live site is unchanged; the drafts
  branch has a new commit; Netlify shows no new build.
- **Publish**: one merge commit on `main`, one Netlify build, the change is live in a minute or two.
- `https://<domain>/api/studio/changes` in a private window answers 401.
