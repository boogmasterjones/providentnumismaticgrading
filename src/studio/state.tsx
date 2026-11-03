/**
 * Studio-wide state: the overview (pages, posts, coins, unpublished changes), toasts, confirmations and the
 * "Undo last change" history. History entries hold each changed file's text from before the change, so an undo
 * puts exactly that back (kept for this browser tab only).
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { api, ApiError, setMode, type Overview } from './api';
import { ConfirmDialog, Toasts, type ConfirmOptions, type Toast } from './ui';
import type { SaveResult } from '../lib/studio/service';

export interface HistoryEntry {
  label: string;
  items: { file: string; before: string | null }[];
  at: number;
}

interface Ctx {
  overview: Overview | null;
  refresh: () => Promise<void>;
  toast: (text: string, kind?: Toast['kind'], action?: Toast['action']) => void;
  confirm: (o: ConfirmOptions) => Promise<boolean>;
  /** remember a save so it can be undone; shows a "Saved" toast with Undo */
  saved: (label: string, r: SaveResult | SaveResult[], opts?: { quiet?: boolean }) => void;
  history: HistoryEntry[];
  undoLast: () => Promise<boolean>;
  /** drop undo steps for these files (all when none given), after they were put back to the live version */
  forget: (files?: string[]) => void;
  /** show an API error in a toast */
  fail: (e: unknown) => void;
  /** bumped whenever content changed, so views can reload */
  version: number;
  bump: () => void;
}

const StudioCtx = createContext<Ctx | null>(null);
export const useStudio = () => {
  const c = useContext(StudioCtx);
  if (!c) throw new Error('Studio context missing');
  return c;
};

const HISTORY_KEY = 'provident-studio-history';
const loadHistory = (): HistoryEntry[] => {
  try {
    return JSON.parse(sessionStorage.getItem(HISTORY_KEY) ?? '[]') as HistoryEntry[];
  } catch {
    return [];
  }
};

export function StudioProvider({ children }: { children: ReactNode }) {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [dialog, setDialog] = useState<{ o: ConfirmOptions; resolve: (ok: boolean) => void } | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>(loadHistory);
  const [version, setVersion] = useState(0);
  const tid = useRef(0);

  useEffect(() => {
    try {
      sessionStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(-30)));
    } catch {
      /* storage full or private mode: undo still works until reload */
    }
  }, [history]);

  const dismiss = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);
  const toast = useCallback(
    (text: string, kind: Toast['kind'] = 'ok', action?: Toast['action']) => {
      const id = ++tid.current;
      setToasts((t) => [...t.slice(-3), { id, text, kind, action }]);
      setTimeout(() => dismiss(id), kind === 'error' ? 9000 : action ? 7000 : 3500);
    },
    [dismiss],
  );

  const refresh = useCallback(async () => {
    try {
      const o = await api.overview();
      setMode(o.mode);
      setOverview(o);
    } catch (e) {
      if (!(e instanceof ApiError && e.status === 401)) toast(e instanceof Error ? e.message : 'Could not load Studio.', 'error');
    }
  }, [toast]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const confirm = useCallback((o: ConfirmOptions) => new Promise<boolean>((resolve) => setDialog({ o, resolve })), []);
  const fail = useCallback((e: unknown) => toast(e instanceof Error ? e.message : 'Something went wrong.', 'error'), [toast]);
  const bump = useCallback(() => setVersion((v) => v + 1), []);

  const undoLast = useCallback(async () => {
    const last = history[history.length - 1];
    if (!last) return false;
    try {
      for (const it of [...last.items].reverse()) await api.restore(it.file, it.before);
      setHistory((h) => h.slice(0, -1));
      dispatchEvent(new Event('studio-undo')); // the visual editor reloads its page
      toast(`Undone: ${last.label}`, 'info');
      bump();
      void refresh();
      return true;
    } catch (e) {
      fail(e);
      return false;
    }
  }, [history, toast, bump, refresh, fail]);

  const forget = useCallback((files?: string[]) => {
    setHistory((h) => (files ? h.filter((e) => !e.items.some((i) => files.includes(i.file))) : []));
  }, []);

  const undoRef = useRef(undoLast);
  undoRef.current = undoLast;

  const saved = useCallback(
    (label: string, r: SaveResult | SaveResult[], opts: { quiet?: boolean } = {}) => {
      const items = (Array.isArray(r) ? r : [r]).map((x) => ({ file: x.file, before: x.before }));
      if (items.length) setHistory((h) => [...h.slice(-29), { label, items, at: Date.now() }]);
      if (!opts.quiet) toast(`Saved: ${label}. Not live until you publish.`, 'ok', { label: 'Undo', run: () => void undoRef.current() });
      bump();
      void refresh();
    },
    [toast, bump, refresh],
  );

  const value = useMemo(
    () => ({ overview, refresh, toast, confirm, saved, history, undoLast, forget, fail, version, bump }),
    [overview, refresh, toast, confirm, saved, history, undoLast, forget, fail, version, bump],
  );

  return (
    <StudioCtx.Provider value={value}>
      {children}
      <Toasts toasts={toasts} dismiss={dismiss} />
      {dialog && (
        <ConfirmDialog
          o={dialog.o}
          onDone={(ok) => {
            dialog.resolve(ok);
            setDialog(null);
          }}
        />
      )}
    </StudioCtx.Provider>
  );
}
