import { describe, expect, it } from 'vitest';
import { buildCertIndex, lookupCert, normalizeCertNumber, certPath } from '../src/lib/certIndex';

describe('normalizeCertNumber', () => {
  it('ignores case, spaces and a leading # or "No."', () => {
    expect(normalizeCertNumber(' sample-0001 ')).toBe('SAMPLE-0001');
    expect(normalizeCertNumber('#12345678')).toBe('12345678');
    expect(normalizeCertNumber('No. 1234 5678')).toBe('12345678');
    expect(normalizeCertNumber('Cert # 42')).toBe('42');
  });
  it('drops characters that are not letters, digits or dashes', () => {
    expect(normalizeCertNumber('PNA/0042!')).toBe('PNA0042');
    expect(normalizeCertNumber('   ')).toBe('');
  });
});

describe('buildCertIndex / lookupCert', () => {
  const index = buildCertIndex([
    { id: 'sample-0001', certNumber: 'SAMPLE-0001', sample: true },
    { id: '1000123', certNumber: '1000123' },
  ]);

  it('indexes every certificate with its page address', () => {
    expect(index.count).toBe(2);
    expect(index.certs['SAMPLE-0001']).toEqual({ n: 'SAMPLE-0001', u: '/verify/sample-0001/', s: true });
    expect(index.certs['1000123']).toEqual({ n: '1000123', u: '/verify/1000123/' });
  });

  it('finds a certificate however the visitor types it', () => {
    expect(lookupCert(index, 'sample-0001')?.u).toBe('/verify/sample-0001/');
    expect(lookupCert(index, ' #1000123 ')?.u).toBe('/verify/1000123/');
  });

  it('returns null for unknown or empty input', () => {
    expect(lookupCert(index, 'SAMPLE-9999')).toBeNull();
    expect(lookupCert(index, '')).toBeNull();
    expect(lookupCert(index, '!!!')).toBeNull();
  });

  it('refuses duplicate certificate numbers so a typo cannot hide a record', () => {
    expect(() =>
      buildCertIndex([
        { id: 'a', certNumber: 'PNA-1' },
        { id: 'b', certNumber: 'pna-1' },
      ]),
    ).toThrow(/Duplicate certificate number/);
  });

  it('url-encodes ids', () => {
    expect(certPath('a b')).toBe('/verify/a%20b/');
  });
});
