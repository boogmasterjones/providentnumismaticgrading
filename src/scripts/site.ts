/**
 * Small site-wide behaviour: the header settles onto a solid background on scroll, the phone menu, and choreographed
 * reveals as content scrolls into view. Owner's rule: animations always play (no reduced-motion opt-out).
 * The coin engine loads only on pages that draw coins.
 */
document.documentElement.classList.add('js');
import './scrollfx';

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

// Reveal on scroll, once. Elements with .rv rise and fade; .rake sections get a sweep of raking light.
const reveal = document.querySelectorAll('.rv, .rake, .draw');
if ('IntersectionObserver' in window) {
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (e.isIntersecting) {
          e.target.classList.add('in');
          io.unobserve(e.target);
        }
      }
    },
    { rootMargin: '0px 0px -8% 0px' },
  );
  reveal.forEach((el) => io.observe(el));
} else {
  reveal.forEach((el) => el.classList.add('in'));
}
