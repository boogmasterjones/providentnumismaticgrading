/** One clip in a footage panel's sequence: the good part of a stock clip, [start, end) in seconds. */
export interface Clip {
  src: string;
  /** smaller rendition for phones */
  small?: string;
  start: number;
  end: number;
}

/** Crossfade length (seconds). */
export const FADE = 1;
/** Start fetching the next clip this long before the crossfade begins (seconds). */
export const LEAD = 3;

/** The index after i in a looping sequence of n clips. */
export const nextIndex = (i: number, n: number) => (n > 0 ? (i + 1) % n : 0);

/** What a panel should be doing at time t of its current clip. */
export function phase(t: number, clip: Pick<Clip, 'start' | 'end'>, fade = FADE, lead = LEAD): 'play' | 'preload' | 'fade' {
  const fadeAt = Math.max(clip.start, clip.end - fade);
  if (t >= fadeAt) return 'fade';
  if (t >= fadeAt - lead) return 'preload';
  return 'play';
}

/** Parse and sanity-check a panel's data-sequence attribute; bad entries are dropped. */
export function parseSequence(json: string | undefined): Clip[] {
  if (!json) return [];
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return [];
  }
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (c): c is Clip =>
      !!c && typeof c.src === 'string' && typeof c.start === 'number' && typeof c.end === 'number' && c.end > c.start + FADE,
  );
}
