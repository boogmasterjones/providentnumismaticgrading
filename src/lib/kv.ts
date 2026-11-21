/**
 * The site's small server-side key-value store (it replaced Netlify Blobs when the site moved to Hostinger).
 *
 * Used for: the certificate lookup cache and population report (namespace "cert-verify") and Studio's sign-in
 * limits and locks (namespace "studio-auth"). Nothing in it is precious: losing it only means a few lookups go to
 * the owner's database again and the sign-in counters start over.
 *
 * Where it lives, chosen from the server environment at request time:
 * - MySQL (production on Hostinger): DB_HOST, DB_NAME, DB_USER, DB_PASSWORD (+ optional DB_PORT). One table,
 *   `provident_kv`, created on first use. It lives in Alex's own hosting account and survives every redeploy,
 *   which files written by the app do NOT (Hostinger replaces the app folder on each deploy).
 * - Files (local work): KV_DIR, or `.data/kv` under `astro dev`. One JSON file per namespace.
 * - Memory: anything else (tests, or production with no database: works, but forgets on every restart).
 *
 * Server-only. Never import this from browser code. Connection details are never logged.
 */
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export interface KV {
  get(key: string): Promise<unknown | null>;
  /** ttlMs: forget the value after this long (default: the namespace's default, else never). */
  set(key: string, value: unknown, ttlMs?: number): Promise<void>;
}

interface Entry {
  v: unknown;
  /** epoch ms, or null for never */
  exp: number | null;
}

const expiry = (now: number, ttl?: number) => (ttl && ttl > 0 ? now + ttl : null);

// ------------------------------------------------------------------------------------------------ memory

export class MemoryKV implements KV {
  m = new Map<string, Entry>();
  constructor(
    private defaultTtlMs?: number,
    private now: () => number = Date.now,
  ) {}
  async get(key: string) {
    const e = this.m.get(key);
    if (!e) return null;
    if (e.exp !== null && e.exp <= this.now()) {
      this.m.delete(key);
      return null;
    }
    return structuredClone(e.v);
  }
  async set(key: string, value: unknown, ttlMs?: number) {
    this.m.set(key, { v: structuredClone(value), exp: expiry(this.now(), ttlMs ?? this.defaultTtlMs) });
    if (this.m.size > 10_000) {
      const t = this.now();
      for (const [k, e] of this.m) if (e.exp !== null && e.exp <= t) this.m.delete(k);
    }
  }
}

// ------------------------------------------------------------------------------------------------ files

/** One JSON file per namespace, rewritten atomically. For local work only (one process, little data). */
export class FileKV implements KV {
  private file: string;
  constructor(
    dir: string,
    namespace: string,
    private defaultTtlMs?: number,
    private now: () => number = Date.now,
  ) {
    mkdirSync(dir, { recursive: true });
    this.file = join(dir, `${namespace.replace(/[^\w-]/g, '_')}.json`);
  }
  private read(): Record<string, Entry> {
    try {
      const d = JSON.parse(readFileSync(this.file, 'utf8')) as unknown;
      return d && typeof d === 'object' ? (d as Record<string, Entry>) : {};
    } catch {
      return {};
    }
  }
  private write(d: Record<string, Entry>) {
    const tmp = `${this.file}.${process.pid}.tmp`;
    writeFileSync(tmp, JSON.stringify(d));
    renameSync(tmp, this.file);
  }
  async get(key: string) {
    const e = this.read()[key];
    if (!e || (e.exp !== null && e.exp <= this.now())) return null;
    return e.v ?? null;
  }
  async set(key: string, value: unknown, ttlMs?: number) {
    const t = this.now();
    const d = this.read();
    for (const [k, e] of Object.entries(d)) if (e.exp !== null && e.exp <= t) delete d[k];
    d[key] = { v: value, exp: expiry(t, ttlMs ?? this.defaultTtlMs) };
    this.write(d);
  }
}

// ------------------------------------------------------------------------------------------------ MySQL

/** The slice of a mysql2/promise pool this store uses (so tests can pass a fake). */
export interface SqlPool {
  execute(sql: string, params?: unknown[]): Promise<[unknown, unknown]>;
}

export const KV_TABLE = 'provident_kv';

export const CREATE_TABLE_SQL = `CREATE TABLE IF NOT EXISTS ${KV_TABLE} (
  ns VARCHAR(64) NOT NULL,
  k VARCHAR(255) NOT NULL,
  v LONGTEXT NOT NULL,
  expires_at BIGINT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (ns, k),
  KEY expires_idx (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`;

export class MySqlKV implements KV {
  private ready: Promise<void> | null = null;
  constructor(
    private pool: SqlPool,
    private namespace: string,
    private defaultTtlMs?: number,
    private now: () => number = Date.now,
  ) {}

  private ensure(): Promise<void> {
    this.ready ??= this.pool.execute(CREATE_TABLE_SQL).then(
      () => undefined,
      (e: unknown) => {
        this.ready = null; // try again on the next request
        throw e;
      },
    );
    return this.ready;
  }

  async get(key: string) {
    await this.ensure();
    const [rows] = await this.pool.execute(`SELECT v, expires_at FROM ${KV_TABLE} WHERE ns = ? AND k = ?`, [this.namespace, key]);
    const row = (rows as { v: string; expires_at: number | string | null }[])[0];
    if (!row) return null;
    if (row.expires_at !== null && Number(row.expires_at) <= this.now()) return null;
    try {
      return JSON.parse(row.v) as unknown;
    } catch {
      return null;
    }
  }

  async set(key: string, value: unknown, ttlMs?: number) {
    await this.ensure();
    const t = this.now();
    await this.pool.execute(
      `INSERT INTO ${KV_TABLE} (ns, k, v, expires_at) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE v = VALUES(v), expires_at = VALUES(expires_at)`,
      [this.namespace, key, JSON.stringify(value), expiry(t, ttlMs ?? this.defaultTtlMs)],
    );
    // Now and then, clear out expired rows so the table stays small.
    if (Math.random() < 0.02) {
      await this.pool.execute(`DELETE FROM ${KV_TABLE} WHERE expires_at IS NOT NULL AND expires_at <= ?`, [t]).catch(() => undefined);
    }
  }
}

// ------------------------------------------------------------------------------------------------ choosing

type Env = Record<string, string | undefined>;

export interface DbSettings {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
}

/** The database settings, or null when they are not all set. Host defaults to 127.0.0.1 (Hostinger: not "localhost"). */
export function readDbSettings(env: Env = process.env): DbSettings | null {
  const v = (k: string) => (env[k] ?? '').trim();
  const database = v('DB_NAME');
  const user = v('DB_USER');
  const password = env.DB_PASSWORD ?? '';
  if (!database || !user || !password) return null;
  const port = Number(v('DB_PORT') || 3306);
  return { host: v('DB_HOST') || '127.0.0.1', port: Number.isFinite(port) ? port : 3306, database, user, password };
}

let pool: { key: string; p: Promise<SqlPool> } | null = null;
const memories = new Map<string, MemoryKV>();
let warned = false;

function mysqlPool(db: DbSettings): Promise<SqlPool> {
  const key = `${db.host}:${db.port}/${db.database}/${db.user}`;
  if (!pool || pool.key !== key) {
    pool = {
      key,
      p: import('mysql2/promise').then((m) =>
        m.createPool({
          host: db.host,
          port: db.port,
          database: db.database,
          user: db.user,
          password: db.password,
          connectionLimit: 4,
          connectTimeout: 5000,
          enableKeepAlive: true,
        }) as unknown as SqlPool,
      ),
    };
  }
  return pool.p;
}

/**
 * A store that connects lazily (the pool is made on first use, not at import) and, when the database cannot be
 * reached, carries on with a memory store for that request instead of failing the page (the error kind is logged,
 * never the connection details).
 */
export class FallbackKV implements KV {
  private inner: Promise<KV> | null = null;
  constructor(
    private make: () => Promise<KV>,
    private fallback: KV,
    private log: (m: string) => void = (m) => console.warn(m),
  ) {}
  private store(): Promise<KV> {
    this.inner ??= this.make().catch((e: unknown) => {
      this.inner = null;
      throw e;
    });
    return this.inner;
  }
  private failed(e: unknown) {
    const code = e && typeof e === 'object' && 'code' in e ? String((e as { code: unknown }).code) : e instanceof Error ? e.name : 'unknown';
    this.log(`[kv] database unavailable (${code}): using memory for now`);
  }
  async get(key: string) {
    try {
      return await (await this.store()).get(key);
    } catch (e) {
      this.failed(e);
      return this.fallback.get(key);
    }
  }
  async set(key: string, value: unknown, ttlMs?: number) {
    try {
      await (await this.store()).set(key, value, ttlMs);
    } catch (e) {
      this.failed(e);
      await this.fallback.set(key, value, ttlMs);
    }
  }
}

function memoryFor(namespace: string, defaultTtlMs?: number): MemoryKV {
  let m = memories.get(namespace);
  if (!m) memories.set(namespace, (m = new MemoryKV(defaultTtlMs)));
  return m;
}

export type KVKind = 'mysql' | 'file' | 'memory';

export function kvKind(env: Env = process.env, dev = false): KVKind {
  if (readDbSettings(env)) return 'mysql';
  if ((env.KV_DIR ?? '').trim() || dev) return 'file';
  return 'memory';
}

/**
 * The store for one namespace. `dev` is true under `astro dev` (files in .data/kv unless a database is set).
 */
export function getKV(namespace: string, opts: { env?: Env; dev?: boolean; defaultTtlMs?: number } = {}): KV {
  const env = opts.env ?? process.env;
  const kind = kvKind(env, opts.dev ?? false);
  if (kind === 'mysql') {
    const db = readDbSettings(env)!;
    return new FallbackKV(async () => new MySqlKV(await mysqlPool(db), namespace, opts.defaultTtlMs), memoryFor(namespace, opts.defaultTtlMs));
  }
  if (kind === 'file') return new FileKV((env.KV_DIR ?? '').trim() || join(process.cwd(), '.data', 'kv'), namespace, opts.defaultTtlMs);
  if (!warned && !opts.dev && process.env.VITEST === undefined) {
    warned = true;
    console.warn('[kv] no database set (DB_NAME, DB_USER, DB_PASSWORD): using memory, which is forgotten on every restart');
  }
  return memoryFor(namespace, opts.defaultTtlMs);
}
