/**
 * Scroll-scrubbed film: a sequence of still frames (extracted from stock footage, see README) drawn to a canvas as
 * the visitor scrolls through a pinned section, the way a scroll-driven video works. Frames are plain WebP images,
 * so scrubbing is smooth in both directions on every device (a compressed video only seeks cleanly to keyframes).
 *
 * Markup: <canvas data-scrub="/media/scrub/coins/" data-frames="80"> inside an element with data-progress="pin".
 * Loading starts when the section comes within two screens; phones load every second frame. Until a frame is ready,
 * the nearest loaded one is shown (the first frame is the poster).
 */
for (const canvas of document.querySelectorAll<HTMLCanvasElement>('canvas[data-scrub]')) {
  const base = canvas.dataset.scrub ?? '';
  const total = Number(canvas.dataset.frames ?? '0');
  const track = canvas.closest<HTMLElement>('[data-progress]');
  if (!total || !track) continue;
  const ctx = canvas.getContext('2d');
  if (!ctx) continue;

  const small = matchMedia('(max-width: 720px)').matches;
  const step = small ? 2 : 1;
  const indexes: number[] = [];
  for (let i = 0; i < total; i += step) indexes.push(i);
  if (indexes[indexes.length - 1] !== total - 1) indexes.push(total - 1);
  const images: (HTMLImageElement | null)[] = indexes.map(() => null);
  const src = (i: number) => `${base}${String(i).padStart(3, '0')}.webp`;

  let want = 0; // position in indexes, fractional
  let shown = -1;
  let raf = 0;

  function fit() {
    const r = canvas.getBoundingClientRect();
    const dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.round(r.width * dpr);
    canvas.height = Math.round(r.height * dpr);
    shown = -1;
    draw();
  }

  function nearestLoaded(k: number): HTMLImageElement | null {
    for (let d = 0; d < images.length; d++) {
      const a = images[k - d];
      if (a && a.complete && a.naturalWidth) return a;
      const b = images[k + d];
      if (b && b.complete && b.naturalWidth) return b;
    }
    return null;
  }

  function draw() {
    raf = 0;
    const k = Math.round(want);
    const img = nearestLoaded(k);
    if (!img) return;
    const key = images.indexOf(img);
    if (key === shown) return;
    shown = key;
    // cover the canvas, centred
    const cw = canvas.width;
    const ch = canvas.height;
    const s = Math.max(cw / img.naturalWidth, ch / img.naturalHeight);
    const w = img.naturalWidth * s;
    const h = img.naturalHeight * s;
    ctx!.drawImage(img, (cw - w) / 2, (ch - h) / 2, w, h);
  }
  const schedule = () => {
    if (!raf) raf = requestAnimationFrame(draw);
  };

  function load(k: number): Promise<void> {
    return new Promise((res) => {
      const img = new Image();
      img.decoding = 'async';
      img.onload = () => {
        images[k] = img;
        if (Math.abs(k - want) < 1.5 || shown === -1) schedule();
        res();
      };
      img.onerror = () => res();
      img.src = src(indexes[k]);
    });
  }

  let started = false;
  async function start() {
    if (started) return;
    started = true;
    await load(0); // the poster
    // then an even spread first (so any scroll position has something close), then fill in, a few at a time
    const order: number[] = [];
    for (const stride of [8, 4, 2, 1]) for (let k = 0; k < indexes.length; k += stride) if (!order.includes(k)) order.push(k);
    let next = 0;
    const worker = async () => {
      while (next < order.length) {
        const k = order[next++];
        if (!images[k]) await load(k);
      }
    };
    await Promise.all([worker(), worker(), worker()]);
  }

  track.addEventListener('scrollprogress', (e) => {
    want = (e as unknown as CustomEvent<number>).detail * (indexes.length - 1);
    schedule();
  });

  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(
      (es) => {
        if (es.some((x) => x.isIntersecting)) {
          io.disconnect();
          void start();
        }
      },
      { rootMargin: '200% 0px' },
    );
    io.observe(track);
  } else void start();

  fit();
  let rt = 0;
  addEventListener('resize', () => {
    clearTimeout(rt);
    rt = window.setTimeout(fit, 150);
  });
}
