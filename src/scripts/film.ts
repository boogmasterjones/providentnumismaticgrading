/**
 * Footage panels (after patek.com): full-screen clips that simply play, muted and looping, while they are on screen.
 * Nothing is tied to the scroll position and nothing pins: the page scrolls normally the whole time.
 *
 * Markup: <video class="reel-video" muted loop playsinline autoplay preload="none" poster="…" data-src="…"
 * data-src-small="…" data-start="3" data-end="17">. The source is attached only when the panel comes within about
 * one screen (phones get data-src-small when there is one); it plays while any part of it is in view and pauses when
 * it leaves. data-start / data-end keep the loop inside the good part of a stock clip.
 */
const videos = [...document.querySelectorAll<HTMLVideoElement>('video.reel-video')];
const small = matchMedia('(max-width: 720px)').matches;
const visible = new Set<HTMLVideoElement>();

function load(v: HTMLVideoElement) {
  if (v.dataset.loaded) return;
  v.dataset.loaded = '1';
  const src = (small && v.dataset.srcSmall) || v.dataset.src;
  if (!src) return;
  const start = Number(v.dataset.start ?? 0);
  const end = Number(v.dataset.end ?? 0);
  v.muted = true; // autoplay needs the property as well as the attribute on some browsers
  v.addEventListener('loadedmetadata', () => {
    if (start) v.currentTime = start;
  });
  v.addEventListener('timeupdate', () => {
    if (end && v.currentTime >= end) v.currentTime = start;
  });
  // autoplay starts it as soon as it can; keep it still while it is off screen
  v.addEventListener('play', () => {
    if (!visible.has(v)) v.pause();
  });
  v.preload = 'auto';
  v.src = src;
}

if ('IntersectionObserver' in window) {
  // start fetching about one screen before the panel arrives
  const near = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (e.isIntersecting) {
          load(e.target as HTMLVideoElement);
          near.unobserve(e.target);
        }
      }
    },
    { rootMargin: '100% 0px 100% 0px' },
  );
  // play while on screen, pause when it leaves
  const seen = new IntersectionObserver((entries) => {
    for (const e of entries) {
      const v = e.target as HTMLVideoElement;
      if (e.isIntersecting) {
        visible.add(v);
        load(v);
        v.play().catch(() => {
          /* autoplay refused (e.g. a data saver): the poster stays, which is fine */
        });
      } else {
        visible.delete(v);
        v.pause();
      }
    }
  });
  for (const v of videos) {
    near.observe(v);
    seen.observe(v);
  }
} else {
  for (const v of videos) {
    visible.add(v);
    load(v);
  }
}
