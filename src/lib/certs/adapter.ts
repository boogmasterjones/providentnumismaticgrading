/**
 * The small interface between the website and wherever the owner keeps the certificates.
 *
 * - providers/registry-api.ts talks to the owner's real certificate database. It is the ONLY file that knows that
 *   database's addresses, field names and login method. Once we know which system the owner uses, only that file changes.
 * - providers/mock.ts returns three clearly labelled DEMO records, used whenever CERT_API_URL is not set, so the
 *   site can be previewed.
 */
import type { CertificateInput } from './certificate';
import { createMockAdapter } from './providers/mock';
import { createRegistryApiAdapter } from './providers/registry-api';

export interface CertAdapter {
  /** Short id, part of the cache key so demo answers are never served once the real database is connected. */
  readonly id: string;
  readonly mode: 'live' | 'demo';
  /**
   * One certificate by its normalised number (capitals, no spaces). Resolves null when the database has no such
   * certificate. Throws CertAdapterError for anything else (refused login, database down, unreadable reply).
   */
  getCertificate(certNumber: string): Promise<CertificateInput | null>;
  /**
   * Optional: every certificate, for the population report. Leave undefined when the database can't list them;
   * the population page then says the report isn't available (and stays hidden unless switched on).
   */
  listAll?(): Promise<CertificateInput[]>;
}

export type CertAdapterErrorKind = 'auth' | 'busy' | 'timeout' | 'upstream';

/** The message is for our logs only and must never contain the API key; visitors only ever see a generic text. */
export class CertAdapterError extends Error {
  constructor(
    public kind: CertAdapterErrorKind,
    message: string,
  ) {
    super(message);
  }
}

export interface CertEnv {
  CERT_API_URL?: string;
  CERT_API_KEY?: string;
}

/** The real database when CERT_API_URL is set, otherwise the DEMO records. */
export function getCertAdapter(env: CertEnv, fetchImpl: typeof fetch = globalThis.fetch): CertAdapter {
  const url = env.CERT_API_URL?.trim();
  if (!url) return createMockAdapter();
  return createRegistryApiAdapter({ baseUrl: url, apiKey: env.CERT_API_KEY?.trim() ?? '', fetch: fetchImpl });
}
