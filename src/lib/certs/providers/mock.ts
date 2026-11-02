import type { CertAdapter } from '../adapter';
import type { CertificateInput } from '../certificate';

/**
 * Made-up DEMO records so the Verify and Population pages can be previewed before Alex's database is connected.
 * Every record says DEMO, so nobody can mistake one for a real certificate. No photos (real photos only).
 */
export const DEMO_CERTIFICATES: CertificateInput[] = [
  {
    certNumber: 'DEMO-0001',
    coinDescription: 'DEMO RECORD — Roman Empire silver denarius (not a real coin or grade)',
    year: 'c. 200 AD',
    countryDenomination: 'Roman Empire, denarius',
    grade: 'VF 30',
    strikeScore: '4/5',
    surfaceScore: '3/5',
    notes: 'DEMO record for previewing the website. Real certificates come from the certificate database.',
    dateGraded: '2026-11-01',
    demo: true,
  },
  {
    certNumber: 'DEMO-0002',
    coinDescription: 'DEMO RECORD — Roman Empire silver denarius (not a real coin or grade)',
    year: 'c. 200 AD',
    countryDenomination: 'Roman Empire, denarius',
    grade: 'XF 40',
    strikeScore: '5/5',
    surfaceScore: '4/5',
    notes: 'DEMO record for previewing the website.',
    dateGraded: '2026-11-01',
    demo: true,
  },
  {
    certNumber: 'DEMO-0003',
    coinDescription: 'DEMO RECORD — United States token (not a real coin or grade)',
    year: '1863',
    countryDenomination: 'United States, Civil War token',
    grade: 'MS 63',
    strikeScore: '4/5',
    surfaceScore: '4/5',
    notes: 'DEMO record for previewing the website.',
    dateGraded: '2026-11-02',
    demo: true,
  },
];

export function createMockAdapter(): CertAdapter {
  return {
    id: 'demo',
    mode: 'demo',
    async getCertificate(certNumber) {
      return DEMO_CERTIFICATES.find((c) => c.certNumber === certNumber) ?? null;
    },
    async listAll() {
      return DEMO_CERTIFICATES;
    },
  };
}
