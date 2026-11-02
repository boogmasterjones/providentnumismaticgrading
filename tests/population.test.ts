import { describe, expect, it } from 'vitest';
import { compareGrades, computePopulation, coinTypeOf, normalizeGrade } from '../src/lib/population';

describe('normalizeGrade', () => {
  it('treats spacing and case as the same grade', () => {
    expect(normalizeGrade('ms65')).toBe('MS 65');
    expect(normalizeGrade('MS 65')).toBe('MS 65');
    expect(normalizeGrade('  ms   65 ')).toBe('MS 65');
    expect(normalizeGrade('MS65+')).toBe('MS 65+');
  });
  it('keeps text grades and labels an empty grade', () => {
    expect(normalizeGrade('Choice VF')).toBe('CHOICE VF');
    expect(normalizeGrade('')).toBe('Ungraded');
  });
});

describe('compareGrades', () => {
  it('sorts highest number first, plus above plain, text grades last', () => {
    const grades = ['VF 30', 'MS 65', 'CHOICE VF', 'MS 65+', 'XF 40'];
    expect([...grades].sort(compareGrades)).toEqual(['MS 65+', 'MS 65', 'XF 40', 'VF 30', 'CHOICE VF']);
  });
});

describe('coinTypeOf', () => {
  it('combines country/denomination with the year', () => {
    expect(coinTypeOf({ countryDenomination: 'United States, Morgan dollar', year: '1921', grade: 'MS 63' })).toBe(
      'United States, Morgan dollar — 1921',
    );
    expect(coinTypeOf({ countryDenomination: ' Roman  Empire, denarius ', year: '', grade: 'VF 30' })).toBe(
      'Roman Empire, denarius',
    );
  });
});

describe('computePopulation', () => {
  it('returns an empty report for no certificates', () => {
    expect(computePopulation([])).toEqual({ grades: [], rows: [], total: 0, sampleCount: 0 });
  });

  it('groups by coin type and grade and totals each row', () => {
    const report = computePopulation([
      { countryDenomination: 'Roman Empire, denarius', year: 'c. 200 AD', grade: 'VF 30' },
      { countryDenomination: 'Roman Empire, denarius', year: 'c. 200 AD', grade: 'vf30' },
      { countryDenomination: 'Roman Empire, denarius', year: 'c. 200 AD', grade: 'XF 40', sample: true },
      { countryDenomination: 'United States, Morgan dollar', year: '1921', grade: 'MS 63' },
    ]);
    expect(report.total).toBe(4);
    expect(report.sampleCount).toBe(1);
    expect(report.grades).toEqual(['MS 63', 'XF 40', 'VF 30']);
    expect(report.rows).toEqual([
      { coinType: 'Roman Empire, denarius — c. 200 AD', counts: { 'VF 30': 2, 'XF 40': 1 }, total: 3 },
      { coinType: 'United States, Morgan dollar — 1921', counts: { 'MS 63': 1 }, total: 1 },
    ]);
  });

  it('keeps different years of the same denomination apart', () => {
    const report = computePopulation([
      { countryDenomination: 'US, Morgan dollar', year: '1921', grade: 'MS 63' },
      { countryDenomination: 'US, Morgan dollar', year: '1922', grade: 'MS 63' },
    ]);
    expect(report.rows.map((r) => r.coinType)).toEqual(['US, Morgan dollar — 1921', 'US, Morgan dollar — 1922']);
  });
});
