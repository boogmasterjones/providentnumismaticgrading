import { describe, expect, it } from 'vitest';
import { FADE, LEAD, nextIndex, parseSequence, phase } from '../src/lib/film';

describe('footage sequence', () => {
  it('loops through the clips', () => {
    expect([0, 1, 2].map((i) => nextIndex(i, 3))).toEqual([1, 2, 0]);
    expect(nextIndex(0, 1)).toBe(0);
  });

  it('plays, then fetches the next clip, then crossfades before the out-point', () => {
    const clip = { start: 2, end: 8 };
    expect(phase(2, clip)).toBe('play');
    expect(phase(8 - FADE - LEAD - 0.01, clip)).toBe('play');
    expect(phase(8 - FADE - LEAD, clip)).toBe('preload');
    expect(phase(8 - FADE, clip)).toBe('fade');
    expect(phase(9, clip)).toBe('fade');
  });

  it('drops malformed or too-short clips', () => {
    expect(parseSequence(undefined)).toEqual([]);
    expect(parseSequence('nope')).toEqual([]);
    expect(parseSequence('{"src":"a"}')).toEqual([]);
    const ok = { src: '/a.mp4', start: 0, end: 5 };
    expect(parseSequence(JSON.stringify([ok, { src: '/b.mp4', start: 1, end: 1.5 }, { start: 0, end: 5 }]))).toEqual([ok]);
  });
});
