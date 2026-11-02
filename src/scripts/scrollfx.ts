/**
 * Scroll-linked values for CSS, written once per animation frame and only while the page scrolls:
 *  - html  --scroll : the page's scroll offset in px (drives the foil sheen).
 *  - [data-progress="pin"]  --p : 0..1 progress through a tall section whose child is position: sticky.
 *  - [data-progress="view"] --p : 0..1 from the element's top entering at the bottom to its middle reaching mid-screen.
 * Elements report their progress to listeners via a 'scrollprogress' event (used by the film scrubber).
 * Layout is measured on load and resize only, never during scroll.
 */
type Track = { el: HTMLElement; mode: 'pin' | 'view'; top: number; height: number; last: number };

const root = document.documentElement;
const tracks: Track[] = [...document.querySelectorAll<HTMLElement>('[data-progress]')].map((el) => ({
  el,
  mode: el.dataset.progress === 'view' ? 'view' : 'pin',
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
    let p: number;
    if (t.mode === 'pin') {
      const run = Math.max(1, t.height - vh);
      p = (y - t.top) / run;
    } else {
      const start = t.top - vh; // element's top at the bottom edge of the screen
      p = (y - start) / (vh * 0.5 + t.height * 0.5); // 1 when the element's middle reaches the middle of the screen
    }
    p = Math.min(1, Math.max(0, p));
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
