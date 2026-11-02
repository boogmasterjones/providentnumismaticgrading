/**
 * The small interface between the website and wherever the owner keeps the certificates.
 *
 * - providers/coda.ts talks to the owner's real certificate database, a table in a Coda doc. It is the ONLY file
 *   that knows Coda's addresses, column names and login method. Setup: docs/CODA_SETUP.md.
 * - providers/mock.ts returns three clearly labelled DEMO records, used whenever no CODA_* setting is present, so
 *   the site can be previewed.
 *
 * (An earlier generic JSON-API placeholder, providers/registry-api.ts with CERT_API_URL/CERT_API_KEY, was removed
 * once we learned the owner uses Coda. It is in the Git history if another system is ever needed.)
 */
import type { CertificateInput } from './certificate';
import { createMockAdapter } from './providers/mock';
import { CodaConfigError, createCodaAdapter, isCodaConfigured, readCodaConfig, type CodaEnv } from './providers/coda';

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

/** The message is for our logs only and must never contain the API token; visitors only ever see a generic text. */
export class CertAdapterError extends Error {
  constructor(
    public kind: CertAdapterErrorKind,
    message: string,
  ) {
    super(message);
  }
}

export type CertEnv = CodaEnv;

/**
 * Coda when any CODA_* setting is present (a missing token or doc then fails safely as an error, never as demo
 * data), otherwise the DEMO records.
 */
export function getCertAdapter(
  env: CertEnv,
  fetchImpl: typeof fetch = globalThis.fetch,
  log?: (msg: string) => void,
): CertAdapter {
  if (!isCodaConfigured(env)) return createMockAdapter();
  try {
    return createCodaAdapter({ config: readCodaConfig(env), fetch: fetchImpl, log });
  } catch (e) {
    // A setup mistake (bad doc link, column map or API address): every lookup reports an error until it's fixed.
    const hint = e instanceof CodaConfigError ? e.message : 'Coda settings could not be read.';
    const fail = async (): Promise<never> => {
      log?.(`coda: ${hint}`);
      throw new CertAdapterError('upstream', hint);
    };
    return { id: 'coda-misconfigured', mode: 'live', getCertificate: fail, listAll: fail };
  }
}
