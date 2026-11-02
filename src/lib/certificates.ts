import { getCollection } from 'astro:content';
import { buildCertIndex } from './certIndex';
import { computePopulation } from './population';

export async function getCertificates() {
  const certs = await getCollection('certificates');
  return certs.sort((a, b) => a.data.certNumber.localeCompare(b.data.certNumber, 'en', { numeric: true }));
}

export async function getCertIndex() {
  const certs = await getCertificates();
  return buildCertIndex(certs.map((c) => ({ id: c.id, certNumber: c.data.certNumber, sample: c.data.sample })));
}

export async function getPopulation() {
  const certs = await getCertificates();
  return computePopulation(certs.map((c) => c.data));
}
