/**
 * Small site-wide behaviour: the header settles onto a solid background on scroll, the phone menu, and choreographed
 * reveals as content scrolls into view. Owner's rule: animations always play (no reduced-motion opt-out).
 * The coin engine loads only on pages that draw coins.
 */
document.documentElement.classList.add('js');
import './shine';

const header = document.querySelector<HTMLElement>('.site-header');
if (header) {
  let ticking = false;
  const update = () => {
    ticking = false;
    header.classList.toggle('scrolled', window.scrollY > 40);
  };
  addEventListener(
    'scroll',
    () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(update);
      }
    },
    { passive: true },
  );
  update();

  const toggle = header.querySelector<HTMLButtonElement>('.menu-toggle');
  const setOpen = (open: boolean) => {
    // the menu opens below the bar (and the preview banner, when it shows)
    header.style.setProperty('--nav-top', header.getBoundingClientRect().bottom + 'px');
    header.classList.toggle('open', open);
    document.body.classList.toggle('menu-open', open);
    toggle?.setAttribute('aria-expanded', String(open));
  };
  toggle?.addEventListener('click', () => setOpen(!header.classList.contains('open')));
  addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && header.classList.contains('open')) {
      setOpen(false);
      toggle?.focus();
    }
  });
}

// Reveal once, quickly, as soon as an element starts entering view. Elements with .rv rise and fade; .rake sections
// get a flick of light across the title; .draw engraves its symbols; .assemble (the exploded holder) puts itself
// together. Time-based (all under a second), never tied to scroll position. Anything already scrolled past (a jump
// to an anchor, a restored scroll position) is revealed at once, so no content stays invisible.
const reveal = document.querySelectorAll('.rv, .rake, .draw, .assemble');
if ('IntersectionObserver' in window) {
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (e.isIntersecting || e.boundingClientRect.bottom < 0) {
          // a swipeable row (notable coins on a phone) reveals all its cards together, so a card that was off to
          // the side is already in place when it is swiped in, instead of rising while it slides
          const row = e.target.closest('.notable-grid');
          const swipe = row && row.scrollWidth > row.clientWidth + 1;
          const group = swipe ? row.querySelectorAll('.rv') : [e.target];
          for (const el of group) {
            el.classList.add('in');
            io.unobserve(el);
          }
        }
      }
    },
    { rootMargin: '0px 0px -6% 0px' },
  );
  reveal.forEach((el) => io.observe(el));
} else {
  reveal.forEach((el) => el.classList.add('in'));
}

// Swipeable notable coins (phones): the next card peeks in under a soft fade at the right edge; once the row is
// swiped to its end, or does not scroll at all, the fade lifts (.at-end, mobile.css). Driven by the row's own
// sideways scroll, never by the page scroll.
for (const row of document.querySelectorAll<HTMLElement>('.notable-grid')) {
  let queued = false;
  const check = () => {
    queued = false;
    row.classList.toggle('at-end', row.scrollLeft + row.clientWidth >= row.scrollWidth - 8);
  };
  const queue = () => {
    if (!queued) {
      queued = true;
      requestAnimationFrame(check);
    }
  };
  row.addEventListener('scroll', queue, { passive: true });
  addEventListener('resize', queue, { passive: true });
  check();
}
