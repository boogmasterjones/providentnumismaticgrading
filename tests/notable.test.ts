import { describe, expect, it } from 'vitest';
import { notableCoins, parseNotable, splitGrade, verifyHref } from '../src/lib/notable';

describe('notable coins', () => {
  it('has no entries yet (the home page shows marked placeholders, never invented coins)', () => {
    expect(notableCoins()).toEqual([]);
  });

  it('keeps only complete entries, in the editor order', () => {
    const coins = parseNotable([
      ['../../content/notable/b.json', { name: 'B coin', obverse: '/images/notable/b.jpg', grade: 'MS 64', cert: '2', order: 2 }],
      ['../../content/notable/a.json', { name: 'A coin', obverse: '/images/notable/a.jpg', grade: 'AU 58', cert: '1', order: 1 }],
      ['../../content/notable/c.json', { name: 'No grade', obverse: '/images/notable/c.jpg', cert: '3' }],
      ['../../content/notable/d.json', { name: 'No photo', grade: 'VF 30', cert: '4' }],
    ]);
    expect(coins.map((c) => c.slug)).toEqual(['a', 'b']);
  });

  it('links a certificate to the Verify page', () => {
    expect(verifyHref('PNA 12/3')).toBe('/verify?cert=PNA%2012%2F3');
  });
});

describe('notable grade split', () => {
  it('keeps a short grade whole', () => {
    expect(splitGrade('MS 65')).toEqual({ main: 'MS 65', sub: '', long: false });
  });
  it('puts subgrades and designations on a line of their own', () => {
    expect(splitGrade('Ch XF, Strike 5/5, Surface 4/5')).toEqual({ main: 'Ch XF', sub: 'Strike 5/5 · Surface 4/5', long: false });
    expect(splitGrade('PR 69, Deep Cameo')).toEqual({ main: 'PR 69', sub: 'Deep Cameo', long: false });
  });
  it('marks a long grade without a comma, to be set smaller', () => {
    expect(splitGrade('Genuine – Details: Cleaned').long).toBe(true);
  });
});
