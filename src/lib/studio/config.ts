/**
 * Studio's server settings, read from environment variables at request time (Netlify: Site configuration →
 * Environment variables; locally: .env, loaded into process.env by astro.config.mjs). Names only are documented in
 * docs/STUDIO_SETUP.md. None of these values is ever sent to the browser or logged.
 */
export interface StudioConfig {
  email: string;
  /** bcrypt hash (or base64 of it) */
  passwordHash: string;
  sessionSecret: string;
  storage: 'local' | 'github' | 'none';
  /** why storage is "none", in plain English */
  storageProblem?: string;
  github?: {
    repo: string;
    appId: string;
    privateKey: string;
    installationId?: string;
    liveBranch: string;
    draftsBranch: string;
  };
  /** cookies marked Secure (always, except plain-http local development) */
  secure: boolean;
  /** problems that stop anyone signing in */
  loginProblems: string[];
}

type Env = Record<string, string | undefined>;

export function readConfig(env: Env = process.env, opts: { dev: boolean } = { dev: false }): StudioConfig {
  const v = (k: string) => (env[k] ?? '').trim();
  const loginProblems: string[] = [];
  const email = v('STUDIO_EMAIL').toLowerCase();
  const passwordHash = decodeHash(v('STUDIO_PASSWORD_HASH'));
  const sessionSecret = v('STUDIO_SESSION_SECRET');
  if (!email) loginProblems.push('STUDIO_EMAIL is not set.');
  if (!/^\$2[aby]\$\d{2}\$.{53}$/.test(passwordHash)) loginProblems.push('STUDIO_PASSWORD_HASH is missing or is not a bcrypt hash.');
  if (sessionSecret.length < 32) loginProblems.push('STUDIO_SESSION_SECRET is missing or shorter than 32 characters.');

  const repo = v('STUDIO_GITHUB_REPO');
  let storage: StudioConfig['storage'] = 'none';
  let storageProblem: string | undefined;
  let github: StudioConfig['github'];
  if (repo) {
    const appId = v('STUDIO_GITHUB_APP_ID');
    const privateKey = env.STUDIO_GITHUB_APP_PRIVATE_KEY ?? '';
    if (!/^[\w.-]+\/[\w.-]+$/.test(repo)) storageProblem = 'STUDIO_GITHUB_REPO must look like owner/repository.';
    else if (!appId || !privateKey.trim()) storageProblem = 'STUDIO_GITHUB_APP_ID and STUDIO_GITHUB_APP_PRIVATE_KEY are needed.';
    else {
      storage = 'github';
      github = {
        repo,
        appId,
        privateKey,
        installationId: v('STUDIO_GITHUB_INSTALLATION_ID') || undefined,
        liveBranch: v('STUDIO_LIVE_BRANCH') || 'main',
        draftsBranch: v('STUDIO_DRAFTS_BRANCH') || 'studio-drafts',
      };
      if (github.liveBranch === github.draftsBranch) {
        storage = 'none';
        storageProblem = 'STUDIO_DRAFTS_BRANCH must differ from the live branch.';
      }
    }
  } else if (opts.dev || v('STUDIO_STORAGE') === 'local') {
    storage = 'local';
  } else {
    storageProblem = 'Studio is not connected to GitHub yet (STUDIO_GITHUB_REPO is not set).';
  }
  return {
    email,
    passwordHash,
    sessionSecret,
    storage,
    storageProblem,
    github,
    secure: !opts.dev,
    loginProblems,
  };
}

/** bcrypt hashes contain "$", which some .env loaders expand; base64 of the hash is accepted too. */
export function decodeHash(h: string): string {
  if (h.startsWith('$2')) return h;
  if (!h) return '';
  try {
    const d = Buffer.from(h, 'base64').toString('utf8');
    return d.startsWith('$2') ? d : h;
  } catch {
    return h;
  }
}
