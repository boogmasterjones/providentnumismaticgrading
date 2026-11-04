/**
 * Where Studio reads and writes the website's files.
 *
 * - LocalStore (development): the files in this folder, directly. "Changes since the last publish" are what git
 *   shows as changed against the last commit; Publish is simulated (it lists the changes and the diff).
 * - GitHubStore (production): the client's GitHub repository through the GitHub API, with a GitHub App installation
 *   token held server-side. Edits are commits on a drafts branch; Publish merges drafts into the live branch, so
 *   Netlify builds once per publish.
 *
 * Only paths that pass `assertWritable` (content files and photos in public/images) can ever be written.
 */

export interface Change {
  path: string;
  status: 'added' | 'modified' | 'deleted';
}

export interface PublishResult {
  published: boolean;
  /** local mode: nothing was published, this is what would have been */
  simulated: boolean;
  changes: Change[];
  /** local mode: a unified diff of the content changes */
  diff?: string;
  commit?: string;
}

export interface ContentStore {
  readonly mode: 'local' | 'github';
  /** the draft version of a text file, or null when it does not exist */
  read(path: string): Promise<string | null>;
  readBinary(path: string): Promise<Uint8Array | null>;
  /** every file under a folder (recursive), draft version, as repository paths */
  list(dir: string): Promise<string[]>;
  write(path: string, content: string | Uint8Array, message: string): Promise<void>;
  remove(path: string, message: string): Promise<void>;
  /** the published (live) version of a text file, or null */
  readPublished(path: string): Promise<string | null>;
  /** files that differ between the drafts and what is live */
  changes(): Promise<Change[]>;
  /** put one file back the way it is live */
  undo(path: string): Promise<void>;
  /** put everything back the way it is live */
  undoAll(): Promise<void>;
  publish(message: string): Promise<PublishResult>;
}

export class StoreError extends Error {
  constructor(
    message: string,
    public status = 500,
  ) {
    super(message);
  }
}

/** Folders Studio may read and list. */
export const READ_ROOTS = ['content/', 'public/images/'] as const;

const CONTENT_FILE =
  /^content\/(?:(?:settings|faq|gallery)\.json|pages\/[a-z0-9-]{1,60}\.mdoc|notable\/[a-z0-9-]{1,80}\.json|blog\/[a-z0-9-]{1,100}\.mdoc)$/;
const IMAGE_FILE = /^public\/images\/(?:home|notable|blog|gallery|pages)\/[a-z0-9][a-z0-9._-]{0,120}\.(?:webp|jpe?g|png)$/;

/** May Studio write (or delete) this repository path? Content files and photos only; never code or settings. */
export function isWritable(path: string): boolean {
  if (typeof path !== 'string' || path.includes('..') || path.includes('\\') || path.includes('//')) return false;
  return CONTENT_FILE.test(path) || IMAGE_FILE.test(path);
}

export function assertWritable(path: string): void {
  if (!isWritable(path)) throw new StoreError(`That file can't be changed from Studio.`, 400);
}

export function isReadable(path: string): boolean {
  if (typeof path !== 'string' || path.includes('..') || path.includes('\\') || path.includes('//')) return false;
  return READ_ROOTS.some((r) => path.startsWith(r));
}

export function assertReadable(path: string): void {
  if (!isReadable(path)) throw new StoreError(`That file can't be read from Studio.`, 400);
}

/** Is a path one Studio tracks for "what's changed"? */
export const isTracked = (path: string) => isReadable(path);
