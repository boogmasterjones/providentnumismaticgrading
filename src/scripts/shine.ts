/**
 * Shine (styles in src/styles/shine.css): light catching polished metal.
 *  - Glints: one small four-point star flares on a gold element in view every few seconds (randomised), never more
 *    than one at a time. Targets: the monogram and its laurel, the footer seal, laurel sprigs, the hero title, gold
 *    rules and Deco corners, grade numbers, buttons
 *    and seals. Paused while the tab is hidden. On the home page the hero title gets a sweep and two glints on load.
 *  - Sweeps and proof flashes: .shine and .proof elements play once (.flick) on hover/focus and, with .shine-enter or
 *    .proof, once as they come into view. Nothing here follows the scroll position.
 * Layout is read only at the moment a glint is placed (one element, every few seconds).
 */
const TARGETS = [
  '.brand-mark',
  '.footer-seal .seal',
  '.sprig',
  '.divider-laurel > i',
  '.wm-top',
  '.deco-rule i:nth-child(2)',
  '.deco-frame > .c',
  '.coin-grade',
  '.btn',
  '.foil-seal',
  '.exl-seal',
  '.medallion',
  '.header-contact',
].join(',');

function glintAt(x: number, y: number, small = false) {
  const g = document.createElement('span');
  g.className = small ? 'glint small' : 'glint';
  g.setAttribute('aria-hidden', 'true');
  g.append(document.createElement('i'));
  const w = document.documentElement.clientWidth;
  g.style.left = `${Math.min(w - 20, Math.max(20, x))}px`;
  g.style.top = `${y}px`;
  document.body.append(g);
  g.addEventListener('animationend', () => g.remove(), { once: true });
}

/** A glint on a random point along the top edge or a corner of the element, where light would catch it. */
function glintOn(el: Element, small = false) {
  const r = el.getBoundingClientRect();
  if (r.width === 0 || r.bottom < 0 || r.top > innerHeight) return false;
  const fx = 0.15 + Math.random() * 0.7;
  const fy = 0.15 + Math.random() * 0.35;
  glintAt(r.left + r.width * fx + scrollX, r.top + r.height * fy + scrollY, small || r.height < 40);
  return true;
}

function randomGlint() {
  if (document.hidden) return;
  const all = [...document.querySelectorAll(TARGETS)];
  const vh = innerHeight;
  const seen = all.filter((el) => {
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.top > 0 && r.bottom < vh && getComputedStyle(el).visibility !== 'hidden';
  });
  if (seen.length) glintOn(seen[Math.floor(Math.random() * seen.length)]);
}

let timer = 0;
function schedule() {
  clearTimeout(timer);
  timer = window.setTimeout(
    () => {
      randomGlint();
      schedule();
    },
    3200 + Math.random() * 3600,
  );
}
document.addEventListener('visibilitychange', () => {
  if (document.hidden) clearTimeout(timer);
  else schedule();
});
schedule();

// the hero title: one bright sweep as it sets (CSS, .wm-top) and a glint or two
const title = document.querySelector('.wm-top');
if (title) {
  setTimeout(() => glintOn(title), 1150);
  setTimeout(() => glintOn(title, true), 1700);
}

// sweeps and proof flashes: play once per trigger
function flick(el: Element) {
  el.classList.remove('flick');
  void (el as HTMLElement).offsetWidth; // restart the animation
  el.classList.add('flick');
}
document.addEventListener('animationend', (e) => {
  const t = e.target as Element;
  if ((e.animationName === 'sweepBox' || e.animationName === 'proof') && t.classList) t.classList.remove('flick');
});
for (const el of document.querySelectorAll('.shine')) {
  el.addEventListener('pointerenter', () => flick(el));
  el.addEventListener('focusin', () => flick(el));
}
// a card's coin flashes when the card is hovered
for (const card of document.querySelectorAll('[data-proof-hover]')) {
  card.addEventListener('pointerenter', () => card.querySelectorAll('.proof').forEach(flick));
}
const enter = document.querySelectorAll('.shine-enter, .proof');
if ('IntersectionObserver' in window) {
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (e.isIntersecting) {
          flick(e.target);
          io.unobserve(e.target);
        }
      }
    },
    { rootMargin: '0px 0px -12% 0px' },
  );
  enter.forEach((el) => io.observe(el));
}
