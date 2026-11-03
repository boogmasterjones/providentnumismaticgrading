import { describe, expect, it } from 'vitest';
import { notableCoins, parseNotable, verifyHref } from '../src/lib/notable';

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
