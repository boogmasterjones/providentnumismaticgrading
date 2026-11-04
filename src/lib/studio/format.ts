/**
 * Reading and writing the content files in exactly the formats the site builds from (and Keystatic writes):
 * - .json: 2-space JSON and a final newline;
 * - .mdoc: YAML front matter between "---" lines (js-yaml, like Keystatic), then the Markdoc body.
 */
import { dump, load } from 'js-yaml';
import type { Data } from './ops';

export interface ParsedFile {
  data: Data;
  /** Markdoc body (only for .mdoc files) */
  body: string;
}

/** YAML dates (2026-11-02) come back as Date objects; the files and forms use the plain "YYYY-MM-DD" text. */
function undate(v: unknown): unknown {
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (Array.isArray(v)) return v.map(undate);
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, undate(x)]));
  return v;
}

/** Leave out empty optional values, the way Keystatic does, so files stay tidy. */
function prune(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(prune);
  if (v && typeof v === 'object') {
    const out: Data = {};
    for (const [k, x] of Object.entries(v)) {
      if (x === undefined || x === null) continue;
      out[k] = prune(x);
    }
    return out;
  }
  return v;
}

export function parseFile(path: string, text: string): ParsedFile {
  const t = text.replace(/^﻿/, '').replace(/\r\n?/g, '\n');
  if (path.endsWith('.json')) {
    const data = JSON.parse(t) as unknown;
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error(`${path}: expected an object`);
    return { data: data as Data, body: '' };
  }
  if (path.endsWith('.mdoc')) {
    const m = t.match(/^---\n([\s\S]*?)\n?---(?:\n|$)([\s\S]*)$/);
    if (!m) return { data: {}, body: t };
    const fm = load(m[1]);
    const data = fm && typeof fm === 'object' && !Array.isArray(fm) ? (undate(fm) as Data) : {};
    return { data, body: m[2] };
  }
  throw new Error(`${path}: not a content file`);
}

export function serializeFile(path: string, data: Data, body = ''): string {
  const clean = prune(data) as Data;
  if (path.endsWith('.json')) return JSON.stringify(clean, null, 2) + '\n';
  if (path.endsWith('.mdoc')) {
    const b = body.replace(/\r\n?/g, '\n').replace(/^\n+/, '');
    // No line wrapping: one-line text stays on one line and paragraphs become readable "|-" blocks. Dates are written
    // bare (date: 2026-11-02), as Keystatic does.
    const yaml = dump(clean, { lineWidth: -1 }).replace(/^(\s*date): '(\d{4}-\d{2}-\d{2})'$/gm, '$1: $2');
    return `---\n${yaml}---\n${b.trim() ? b.replace(/\s*$/, '\n') : ''}`;
  }
  throw new Error(`${path}: not a content file`);
}
