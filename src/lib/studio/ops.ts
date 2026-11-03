/**
 * Pure helpers for editing content data: read/write a value at a dotted path, list operations, slugs, validation.
 * No Node or browser APIs, so they run (and are tested) anywhere.
 */
import { fieldAt, splitPath, type DocType, type Field } from './schema';

export type Data = Record<string, unknown>;

export class EditError extends Error {
  constructor(
    message: string,
    public status = 400,
    public details: FieldProblem[] = [],
  ) {
    super(message);
  }
}

export function getAt(data: unknown, path: string): unknown {
  let cur: unknown = data;
  for (const p of splitPath(path)) {
    if (cur == null || typeof cur !== 'object') return undefined;
    cur = (cur as Record<string | number, unknown>)[p];
  }
  return cur;
}

/** A copy of `data` with the value at `path` replaced (objects and lists on the way are created as needed). */
export function setAt<T>(data: T, path: string, value: unknown): T {
  const parts = splitPath(path);
  if (parts.length === 0) return value as T;
  const root = structuredClone(data ?? {}) as Record<string | number, unknown>;
  let cur: Record<string | number, unknown> = root;
  for (let i = 0; i < parts.length - 1; i++) {
    const p = parts[i];
    const next = cur[p];
    if (next == null || typeof next !== 'object') {
      cur[p] = typeof parts[i + 1] === 'number' ? [] : {};
    }
    cur = cur[p] as Record<string | number, unknown>;
  }
  const last = parts[parts.length - 1];
  if (Array.isArray(cur) && typeof last === 'number' && last > cur.length) throw new EditError('That item no longer exists.');
  cur[last] = value;
  return root as T;
}

export type ListOp = 'add' | 'remove' | 'up' | 'down';

/**
 * Change a list inside `data`: add an item after `index` (or at the end when index is -1), remove the item at
 * `index`, or move it one place up or down.
 */
export function listOp(data: Data, path: string, op: ListOp, index: number, item?: unknown): Data {
  const current = getAt(data, path);
  const list = Array.isArray(current) ? [...current] : [];
  if (op !== 'add' && (index < 0 || index >= list.length)) throw new EditError('That item no longer exists. Reload and try again.');
  if (op === 'add') {
    const at = index < 0 || index >= list.length ? list.length : index + 1;
    list.splice(at, 0, item);
  } else if (op === 'remove') {
    list.splice(index, 1);
  } else {
    const to = op === 'up' ? index - 1 : index + 1;
    if (to < 0 || to >= list.length) return data;
    [list[index], list[to]] = [list[to], list[index]];
  }
  return setAt(data, path, list);
}

/** "1909-S VDB Lincoln cent!" -> "1909-s-vdb-lincoln-cent". */
export function slugify(s: string, max = 60): string {
  const slug = s
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, max)
    .replace(/-+$/g, '');
  return slug || 'item';
}

/** The first of slug, slug-2, slug-3… not in `taken`. */
export function uniqueSlug(base: string, taken: Iterable<string>): string {
  const set = new Set(taken);
  if (!set.has(base)) return base;
  for (let i = 2; ; i++) if (!set.has(`${base}-${i}`)) return `${base}-${i}`;
}

// ------------------------------------------------------------------------------------------------ validation

export interface FieldProblem {
  path: string;
  message: string;
}

const IMAGE_PATH = /^\/images\/(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9][A-Za-z0-9._-]*\.(?:webp|jpe?g|png|gif|avif)$/;
const EMAIL = /^[^\s@[\]]+@[^\s@[\]]+\.[^\s@[\]]+$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

export function isSafeImagePath(s: string): boolean {
  return IMAGE_PATH.test(s) && !s.includes('..');
}

export function isWebUrl(s: string): boolean {
  try {
    const u = new URL(s);
    return (u.protocol === 'https:' || u.protocol === 'http:') && Boolean(u.hostname.includes('.'));
  } catch {
    return false;
  }
}

const empty = (v: unknown) => v === undefined || v === null || (typeof v === 'string' && v.trim() === '');

function checkField(f: Field, v: unknown, path: string, out: FieldProblem[]) {
  const name = f.label;
  if (f.required && empty(v) && f.kind !== 'bool' && f.kind !== 'list' && f.kind !== 'object') {
    out.push({ path, message: `${name} can't be empty.` });
    return;
  }
  if (v === undefined || v === null) return;
  switch (f.kind) {
    case 'line':
    case 'text': {
      if (typeof v !== 'string') return void out.push({ path, message: `${name} must be text.` });
      if (f.max && v.length > f.max) out.push({ path, message: `${name} is too long: ${v.length} characters, the limit is ${f.max}.` });
      if (f.kind === 'line' && /[\r\n]/.test(v)) out.push({ path, message: `${name} must be a single line.` });
      if (f.kind === 'line' && f.email && v.trim() && !EMAIL.test(v.trim())) out.push({ path, message: `${name} doesn't look like an email address.` });
      return;
    }
    case 'rich':
      if (typeof v !== 'string') out.push({ path, message: `${name} must be text.` });
      else if (v.length > 200_000) out.push({ path, message: `${name} is too long.` });
      return;
    case 'image':
      if (typeof v !== 'string') return void out.push({ path, message: `${name} must be a photo.` });
      if (v && !isSafeImagePath(v)) out.push({ path, message: `${name}: that photo address isn't allowed.` });
      return;
    case 'bool':
      if (typeof v !== 'boolean') out.push({ path, message: `${name} must be on or off.` });
      return;
    case 'select':
      if (v === '' && !f.required) return;
      if (!f.options.some((o) => o.value === v)) out.push({ path, message: `${name}: choose one of the options.` });
      return;
    case 'date': {
      const s = v instanceof Date ? v.toISOString().slice(0, 10) : v;
      if (typeof s !== 'string' || !DATE.test(s) || Number.isNaN(Date.parse(s))) out.push({ path, message: `${name} must be a date.` });
      return;
    }
    case 'url':
      if (typeof v !== 'string' || (v && !isWebUrl(v))) out.push({ path, message: `${name} must be a web address starting with https://` });
      return;
    case 'number':
      if (typeof v !== 'number' || !Number.isFinite(v)) return void out.push({ path, message: `${name} must be a number.` });
      if (f.min !== undefined && v < f.min) out.push({ path, message: `${name} must be at least ${f.min}.` });
      if (f.max !== undefined && v > f.max) out.push({ path, message: `${name} must be at most ${f.max}.` });
      return;
    case 'list':
      if (!Array.isArray(v)) return void out.push({ path, message: `${name} must be a list.` });
      if (f.maxItems && v.length > f.maxItems) out.push({ path, message: `${name}: ${f.maxItems} at most.` });
      v.forEach((item, i) => checkField(f.item, item, `${path}.${i}`, out));
      return;
    case 'object':
      if (typeof v !== 'object' || Array.isArray(v)) return void out.push({ path, message: `${name} has the wrong shape.` });
      for (const [k, sub] of Object.entries(f.fields)) checkField(sub, (v as Data)[k], path ? `${path}.${k}` : k, out);
      return;
  }
}

/** Every problem with a document's data (and body), against its registry entry. Unknown keys are left alone. */
export function validateDoc(type: DocType, data: Data, body?: string): FieldProblem[] {
  const out: FieldProblem[] = [];
  for (const [k, f] of Object.entries(type.fields)) {
    if (k === 'body' && type.hasBody) {
      checkField(f, body ?? '', 'body', out);
      continue;
    }
    checkField(f, data[k], k, out);
  }
  return out;
}

/** Tidy a value typed into a field before it is stored (single lines stay single, text keeps paragraph breaks). */
export function cleanValue(f: Field | null, v: unknown): unknown {
  if (!f || typeof v !== 'string') return v;
  if (f.kind === 'line') return v.replace(/\s*[\r\n]+\s*/g, ' ').replace(/ /g, ' ').trim();
  if (f.kind === 'text') {
    return v
      .replace(/\r\n?/g, '\n')
      .replace(/ /g, ' ')
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }
  if (f.kind === 'rich') return v.replace(/\r\n?/g, '\n').replace(/\s+$/, '') + '\n';
  return v;
}

/** The field at `path`, with a readable error when there is none. */
export function requireField(type: DocType, path: string): Field {
  const f = path === 'body' && type.hasBody ? type.fields.body : fieldAt(type, path);
  if (!f) throw new EditError(`"${path}" can't be edited.`);
  return f;
}

/**
 * The problems a save would introduce: like validateDoc, but values that were already stored unchanged are let
 * through (older text that predates a limit is fixed when someone edits it, not forced on every save).
 */
export function newProblems(type: DocType, before: { data: Data; body?: string } | null, data: Data, body?: string): FieldProblem[] {
  const all = validateDoc(type, data, body);
  if (!before) return all;
  return all.filter((p) =>
    p.path === 'body'
      ? (before.body ?? '').trim() !== (body ?? '').trim()
      : JSON.stringify(getAt(before.data, p.path) ?? null) !== JSON.stringify(getAt(data, p.path) ?? null),
  );
}
