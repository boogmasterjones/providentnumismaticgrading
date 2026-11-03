import { describe, expect, it } from 'vitest';
import { cssUrl, initials, inscriptionWords, sprigSvg, wreathSvg } from '../src/lib/roman';

describe('ancient-Rome accents', () => {
  it('splits short labels into inscription words, dropping commas', () => {
    expect(inscriptionWords('What we grade')).toEqual(['What', 'we', 'grade']);
    expect(inscriptionWords(' Venice, Florida ')).toEqual(['Venice', 'Florida']);
    expect(inscriptionWords('one two three four five six')).toEqual(['one two three four five six']);
  });

  it('takes the company initials for the seal, never SPQR', () => {
    expect(initials('Provident Numismatic Authentication')).toBe('PNA');
    expect(initials('Provident & Co')).toBe('PC');
  });

  it('draws the laurel as plain SVG markup', () => {
    const w = wreathSvg({ cx: 32, cy: 32, r: 27 });
    expect(w).toContain('wreath-l');
    expect(w).toContain('matrix(-1 0 0 1 64 0)');
    expect(w).not.toMatch(/NaN/);
    const s = sprigSvg();
    expect(s.startsWith('<svg')).toBe(true);
    expect(cssUrl(s)).toMatch(/^url\("data:image\/svg\+xml,%3Csvg/);
  });
});
