/**
 * Home carousel (src/components/Carousel.astro). The track is a native scroll-snap strip, so phones swipe it with no
 * script at all; this adds a slow auto-advance (5 s), arrows, progress dots and mouse drag. Auto-advance is
 * time-based and pauses on hover, on keyboard focus, while dragging, off screen and while the tab is hidden.
 */
const DELAY = 5000;

for (const root of document.querySelectorAll<HTMLElement>('[data-carousel]')) {
  const track = root.querySelector<HTMLElement>('.car-track');
  const slides = [...root.querySelectorAll<HTMLElement>('.car-slide')];
  const dots = [...root.querySelectorAll<HTMLButtonElement>('.car-dot')];
  if (!track || slides.length < 2) continue;

  let index = 0;
  let timer = 0;
  let hover = false;
  let focus = false;
  let onScreen = false;
  let dragging = false;

  const go = (i: number) => {
    index = (i + slides.length) % slides.length;
    track.scrollTo({ left: slides[index].offsetLeft - track.offsetLeft, behavior: 'smooth' });
    mark();
  };
  const mark = () => {
    dots.forEach((d, i) => {
      d.classList.toggle('on', i === index);
      d.setAttribute('aria-current', String(i === index));
    });
    root.classList.toggle('paused', !running());
  };
  const running = () => onScreen && !hover && !focus && !dragging && !document.hidden;
  const restart = () => {
    clearTimeout(timer);
    // restart the dot's progress bar
    const d = dots[index];
    if (d) {
      d.classList.remove('on');
      void d.offsetWidth;
    }
    mark();
    if (running()) timer = window.setTimeout(() => go(index + 1), DELAY);
  };

  // keep the index in step with swipes (read on scroll end only; nothing animates from scroll position)
  let st = 0;
  track.addEventListener(
    'scroll',
    () => {
      clearTimeout(st);
      st = window.setTimeout(() => {
        const i = Math.round(track.scrollLeft / track.clientWidth);
        if (i !== index) {
          index = Math.max(0, Math.min(slides.length - 1, i));
          restart();
        }
      }, 120);
    },
    { passive: true },
  );

  root.querySelector('.car-prev')?.addEventListener('click', () => {
    go(index - 1);
    restart();
  });
  root.querySelector('.car-next')?.addEventListener('click', () => {
    go(index + 1);
    restart();
  });
  dots.forEach((d, i) =>
    d.addEventListener('click', () => {
      go(i);
      restart();
    }),
  );

  root.addEventListener('pointerenter', (e) => {
    if (e.pointerType === 'mouse') {
      hover = true;
      restart();
    }
  });
  root.addEventListener('pointerleave', () => {
    hover = false;
    restart();
  });
  root.addEventListener('focusin', (e) => {
    focus = (e.target as HTMLElement).matches(':focus-visible');
    restart();
  });
  root.addEventListener('focusout', () => {
    focus = false;
    restart();
  });
  track.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') go(index + 1);
    else if (e.key === 'ArrowLeft') go(index - 1);
    else return;
    e.preventDefault();
    restart();
  });

  // mouse drag (touch uses the native swipe)
  let startX = 0;
  let startLeft = 0;
  track.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'mouse' || e.button !== 0) return;
    dragging = true;
    startX = e.clientX;
    startLeft = track.scrollLeft;
    track.classList.add('dragging');
    track.setPointerCapture(e.pointerId);
    restart();
  });
  track.addEventListener('pointermove', (e) => {
    if (dragging) track.scrollLeft = startLeft - (e.clientX - startX);
  });
  const end = (e: PointerEvent) => {
    if (!dragging) return;
    dragging = false;
    track.classList.remove('dragging');
    const dx = e.clientX - startX;
    go(Math.abs(dx) > 40 ? index + (dx < 0 ? 1 : -1) : index);
    restart();
  };
  track.addEventListener('pointerup', end);
  track.addEventListener('pointercancel', end);
  track.addEventListener('dragstart', (e) => e.preventDefault());

  document.addEventListener('visibilitychange', restart);
  if ('IntersectionObserver' in window) {
    new IntersectionObserver((entries) => {
      onScreen = entries[entries.length - 1].isIntersecting;
      restart();
    }).observe(root);
  } else {
    onScreen = true;
  }
  restart();
}
