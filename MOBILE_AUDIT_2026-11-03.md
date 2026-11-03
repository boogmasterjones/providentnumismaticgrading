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
