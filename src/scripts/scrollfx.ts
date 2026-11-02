/**
 * Scroll-linked values for CSS, written once per animation frame and only while the page scrolls:
 *  - html  --scroll : the page's scroll offset in px (drives the foil sheen).
 *  - [data-progress="pin"]  --p : 0..1 progress through a tall section whose child is position: sticky.
 * Only two sections on the whole site use it, both on the home page: the short hero hold and the film scrub.
 * Elements report their progress to listeners via a 'scrollprogress' event (used by the film scrubber).
 * Layout is measured on load and resize only, never during scroll.
 */
type Track = { el: HTMLElement; top: number; height: number; last: number };

const root = document.documentElement;
const tracks: Track[] = [...document.querySelectorAll<HTMLElement>('[data-progress]')].map((el) => ({
  el,
  top: 0,
  height: 0,
  last: -1,
}));

let vh = innerHeight;
function measure() {
  vh = innerHeight;
  for (const t of tracks) {
    const r = t.el.getBoundingClientRect();
    t.top = r.top + scrollY;
    t.height = r.height;
  }
}

function frame() {
  queued = false;
  const y = scrollY;
  root.style.setProperty('--scroll', String(Math.round(y)));
  for (const t of tracks) {
    const run = Math.max(1, t.height - vh);
    const p = Math.min(1, Math.max(0, (y - t.top) / run));
    if (Math.abs(p - t.last) > 0.0005) {
      t.last = p;
      t.el.style.setProperty('--p', p.toFixed(4));
      t.el.dispatchEvent(new CustomEvent('scrollprogress', { detail: p }));
    }
  }
}

let queued = false;
function request() {
  if (!queued) {
    queued = true;
    requestAnimationFrame(frame);
  }
}

measure();
frame();
addEventListener('scroll', request, { passive: true });
let rt = 0;
addEventListener('resize', () => {
  clearTimeout(rt);
  rt = window.setTimeout(() => {
    measure();
    request();
  }, 150);
});
// fonts and images can shift layout after first paint
addEventListener('load', () => {
  measure();
  request();
});
