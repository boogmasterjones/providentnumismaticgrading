/**
 * GitHub App authentication, server side only. The App's private key (an env var) signs a short-lived JWT, which is
 * exchanged for an installation access token limited to the one repository and to "contents: write". Tokens are
 * kept in memory until shortly before they expire. Nothing here is ever logged or sent to the browser.
 */
import { createPrivateKey, createSign } from 'node:crypto';

export interface AppCredentials {
  appId: string;
  /** PEM, with real or "\n" escaped newlines, or base64 of the PEM */
  privateKey: string;
  /** optional; looked up from the repository when not given */
  installationId?: string;
  /** owner/repo */
  repo: string;
}

export type Fetch = typeof globalThis.fetch;

const API = 'https://api.github.com';
const b64url = (b: Buffer | string) => Buffer.from(b).toString('base64url');

/** Accepts the key as pasted into Netlify: real newlines, "\n" escapes, or the whole PEM base64-encoded. */
export function normalizePem(key: string): string {
  let k = key.trim();
  if (!k.includes('-----BEGIN')) {
    try {
      k = Buffer.from(k, 'base64').toString('utf8').trim();
    } catch {
      /* fall through */
    }
  }
  return k.replace(/\\n/g, '\n');
}

/** A JWT (RS256) that identifies the App for 9 minutes (GitHub allows at most 10). */
export function appJwt(appId: string, privateKey: string, now = Date.now()): string {
  const iat = Math.floor(now / 1000) - 60; // allow for clock drift
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const payload = b64url(JSON.stringify({ iat, exp: iat + 9 * 60, iss: appId }));
  const signer = createSign('RSA-SHA256');
  signer.update(`${header}.${payload}`);
  const sig = signer.sign(createPrivateKey(normalizePem(privateKey)));
  return `${header}.${payload}.${b64url(sig)}`;
}

export class GitHubAuthError extends Error {}

interface Cached {
  token: string;
  expires: number;
}

/** Hands out installation tokens, refreshing them 5 minutes before they expire. */
export class InstallationTokens {
  private cached: Cached | null = null;
  private installationId: string | undefined;

  constructor(
    private creds: AppCredentials,
    private fetchFn: Fetch = globalThis.fetch,
    private now: () => number = Date.now,
  ) {
    this.installationId = creds.installationId || undefined;
  }

  async token(): Promise<string> {
    if (this.cached && this.cached.expires - 5 * 60_000 > this.now()) return this.cached.token;
    const jwt = appJwt(this.creds.appId, this.creds.privateKey, this.now());
    const headers = {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${jwt}`,
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'provident-studio',
    };
    if (!this.installationId) {
      const r = await this.fetchFn(`${API}/repos/${this.creds.repo}/installation`, { headers });
      if (!r.ok) throw new GitHubAuthError(`The GitHub App is not installed on ${this.creds.repo} (status ${r.status}).`);
      this.installationId = String(((await r.json()) as { id: number }).id);
    }
    const repoName = this.creds.repo.split('/')[1];
    const r = await this.fetchFn(`${API}/app/installations/${this.installationId}/access_tokens`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ repositories: [repoName], permissions: { contents: 'write' } }),
    });
    if (!r.ok) throw new GitHubAuthError(`GitHub refused the App's token request (status ${r.status}).`);
    const j = (await r.json()) as { token: string; expires_at: string };
    this.cached = { token: j.token, expires: Date.parse(j.expires_at) || this.now() + 50 * 60_000 };
    return j.token;
  }
}
