# Connecting your Coda certificate table to the website

The website's **Verify a certificate** page reads your certificates straight from the table you already keep in
Coda. You keep entering certificates in Coda exactly as you do today; nothing on the website needs editing.
The website can only **read** the table: it can never change or delete anything.

> Coda is now also called **Superhuman Docs** (the company was renamed). Same product, same login. If a screen says
> "Superhuman Docs" instead of "Coda", that's expected.

There are four short parts. Parts 1–3 take about 10 minutes. You don't need to send us your password, ever.

> **Update 2026-11-20: Alex's docs are already mapped.** His certificates live in four docs (one per series) with
> one table per batch, and the website now reads that layout directly ("multi-doc mode", below). Parts 1 and 2 are
> done. What is left for Alex is Part 3 (a **read-only** token covering the four docs) and Part 4 (paste
> `CODA_API_TOKEN` and `CODA_DOCS` into Hostinger). The token he emailed has **full access to his whole Coda**: once
> the read-only one is in place, he deletes the emailed one (Account settings → API settings → Delete).

---

## Part 1: Find your doc link and table name

1. Sign in to Coda and open the doc that holds your certificates.
2. Click in your browser's address bar and copy the whole address. It looks like
   `https://coda.io/d/Certificates_dAbCdEfGhI/...`. That is your **doc link**. (The website reads the doc ID out of
   it by itself: it's the part after `_d`, here `AbCdEfGhI`.)
3. Look at the certificate table. Its **name** is the bold title just above the table (for example
   *Certificates*). Write it down exactly as shown, with the same capitals and spaces.
   - If the same table appears on several pages, that's fine: it's still one table with one name.

## Part 2: Write down your column names

1. In the certificate table, write down the **name of every column** exactly as shown in the header row (same
   capitals, spaces and symbols, e.g. `Cert #`).
2. Next to each, say what it holds. We need at least:
   - the **certificate number** (as printed on the label),
   - the **coin** (a description, or the columns that together describe it: year, denomination, variety…),
   - the **grade**.
   Nice to have: year, country/denomination, strike score, surface score, notes, date graded, and the
   **obverse/reverse photos**.
3. **Photos**: tell us whether the coin photos are in the table, and how:
   - pictures uploaded into a cell (an *Image* column), or
   - a link to a photo stored somewhere else (a *Link* / text column), and
   - one column per side (obverse, reverse) or both photos in one cell.

## Part 3: Create a read-only API token for that one doc

A token is a long password-like code that lets the website read your table. You create it; it only works for this
doc and only for reading. Coda shows it **once**, so do Part 4 straight after.

1. In Coda, click your **profile picture** (top right) → **Account settings**.
   (Or go to `https://coda.io/account`.)
2. Scroll down to **API settings** and click **Generate API token**.
3. Name it `Website certificate lookup`.
4. Click **Add a restriction** (the wording may be slightly different) and set:
   - **Type of access: Read only** (not "Write" and not "Read and write"),
   - **Applies to: your certificate doc** (pick the doc from Part 1).
   Then click **Generate API token**.
5. Click **Copy token**. Keep the page open until you've finished Part 4.

> **Never send the token by email, text or chat** — not even to us. It goes only into Hostinger (Part 4). If it was
> ever sent anywhere by mistake, delete it in the same API settings section and create a new one.

Notes:
- Coda's docs say a token can be restricted to one **doc** or one **table**, and to **read** access. Restricting to
  the doc (as above) is what we've tested for. If you restrict it to the table instead, also send us the table's ID
  (see "Table ID" below).
- The token acts as **you**: if you later lose access to the doc, the website stops finding certificates.
  Create the token from the account that owns the doc.

## Part 4: Paste the settings into Hostinger (you, or us with you on a screen-share)

1. Sign in to **hpanel.hostinger.com** → **Websites** → **Dashboard** next to the website → **Environment
   variables** in the left menu.
2. Click **Add** for each of these, one at a time (values are stored encrypted and hidden).

   | Key | Value |
   |---|---|
   | `CODA_API_TOKEN` | the token you copied in Part 3 (secret) |
   | `CODA_DOC_ID` | your doc link from Part 1 (the whole link is fine) |
   | `CODA_TABLE_ID` | the table name from Part 1, e.g. `Certificates` |
   | `CODA_COLUMN_MAP` | we send you this line once we've seen your column names (Part 2) |

3. Click **Save**. Hostinger redeploys the website with the new settings; wait a few minutes.
4. Test: on the website's Verify page, type one real certificate number (it should show the card) and one made-up
   number (it should say "not found"). Open the same real result in a **private/incognito window** and check the
   coin photos show.

That's it. New certificates show up on the site within about 5 minutes of being entered in Coda; a correction
shows within the hour.

---

## What to send us (by email is fine — this list has nothing secret)

1. The **doc link** (Part 1). Sharing the link doesn't give anyone access: your doc stays private.
2. The **table name** (Part 1).
3. The **column names** and what each holds (Part 2), or a screenshot of the table's header row.
4. **Photos**: are they in the table, as uploaded pictures or links, one column per side or both in one?
5. Anything else about how you use the table: hidden/void/test rows, numbers with letters (e.g. `PNA-1001`),
   whether a number could ever appear twice.

**Do not send the token.** It goes only into Hostinger.

---

## For the developers

**Code**: `src/lib/certs/providers/coda.ts` (only Coda-specific file), wired in `src/lib/certs/adapter.ts` and
`src/lib/certs/server.ts`. Tests: `tests/coda.test.ts`, `tests/verify.test.ts`.

**Choosing the provider**: if any `CODA_*` variable is set the site uses Coda; a missing token/doc/table or a bad
`CODA_COLUMN_MAP` then shows an error on lookups (never DEMO data) and the server log (hPanel → Runtime Logs) says what to fix. With
none set, the DEMO records (`DEMO-0001..0003`) are served. The old generic JSON provider
(`providers/registry-api.ts`, `CERT_API_URL` / `CERT_API_KEY`) was removed; it is in Git history.

### Multi-doc mode (Alex's real layout; `src/lib/certs/providers/coda-multi.ts`)

Used whenever `CODA_DOCS` is set (it wins over `CODA_DOC_ID` / `CODA_TABLE_ID`).

- **Number**: `A400107-133` = prefix letter + six-digit batch + line. Spaces, lower case and a missing dash are
  tolerated (`a400107133` works). Lines are tried as typed, then zero-padded to 3 (US/World store `-001`), so
  `U102703-1` finds `U102703-001`; the cache key uses one spelling (`canonicalNumber`).
- **Doc**: `CODA_DOCS` (not secret) maps the prefix to the doc:
  `{"A":"2R77RysYRn","U":"iT3-jw54Xq","W":"-igypeHBY8","M":"6OBUDSaNMR"}` (Roman, US coins, World coins, World
  medals). Other prefixes are "not found".
- **Table**: the table named exactly like the batch (`A400107`). Each doc's table list (names and ids only) is
  cached for an hour in the site's database; an unknown batch refreshes it at most every 5 minutes, so a new batch
  shows up within minutes. Only names like `A400107` count: templates, "Copy of …" tables, lookups (GRADE, DATE…)
  and planning tables are ignored.
- **Row**: `query="Invoice Num1":"A400107-133"`. Rows with no grade, or no title/denomination/emperor (blank
  placeholders), are "not found".
- **Card**: Roman → coin "EMPEROR, DENOMINATION", year DATE, country/denomination "TITLE, METAL DENOMINATION", grade,
  strike ST/5, surface SR/5, notes from LINE4 (reverse), LINE5 (mint), RIC/Craw/RPC, weight, diameter, COM1/COM2,
  STYLE. US/World/Medals → coin "TITLE DATE MINT MARK DENOMINATION", strike STRIKE, notes from Top Line, LINE4-6,
  Attribution, 2nd Attr, metal, weight, COM1/COM2, STYLE.
- **Privacy (strict)**: Coda's API returns every column, so each row is cut down to a whitelist
  (`PUBLIC_COLUMNS`) the moment it is parsed. **Pur Price, + 20%, Sell Price, Notes, Link, 2nd Link, Web Link,
  Image URL links to other sites, Created on** and any column not on the list are never mapped, cached, logged or
  returned. `tests/coda-multi.test.ts` fills every private column with a marker and fails if it appears anywhere.
- **Photos**: only the `Image` column (pictures uploaded into Coda, on codahosted.io) and `Image URL` when it is a
  codahosted.io link. In Alex's data (checked 2026-11-20) no row has an uploaded image yet; `Image URL` holds auction
  pages (acsearch.info, CNG), which is why other hosts are never used. Whether codahosted.io links are public and
  lasting is still to check once he uploads one (open it in a private window); if not, add a server-side photo proxy.
- **Population report**: not available in this mode (it would mean reading 200+ tables); leave the switch off.

**Variables** (Hostinger → Environment variables; see `.env.example`):

- `CODA_DOCS` (not secret, multi-doc mode) and `CODA_API_TOKEN` (secret).

- `CODA_API_TOKEN` (secret), `CODA_DOC_ID` (id or browser link), `CODA_TABLE_ID` (name or `grid-…` id).
- `CODA_COLUMN_MAP` (optional JSON): our field → his column name. Fields: `certNumber`, `coinDescription`, `year`,
  `countryDenomination`, `grade`, `strikeScore`, `surfaceScore`, `notes`, `obverseUrl`, `reverseUrl`,
  `dateGraded`. Missing fields use the defaults (`Cert #`, `Coin`, `Year`, `Country/Denomination`, `Grade`,
  `Strike`, `Surface`, `Notes`, `Obverse`, `Reverse`, `Date Graded`); `null` drops one. A list joins several columns
  (`"coinDescription":["Year","Denomination","Variety"]`). Both photos in one column: give `obverseUrl` and
  `reverseUrl` the same column (1st image = obverse, 2nd = reverse). Example:
  `{"certNumber":"Cert #","coinDescription":["Year","Coin"],"grade":"Grade","obverseUrl":"Photos","reverseUrl":"Photos"}`
- `CODA_API_BASE` (optional): `https://coda.io/apis/v1` (default, as in Coda's docs page) or
  `https://docs.superhuman.com/apis/v1` (the address in Coda's current OpenAPI file). Any other host is refused, so
  the token can't be sent elsewhere.

**How a lookup works**: `GET {base}/docs/{doc}/tables/{table}/rows?query="Cert #":"PNA-1001"&useColumnNames=true&valueFormat=simpleWithArrays&limit=10`
with `Authorization: Bearer …`. Coda's `query` is an exact match on the stored value; for an all-digit number we also
try the bare JSON number (a Number column only matches that). Rows are then checked with our own
`normalizeCertNumber`. Several rows with the same number → the most recently updated one is shown and a warning is
logged. **Certificate numbers should be stored in capitals exactly as printed** (the query is exact; `pna-1001` in
Coda won't match a visitor typing `PNA-1001`).

**Errors**: 401/403 → "auth"; 404 means the *doc or table* wasn't found (setup error, not "no such certificate");
400 usually means a wrong column name in `CODA_COLUMN_MAP`; 429 → wait for `Retry-After` (or 1 s, 2 s…) up to ~3 s
for a visitor's lookup, else "busy" (503 to the visitor); 5xx → one retry, then 502. Visitors only ever see the
generic message; logs carry status codes and hints, never the token or Coda's reply.

**Population report**: `listAll()` pages through every row (`limit=500`, then `pageToken` only, as Coda requires;
stops after 200 pages), skipping rows without number/coin/grade. `loadPopulation` caches the report for 1 hour in
the site's MySQL database (`cert-verify` namespace, `src/lib/kv.ts`), and simultaneous visitors on a cold cache share
one scan per running server.

**What Coda's API docs say (checked 2026-11-02)**:
- Auth: Bearer token from Account settings → API settings. Tokens can be restricted to a **doc** or a **table** and to
  **read** (GET only), write, or read+write. `/whoami` and `/resolveBrowserLink` work with any token.
- Rate limits: reading 100 requests / 6 s per user (across all docs); 429 when exceeded; limits may change.
- Freshness: reads come from the doc's latest API "snapshot", which can lag edits by a few seconds
  (`X-Coda-Doc-Version: latest` would return 400 instead of stale data; we don't use it).
- Pagination: follow `nextPageToken`; the max page size is Coda's choice and may change.
- Images: with `simple`/`simpleWithArrays` an image cell is its URL (uploaded images live on `codahosted.io`); with
  `rich` it's an `ImageObject` with `url` and `status` (`live`/`deleted`/`failed`). Both are handled. **Coda does not
  document whether `codahosted.io` links are public or permanent.** Community posts suggest they are unguessable links that
  open without signing in, but that isn't promised and we couldn't test it without a real doc: check photos in a private window after setup (Part 4, step 4). If
  they don't show, the fallback is to keep photos on a public host (or the website's `public/images/`) and put the
  links in a text/Link column.

**Table ID**: only needed if the token is restricted to a table, or to survive a table rename. In Coda: Account
settings → **Labs** → turn on **Developer mode**; then the table's **⋮** menu shows **Copy table ID** (`grid-…`).
