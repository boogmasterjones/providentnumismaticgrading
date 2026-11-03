# Mobile audit and makeover, pass 1 (2026-11-03)

Branch `mobile/2026-11-03` (from `main` at `eb08057`). Owner's brief: everything should look and feel right on a
phone: formatting, text sizes, good use of the limited space, nothing squished, and space saved wherever possible.

Checked at 390×844, 360×780, 430×932 and 768×1024 (full-page screenshots, every page). The checks also measured page
width against the screen, text under 16px and controls under 44px.

## How it is built

- All phone and tablet rules are in **`src/styles/mobile.css`**, loaded last by `src/layouts/Base.astro`. Every rule
  sits in a max-width media query. Most stop at 720px, a few tablet rules go up to 900px or 960px, and the menu rules
  go up to 1120px, the width where the phone menu already starts. Each selector starts with `html`, so the rules win
  whatever order the stylesheets are bundled in.
- One piece of markup is new, and it shows only in the phone menu: `.nav-foot` in `Base.astro`. It is hidden on
  desktop. Its links come from `MENU_MORE` in `src/lib/nav.ts`, and the phone number and location come from Site
  settings.
- One script line changed: on screens under 600px wide, the medallion in the opening (`Intro.astro`) is drawn at 60% of
  the shorter side of the screen instead of 54%: 234px instead of 210px on a 390px phone. It is still the same
  edge-free 2D turn.
- No content was hard-coded. Everything still comes from Keystatic.

**Desktop did not change.** I recorded the position, size and about 20 computed styles of every element on all 14
pages at 1440×900, before and after. With hidden elements set aside, the only differences come from animations
caught at different moments: the turning rosettes, the foil seal angle and the carousel progress line. Screenshots at
1440 before and after were taken too, but they were checked through the element comparison, not side by side.

## Page heights at 390 (shorter = less scrolling)

| Page | Before | After |
|---|---|---|
| Home | 9,665 | 7,439 |
| Process | 7,465 | 5,906 |
| Grading standards | 6,834 | 5,631 |
| Holder | 5,422 | 4,324 |
| Verify (DEMO-0001) | 3,843 | 3,129 |
| Why Provident | 4,428 | 3,386 |
| About | 5,613 | 4,442 |
| Submissions | 6,309 | 5,408 |
| FAQ | 2,959 | 2,339 |
| Contact | 3,109 | 2,570 |

No page scrolls sideways at any of the four widths, before or after.

## Per page: issues found → changes

Scores are out of 10, before → after (at 390).

### Site-wide (header, menu, type, rhythm, footer)
- **Rhythm.** Phones used desktop-scale gaps (80px section padding, 72px heads), so a lot of the screen was empty
  space. → Tighter spacing values on phones (`--space-6` 52px, `--space-7` 68px, `--space-8` 84px), and smaller
  dividers and title rules.
- **Type.** Footer text was 14.7px, the "what we grade" and nine-steps summaries 15.7px, and form hints 13.6px. →
  Text meant to be read is now 16px or more. Form labels went from 10.9px to 11.5px, and certificate labels are
  larger. Headings use a phone scale (h1 about 44px, h2 about 34px). The letter-spacing of the inscription capitals
  went from 0.26em to 0.2em (0.16em under 380px), with a shorter ornament before them.
- **Menu.** It was a good list, but the bottom half of the screen was empty. Why Provident, Questions and Journal
  could only be reached from the footer, and the open menu didn't show which page you were on. → The items now come
  in with a short stagger and the current page is in gold. A quiet foot was added: Why Provident · Questions ·
  Journal, then the location and a phone link you can tap.
- **Footer.** It was one long column of 13 rows, about 900px. → Grading and The Company now sit side by side, with
  Contact underneath. Every link is 44px tall, the copyright line is on one line, and the legal links can be tapped.
  Score 5 → 8.

### Home: 6 → 8.5
- **Opening (`?intro`):** the medallion is a little larger on phones (234px), and the flip never shows an edge.
- **Hero:** the copy sits slightly higher, and the opening line wraps into two balanced lines.
- **Carousel:** the dots were 24×24 → now 30×44, and the arrows 44px.
- **Notable coins:** three cards stacked one under another took about 1,300px. → They are now a swipeable row: each
  card is 80% of the screen wide (at most 320px) and the next one peeks in. They snap into place and show no
  scrollbar. At 768 there are three cards in one row; before, there were two plus one left over on its own.
- **Footage panels:** they were 78% of the screen tall → now 68%, at least 400px. The frame corners are finer (30px).
- **What we grade:** the circular symbols went from 64px to 52px, with tighter rows and 16px text.
- **Nine steps:** each row went from about 110px to about 75px. At 721–900px wide they sit in two columns.
- **Holder:** the eyebrow label was picking up the paragraph's 17px size, so it wrapped as "THE · HOLDER · AND · /
  LABEL" (a bug that started with the Roman accents) → fixed on phones and tablets. The drawing is smaller (a 380px
  scene, shown at 72%).
- **Verify panel:** the seal now sits beside the label instead of above it, the field gets the full width, and there
  is room for the microtext line at the foot.

### Process: 5.5 → 8.5
- The step index under the title was five ragged lines of small links 26px tall → now one swipeable row of framed
  chips, 44px tall, fading out at the edge.
- Each step stacked numeral, symbol, title and summary down the screen, about 85px per step before the text even
  began → the symbol (52px) with its numeral beneath it now sits beside the title and summary. Over nine steps that
  saves about 1,500px.

### Grading standards: 6.5 → 8.5
- Each feature block put its symbol on a line of its own, above the title → symbol (34px) and title now share one line.
- In the scale rows the text is now 16px. The 1–70 rule and its numbers were already easy to read.

### Holder: 6 → 8
- Feature blocks are compact the same way. The drawing is smaller, with less empty space around it.

### Verify (DEMO-0001): 5.5 → 8.5
- The panel's corner ornaments touched the "Certificate number" label, and the microtext ran over the hint → finer
  corners (24px) and more padding.
- The certificate details were a long stack of label, then value, about 80px each → now a two-column ledger, label on
  the left and value on the right, with dotted lines between rows.

### Submissions: 6 → 8
- Steps are compact (see Process). The fees panel has finer corners and the microtext no longer overlaps.
- In the form, the frame is slimmer so the fields get more width (302 → 313px), the gaps are 24px, labels and hints
  are larger, and the Send button is full width.

### FAQ: 7.5 → 8.5
- Each question takes less height (20px above and below instead of 26px).

### Contact: 7.5 → 8.5
- Tighter "ways to reach us" rows. The form gets the same changes as on Submissions.

### Why Provident, About: 6 → 8.5
- Feature blocks are compact, with the symbol on the title line.

### Journal, Privacy, Terms, Thank you, 404: 7 → 8
- The page head and footer rhythm changes apply. On article pages, the title has its own phone size.
  - **Note:** the worktree has no journal posts, because the demo post is untracked on `main` and I left it alone.
    So the post list and the article page were not viewed with a real post.

## Checks

- `npm run build`, `npm test` (62 tests) and `npx astro check` (0 errors) all pass.
- No horizontal scroll at 360, 390, 430 or 768 on any page.
- Owner rules kept:
  - nothing pins; only the header is sticky;
  - the coin flip shows no edge;
  - no loupe or gimmicks;
  - no animation was removed (the menu gained a stagger);
  - no new images;
  - nothing names the owner.

## Left for pass 2 to double-check

1. **A real device.** Check iOS Safari's URL bar against the `svh` heights (hero and footage panels), notches and safe
   areas (the menu foot uses `env(safe-area-inset-bottom)`), and whether swiping the notable coins conflicts with
   swiping back.
2. **Notable coins with real entries:** check that the reverse inset (`.coin-rev`) still sits right on the narrower
   cards. Only placeholders could be checked. Cards that are scrolled out of view reveal as they are swiped in; check
   that this feels right.
3. **Carousel with real photos:** check the 4:3 crop on phones and how long captions wrap.
4. **Journal:** the list and an article with the demo post on a phone: images, blockquote and the laurel divider at
   the end.
5. **Footage panels on a phone:** the caption over the lower gradient, and how bright the 640-wide clips look once
   playing. Headless Chrome only showed the dim first frame.
6. **The process index chips:** consider marking the current step while scrolling. That would need a scroll observer,
   so check it against the owner's "nothing follows the scroll" rule first, or leave it.
7. **Desktop-only bug, deliberately not fixed** (desktop had to stay the same): on the home holder section, the
   eyebrow label "The holder and label" shows at 17px on desktop too, because the `.holder-copy p` font size reaches
   it. Ask whether to fix it on desktop as well.
8. **Tablets 900–1120px** (small laptops, iPad landscape) were only checked through the menu. Look at the features
   grid and notable cards there.
9. **Performance on a phone:** the coin river (8 coins on phones), the turning rosettes and the film grain overlay
   should be run through PageSpeed mobile on a deploy preview, if the owner ever allows one.

---

# Pass 2 (2026-11-03): a second look, with real-looking content

Checked at 360×780, 390×844, 430×932, 768×1024, 900, 1024 and 1120 wide, plus the opening (`?intro`, at 360×640).
For the first time the checks ran **with content**: three notable coins (two with a reverse photo, one with a very
long single-word name, one with a long grade and a long certificate number), three carousel photos (wide, 3:2 and
portrait, one long caption) and a journal post with a cover, two images, a quote, lists, a 45-letter word and a long
web address. The pictures were plain gradients with a simply drawn coin, made locally (no stock, no AI). **All of it
was removed before the commit**: `content/` and `public/images/` are as they were.

## What pass 1 had missed, and the fixes

1. **The reverse inset on notable coins was broken everywhere, desktop too.** The shine layer's `.proof` rule
   (`position: relative`) overrode `.coin-rev { position: absolute }`, and on phones the disc's width rule made it
   64% wide. A coin with a reverse photo showed a second, large coin dropped into the card under the first, shifted
   left over the text. → The reverse now sits inside the bead ring (`Notable.astro`), against the obverse's lower
   right (36% of the coin, overlapping it slightly), with a selector no other rule can override (`home.css`). On
   desktop this changes **only coins that have a reverse photo**. There are none yet, so the desktop comparison below
   is unaffected. It restores what the README describes ("reverse as a small inset").
2. **The home "The holder and label" label** (pass 1's item 7, fixed on desktop as asked): it took the paragraph's
   17px size **and its ivory colour**, so it matched the other gold labels in neither size nor colour. → It is now
   11.5px and gold on every screen (`home.css`). This is the one intended desktop change.
3. **The microtext still ran under the corner ornaments** on the Verify panel, the home verify panel and the fees
   panel. Pass 1 said this was fixed, but at 2× zoom the letters still passed under both bottom corners and stopped
   mid-letter at the right. → On phones the line now runs between the corners and fades out at both ends.
4. **Footer tap targets were not 44px.** A more specific hover-underline rule in `detail.css` kept a 2px bottom
   padding, so the footer links measured 41px and the Privacy and Terms links 33px. → All are now 44px. The phone
   number in the menu foot went from 42px to 44px.
5. **Long words and web addresses ran off the edge.** They were clipped in the journal and on coin cards; for example,
   an ancient coin's attribution or a pasted link. → Headings, paragraphs, list items and captions now break a word
   only when it cannot fit (`global.css`). Ordinary text lays out exactly as before, and the desktop comparison
   confirms it.
6. **A doubled rule under the page head** on Process, Submissions and the Journal list. The title's base rule and the
   first item's own rule, each with a lozenge, sat 40px apart on phones, and about 115px apart on tablets with an
   empty band between. → The first item drops its rule and lozenge and starts right under the head.
7. **Notable coins revealed one by one while being swiped.** The cards off to the side were still invisible and rose
   into place while sliding in. → When a swipeable row comes into view, all its cards reveal together (`site.ts`).
   This applies only when the row really scrolls sideways, so desktop is unchanged.
8. **Swipe-row ends.** The space after the last notable card and the last step chip came from end padding and a
   margin on the last item, which older iOS Safari leaves out of the scroll width, so the last card would end flush
   with the screen. → A spacer element now holds that space. The step index also stops a sideways swipe at its ends
   from turning into "go back"; the notable row already did.
9. **The certificate number on a coin card** broke at a dash ("TMP-2026- / 000123"). → The number now moves to its
   own line whole (up to 1120px).
10. **Carousel:** the next slide's caption showed as stray letters in the sliver of that slide that peeks in. →
    Captions are inset from the slide edges (up to 1120px).
11. **Long grades** ("Ch XF, Strike 5/5, Surface 4/5") wrapped with the lines touching. → The lines are balanced and
    have a little more line spacing (up to 1120px).
12. **Certificate ledger at 360:** "DENOMINATION" broke mid-word ("DENOMINATIO / N"). → Under 380px the label column
    is slightly wider and the letter spacing tighter.
13. **Holder page on phones:** the drawing had about 50px of empty stage above and below, while its caption sat 30px
    from the next label. → The stage is shorter (330px), and there is more space after the caption.
14. **Journal on phones:** quotes had 40px of padding on each side of a 350px column. → The padding is now 24px, with
    slightly smaller italic. Image mats are now 6px, and there is less space above the article title.
15. **Tablet portrait (721–900px):** process and submission steps put the numeral and symbol on a line of their own,
    then the title, then the summary, so the text began about 190px down. → They now use the phone layout, slightly
    larger, with a 60px symbol beside the title. The page body also starts a little sooner.
16. **iPads and touch laptops (up to 1120px, touch input):** arrow links were 36px tall, carousel dots 24px, step-index
    links 26px and the legal links 17px. → All are now 44px.
17. **Small laptops and iPad landscape (961–1120px):** feature blocks were three columns about 270px wide, with 35
    characters a line and nine-line paragraphs. → They are now two columns.

## Checked and fine

- **iOS address bar:** every full-height section uses `svh` (hero 100svh, footage 68svh on phones), which does not
  change when the bar hides, so nothing jumps. The coin river takes its size from the hero (svh) and rebuilds only
  when the size changes by more than 80px. `vh` is used only for minimum and maximum heights (main, the 404 page, the
  carousel's maximum height), which also stay fixed on iOS. Nothing uses `dvh`. The site does not use
  `viewport-fit=cover`, so Safari keeps content clear of the notch on its own. The menu foot's
  `env(safe-area-inset-bottom)` is 0 for now and does no harm.
- **Swipe rows:** the notable coins snap one card at a time (mandatory, aligned to the start), and the last card stops
  20px from the edge at 360, 390 and 430. The step index snaps loosely (proximity) and fades out at the right. Neither
  row takes over vertical scrolling. The carousel uses native swipe with centre snap.
- **Opening** at 360×640: the medallion fits with room to spare, never shows an edge, and opens onto the hero cleanly.
- **Forms:** the corner ornaments clear the first label and the "Fields marked" note.
- **Width:** no page scrolls sideways at any width checked, with or without the test content.

## Desktop unchanged (1440)

The method is the same as pass 1: the position, size and about 20 computed styles of every element on 16 pages at
1440×900. I made two "before" recordings (to measure the animation noise) and one "after", all without the test
content. Only two kinds of difference showed up:
- the intended holder label (17.28px ivory → 11.52px gold; the copy block beside the drawing is 6px shorter and,
  being centred, moves up 3px);
- the usual animation noise: the turning rosettes, the foil seal angle and the carousel progress line.

## Checks

- `npm run build`, `npm test` (62 tests) and `npx astro check` (0 errors) all pass.
- Owner rules kept:
  - nothing pins; only the header is sticky;
  - the coin flip shows no edge;
  - no loupe or gimmicks;
  - no animation was removed;
  - no images were added;
  - nothing names the owner;
  - all content still comes from Keystatic.

## Left for pass 3

1. **A real iPhone and iPad** (still the main gap). Check the svh hero and footage while the address bar hides, the
   swipe-row end spacing on an older iOS, swipe-back from the screen edge over the notable row, and the touch rules
   for tablets on an iPad.
2. **Desktop, for the owner to decide** (left alone because desktop had to stay the same). A long grade wraps with its
   lines touching (line-height 1). The peeking next slide's caption can show as stray letters at the right edge. A
   long certificate number breaks at a dash. All three are fixed only up to 1120px.
3. **Microtext under the corners on desktop**, on the Verify, home verify and fees panels: the same overlap as on
   phones, fixed on phones only.
4. **Footage brightness** on a phone once the clips play, and PageSpeed mobile on a deploy preview if the owner allows
   one (pass 1's items 5 and 9).
5. **Ordered lists in journal posts** hang their numerals a little left of the bullet column. Minor; check it with a
   real post.

---

# Pass 3 (final, 2026-11-03): a fresh pair of eyes

Checked at 360×780, 390×844, 430×932, 768×1024, 1024×1366 (iPad Pro portrait), and at 900, 960 and 1120 wide. The
opening (`?intro`) was checked frame by frame. Every page was screenshotted one screen at a time and measured for:
- sideways scroll;
- text under 15px;
- controls under 40px;
- a lone word on the last line;
- elements running past the edge.

The checks ran with temporary content again:
- four notable coins: two with a reverse photo, one long grade, a 40-letter one-word name and long certificate
  numbers;
- three carousel photos: wide, 3:2 and portrait, one with a long caption;
- a journal post with a cover, two images, a quote, numbered and bulleted lists, a two-digit item, a very long word
  and a long web address.

The pictures were drawn locally on a canvas (no stock, no AI). **All of it was removed before the commit.**

## What passes 1 and 2 missed

1. **Closing bands had no side margin on phones** (Process, Standards, Holder, Why, About). Pass 1's
   `.coda { padding: … 0 }` also set the side padding of the full-width closing band to zero, so "We are glad to
   discuss a coin…" ran from one edge of the screen to the other. → The rule now changes only the top and bottom
   padding.
2. **A long grade still stacked into five lines** on every screen, desktop included ("CH XF, / STRIKE / 5/5, /
   SURFACE / 4/5"). The sprigs on either side leave the grade about 170px on a phone, so pass 2's balanced lines and
   extra line spacing could not help. → The grade itself ("CH XF") stays large between the sprigs. Whatever follows
   its first comma goes on a small gold line under it ("STRIKE 5/5 · SURFACE 4/5"). Screen readers still hear the
   whole grade. A long grade without a comma is set smaller (`splitGrade` in `src/lib/notable.ts`, tested).
3. **Tap targets still under 44px:**
   - the certificate link on a notable card was 15px tall (one line of small capitals);
   - every arrow link was 40px;
   - the phone number on Contact was 30px.

   → All are now 44px or more on phones and touch tablets.
4. **Notable cards:**
   - In the swipe row every card takes the tallest card's height, so on shorter cards the certificate line floated
     about 70px above the bottom. → The certificate line now sits at the bottom of every card.
   - The card peeking in from the right showed hard slivers of cut-off text ("Cons", "Stru"). → It now fades out at
     the right edge, and the fade lifts once the row is swiped to its end.
5. **Tablets with four notable coins** (768–1120) showed three cards and a lone fourth. → Cards are now laid out by
   how many there are, and every row is centred:
   - 1, 2 or 4 coins: two to a row, at most 340px each;
   - 3, 5 or 6 coins: three to a row.
6. **"What we grade" at 1001–1120** (iPad Pro portrait, iPad landscape) was still four 230px columns with nine-line
   paragraphs. Pass 2 fixed the feature grids but not this list. → Two by two, as below 1000px.
7. **Typography:** on phones a lone word often ended up on the last line ("complete.", "visible.", "magnification.",
   "number" in the carousel caption). Step titles broke as "Registry record and / verification". → Up to 1120px,
   paragraphs, list items and captions avoid a lone last word (`text-wrap: pretty`), and headings break into
   balanced lines (`balance`). Desktop keeps its own wrapping.
8. **The two notes on a certificate** ("This confirms…", "A match means…") were 14.4px. → 16px on phones.
9. **Footer on phones:** Contact sat in a full-width block under both link lists, while the column beside Grading
   stood empty. → From 381px up, Contact moves under Grading, beside the longer Company list. Every page is about
   55px shorter, and the two columns end close together.
   - At 360, Contact stays full width, because the opening hours would take three lines in a column.
   - The column gap is a little tighter there, so "About the company" stays on one line.
10. **The open menu on an iPad held upright** left three quarters of the screen empty. → On tall tablet screens the
    menu items grow with the screen height, up to 2.4rem. Landscape and short screens are unchanged.
11. **Home rhythm:** the gap after "What we grade" was 150px; the other gaps between sections are about 100–120px. →
    Now about 120px.

## Approved desktop bug fixes (now on every screen)

- **Long grades** wrapped with touching lines. → The grade split above (`home.css`, `Notable.astro`).
- **A stray caption letter** from the next carousel slide. → Captions are inset 28px from the slide edges
  (`home.css`). Before, this applied to phones and tablets only.
- **Certificate numbers broke at a dash.** → The number moves to its own line whole (`home.css`).
- **The microtext ran under the panel corners** (home verify panel, Verify page, fees panel). → It runs between the
  corners and fades out at both ends (`deco.css`).
- **Numbered lists in journal posts** sat left of the bulleted ones. → Both lists now start their text at the same
  edge, measured equal at 390 and 1440 (`global.css`).

**Desktop is otherwise unchanged.** The method is the same as in passes 1 and 2: the position, size and 22 computed
styles of every element on 15 pages at 1440×900. I compared a production build of pass 2 (`4d6b560`) with one of
this pass, both without the test content and with animations stopped. A second recording of pass 2 measured the
noise: only a random glint.

Pass 2 against pass 3 gave **6 differences, all of them the intended microtext lines** on the three panels (each set
in 40px on both sides and faded at the ends). Nothing else moved or changed style. The other four fixes only show
with content (a long grade, a certificate number that wraps, a carousel caption, a numbered list), so I checked them
by eye at 1440 with the test content.

## Lighthouse (mobile, local production build)

I ran `npm run build` and served the static pages locally with gzip. Lighthouse 12 mobile simulates a slow 4G
connection on a mid-range phone.

| Page | Performance | Accessibility | Best practices | SEO | LCP | CLS | TBT |
|---|---|---|---|---|---|---|---|
| Home | 84 | 100 | 100 | 69 | 3.6 s | 0.001 | 0 ms |
| Process | 88–89 | 100 | 100 | 66 | 3.0 s | 0 | 0 ms |
| Verify | 88–89 | 100 | 96 | 66 | 3.0 s | 0 | 0 ms |
| Journal post | 89 | 100 | 100 | 69 | 3.1 s | 0.033 | 0 ms |

- **SEO 66–69 is expected before launch.** Every page carries `noindex` until "launched" is switched on in Site
  settings. The only other SEO flag is "legible font sizes", raised by the decorative microtext (8px, hidden from
  screen readers).
- **What holds performance back:** the Google Fonts stylesheet blocks the first paint, about 0.9 s of the 2.9 s
  first paint. There are two ways to fix it:
  - self-host Cormorant Garamond and Inter, as Cinzel already is. This keeps the look but needs the font files
    downloaded, so I did not do it without asking;
  - load the stylesheet without blocking. That flashes the fallback fonts, so it changes the look while the page
    loads.
- **Done:**
  - The guilloché rosette, the largest thing on most first screens, is now preloaded (`Base.astro`).
  - The journal cover is fetched first.
  - Journal covers (in the post and in the list) now carry their width and height, read from the file at build time
    (`src/lib/imagesize.ts`, tested), so nothing jumps when they arrive.
- **Tried and dropped:** putting all the CSS inside each page made every score 2–5 points worse.
- **For later:** photos are served as uploaded, and very large phone photos (5–10 MB) would load slowly on a phone.
  Either ask for photos about 2,000px across, or resize them on upload. Netlify's image service could do the
  resizing, but it may use credits, so it needs the owner's go-ahead.

## Owner rules, checked again

- Only the header is sticky, and nothing pins. The new fade on the notable row follows the row's own sideways swipe,
  not the page scroll.
- The opening flip never shows an edge (frames checked at 390). No loupe and no gimmicks were added.
- Every animation still plays. The new layout rules animate nothing.
- No images were added, and the test pictures were removed.
- The client stays anonymous.
- All content still comes from Keystatic. The grade split only reads the grade field.

## Checks

- `npm run build`, `npm test` (70 tests, 8 of them new, for the grade split and the image-size reader) and
  `npx astro check` (0 errors) all pass.
- No page scrolls sideways at 360, 390, 430, 768, 900, 960, 1024 or 1120.

## Left open (owner's call)

- **Desktop with four or five notable coins** shows a lone card on the second row (three columns). On desktop this is
  a design choice, not a bug, so I left it alone. Tablets now lay out the cards by how many there are.
- Self-hosting the two Google fonts (see Lighthouse above).

## Real-phone checklist for the owner

Once there is a link to look at, check these on your iPhone:

1. **Opening:** open the home page with `?intro` at the end of the address. The medallion should flip twice with no
   edge showing and open onto the site in about two seconds. Any tap should skip it.
2. **Address bar:** scroll down the home page slowly. When Safari's address bar shrinks, the hero and the two footage
   panels should not jump or resize.
3. **Notable coins:** swipe the row of coins left and right. It should stop on each card, and the next card should
   fade in softly at the right edge. Swiping should never take you back a page by accident.
4. **Footage panels:** do the coin clips look bright enough while they play, and is the caption easy to read?
5. **Menu:** open it, then tap Questions or the phone number at the bottom. Is everything easy to hit with a thumb?
6. **Verify:** type `DEMO-0001`. Tapping the field should not zoom the page in, and the certificate should read as a
   neat two-column list.
7. **Submissions form:** fill in a few fields, but don't send it. The keyboard should not cover the field you are
   typing in, and the Send button should span the full width.
8. **Text:** read one whole page, About for example. Does anything feel too small, too big or too crowded?
