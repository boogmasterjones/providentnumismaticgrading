/**
 * Footage panels (after patek.com): full-screen footage that plays, muted, while the panel is on screen. Each panel
 * cycles through a short sequence of clips (data-sequence, see src/lib/film.ts): two stacked <video> elements take
 * turns. While one plays the good part of its clip, the other fetches the next clip and waits at its in-point; about
 * a second before the current clip's out-point the next one starts on top of it and fades in (CSS
 * opacity transition, home.css). So there is never a hard cut and never a loop seam: after the last clip the
 * sequence crossfades back to the first.
 *
 * Loading is lazy: nothing is fetched until the panel is about one screen away, and then only the current clip and,
 * a few seconds before it is needed, the next one. Playback pauses when the panel leaves the screen. Phones get the
 * smaller renditions. Nothing is tied to the scroll position and nothing pins.
 */
import { FADE, nextIndex, parseSequence, phase, type Clip } from '../lib/film';

const small = matchMedia('(max-width: 720px)').matches;
const srcOf = (c: Clip) => (small && c.small) || c.src;
const once = (el: EventTarget, type: string) => new Promise<void>((res) => el.addEventListener(type, () => res(), { once: true }));

class Panel {
  private readonly vids: HTMLVideoElement[];
  private readonly clips: Clip[];
  private cur = 0; // which video element is showing
  private idx = 0; // which clip it shows
  private visible = false;
  private fading = false;
  private raf = 0;
  /** per video element: the clip index it holds and a promise that settles when it waits at that clip's in-point */
  private readonly ready: (Promise<boolean> | null)[] = [null, null];
  private readonly holds: number[] = [-1, -1];
  private readonly isReady: boolean[] = [false, false];

  constructor(readonly el: HTMLElement) {
    this.vids = [...el.querySelectorAll<HTMLVideoElement>('video.reel-video')];
    this.clips = parseSequence(el.dataset.sequence);
    for (const v of this.vids) v.muted = true; // autoplay needs the property as well as the attribute on some browsers
  }

  get ok() {
    return this.vids.length === 2 && this.clips.length > 0;
  }

  /** Load clip i into video slot s and park it at the clip's in-point. */
  prepare(s: number, i: number): Promise<boolean> {
    if (this.holds[s] === i && this.ready[s]) return this.ready[s]!;
    const v = this.vids[s];
    const clip = this.clips[i];
    this.holds[s] = i;
    this.isReady[s] = false;
    const p = (async () => {
      v.preload = 'auto';
      const next = new URL(srcOf(clip), location.href).href;
      if (v.currentSrc !== next && v.src !== next) {
        v.src = next;
        await Promise.race([once(v, 'loadedmetadata'), once(v, 'error').then(() => Promise.reject(new Error('clip')))]);
      }
      v.currentTime = clip.start;
      if (v.seeking) await once(v, 'seeked');
      if (v.readyState < 3) await Promise.race([once(v, 'canplay'), once(v, 'canplaythrough')]);
      if (this.holds[s] === i) this.isReady[s] = true;
      return true;
    })().catch(() => false);
    this.ready[s] = p;
    return p;
  }

  load() {
    if (this.ok) void this.prepare(this.cur, this.idx);
  }

  async show() {
    if (!this.ok) return;
    this.visible = true;
    await this.prepare(this.cur, this.idx);
    if (!this.visible) return;
    const playing = [this.vids[this.cur]];
    if (this.fading) playing.push(this.vids[1 - this.cur]);
    for (const v of playing) v.play().catch(() => {
      /* autoplay refused (e.g. a data saver): the poster stays, which is fine */
    });
    cancelAnimationFrame(this.raf);
    this.raf = requestAnimationFrame(this.tick);
  }

  hide() {
    this.visible = false;
    cancelAnimationFrame(this.raf);
    for (const v of this.vids) v.pause();
  }

  private tick = () => {
    if (!this.visible) return;
    this.raf = requestAnimationFrame(this.tick);
    if (this.fading) return;
    const v = this.vids[this.cur];
    if (v.paused || v.readyState < 2) return;
    const clip = this.clips[this.idx];
    const p = phase(v.currentTime, clip);
    if (p === 'play') return;
    const s = 1 - this.cur;
    const n = nextIndex(this.idx, this.clips.length);
    void this.prepare(s, n);
    if (p === 'fade' && this.isReady[s] && this.holds[s] === n) this.crossfade(s, n);
    // if the next clip isn't ready yet, the current one simply plays on past its out-point until it is
  };

  private crossfade(s: number, n: number) {
    this.fading = true;
    const from = this.vids[this.cur];
    const to = this.vids[s];
    to.play().catch(() => {});
    to.classList.add('is-top', 'is-on'); // fades in on top of the clip that is still playing underneath
    window.setTimeout(() => {
      from.classList.remove('is-on', 'is-top');
      from.pause();
      this.holds[this.cur] = -1; // it now sits at the old clip's out-point: reload it before reuse
      this.ready[this.cur] = null;
      this.isReady[this.cur] = false;
      to.classList.remove('is-top');
      this.cur = s;
      this.idx = n;
      this.fading = false;
    }, FADE * 1000 + 60);
  }
}

const panels = [...document.querySelectorAll<HTMLElement>('.reel[data-sequence]')].map((el) => new Panel(el)).filter((p) => p.ok);
const byEl = new Map(panels.map((p) => [p.el as Element, p]));

if ('IntersectionObserver' in window) {
  // start fetching the first clip about one screen before the panel arrives
  const near = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (e.isIntersecting) {
          byEl.get(e.target)?.load();
          near.unobserve(e.target);
        }
      }
    },
    { rootMargin: '100% 0px 100% 0px' },
  );
  // play while on screen, pause when it leaves
  const seen = new IntersectionObserver((entries) => {
    for (const e of entries) {
      const p = byEl.get(e.target);
      if (!p) continue;
      if (e.isIntersecting) void p.show();
      else p.hide();
    }
  });
  for (const p of panels) {
    near.observe(p.el);
    seen.observe(p.el);
  }
} else {
  for (const p of panels) void p.show();
}
