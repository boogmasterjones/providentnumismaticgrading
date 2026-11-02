/**
 * Small site-wide behaviour: header darkens on scroll, phone menu, reveal on scroll, gold-text shimmer, and the faint
 * coin river behind each inner page's title. Owner's rule: animations always play (no reduced-motion opt-out).
 */
import './coin-engine.js';

type River = { pause(): void; play(): void };
declare global {
  interface Window {
    CoinEngine: {
      river(host: HTMLElement, opts: Record<string, unknown>): River;
      watch(el: Element, fn: (visible: boolean) => void): void;
    };
  }
}

document.documentElement.classList.add('js');

// Header: transparent over the home hero, solid once the page scrolls. Read scroll once per frame, write a class.
const header = document.querySelector<HTMLElement>('.site-header');
if (header) {
  let ticking = false;
  const update = () => {
    ticking = false;
    header.classList.toggle('scrolled', window.scrollY > 40);
  };
  addEventListener('scroll', () => {
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(update);
    }
  }, { passive: true });
  update();

  const toggle = header.querySelector<HTMLButtonElement>('.menu-toggle');
  toggle?.addEventListener('click', () => {
    const open = !header.classList.contains('open');
    header.classList.toggle('open', open);
    toggle.setAttribute('aria-expanded', String(open));
  });
  addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && header.classList.contains('open')) {
      header.classList.remove('open');
      toggle?.setAttribute('aria-expanded', 'false');
      toggle?.focus();
    }
  });
}

// Reveal on scroll.
const reveal = document.querySelectorAll('.rv');
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

// Gold text catches the light now and then.
const gold = document.querySelectorAll<HTMLElement>('.goldtext');
if (gold.length) {
  const shine = () => {
    if (document.hidden) return;
    gold.forEach((g, i) => {
      setTimeout(() => {
        g.classList.remove('shimmer');
        void g.offsetWidth;
        g.classList.add('shimmer');
      }, i * 160);
    });
  };
  setTimeout(shine, 2600);
  setInterval(shine, 9000);
}

// The faint coin river behind inner page titles.
const pageRiver = document.querySelector<HTMLElement>('.page-river');
if (pageRiver && window.CoinEngine) {
  const phone = innerWidth < 600;
  window.CoinEngine.river(pageRiver, {
    seed: 77,
    scale: phone ? 0.6 : 0.8,
    pool: phone ? 6 : 9,
    rotate: -7,
    bleed: [0.1, 0.25],
    fill: true,
    rowGap: 22,
    glint: true,
    rows: [
      { d: 84, dir: -1, speed: 14, depth: 'far' },
      { d: 120, dir: 1, speed: 20, depth: 'mid' },
      { d: 92, dir: -1, speed: 16, depth: 'far' },
    ],
  });
}
