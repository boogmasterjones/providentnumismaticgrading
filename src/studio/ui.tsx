/** Small building blocks for Provident Studio: icons, buttons, sheets (panels), dialogs, toasts, empty states. */
import { useEffect, useId, useRef, type ReactNode } from 'react';

const paths: Record<string, ReactNode> = {
  edit: <path d="M14.5 3.5 20.5 9.5 9 21H3v-6zM12.5 5.5l6 6" />,
  coin: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="5.5" opacity=".6" />
    </>
  ),
  slides: (
    <>
      <rect x="3" y="5" width="18" height="12" rx="1.5" />
      <path d="m3 14 5-4 4 3 3-2 6 4M9 20h6" />
    </>
  ),
  journal: <path d="M5 3.5h11l3 3V20.5H5zM8.5 9h7M8.5 12.5h7M8.5 16h4.5" />,
  photo: (
    <>
      <rect x="3" y="4.5" width="18" height="15" rx="1.5" />
      <circle cx="9" cy="10" r="2" />
      <path d="m3.5 18 5.5-5 4 3.5 3-2.5 4.5 4" />
    </>
  ),
  info: <path d="M4 20V9.5L12 4l8 5.5V20zM9 20v-6h6v6M4 9.5h16" />,
  publish: <path d="M12 16V4m0 0L7 9m5-5 5 5M4.5 15v4.5h15V15" />,
  back: <path d="M15 5 8 12l7 7" />,
  close: <path d="M6 6l12 12M18 6 6 18" />,
  undo: <path d="M9 7 4 12l5 5M4.5 12H15a5 5 0 0 1 0 10h-2" />,
  up: <path d="M12 19V5M6 11l6-6 6 6" />,
  down: <path d="M12 5v14m-6-6 6 6 6-6" />,
  plus: <path d="M12 5v14M5 12h14" />,
  trash: <path d="M4.5 6.5h15M9.5 6.5V4h5v2.5M6.5 6.5l1 13.5h9l1-13.5" />,
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  eye: (
    <>
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  desktop: <path d="M3 4.5h18v12H3zM9 20.5h6M12 16.5v4" />,
  phone: <path d="M7.5 2.5h9v19h-9zM11 18.5h2" />,
  out: <path d="M14 4.5h5.5v15H14M10 8l-4 4 4 4M6 12h10" />,
  page: <path d="M6 3h8.5L19 7.5V21H6zM14 3v5h5" />,
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1" />
    </>
  ),
  upload: <path d="M12 15V4m0 0L7.5 8.5M12 4l4.5 4.5M4.5 14v5.5h15V14" />,
  external: <path d="M14 4h6v6M20 4l-9 9M18 14v6H4V6h6" />,
  alert: <path d="M12 3.5 2.5 20h19zM12 10v4.5M12 17.2v.3" />,
  grip: <path d="M9 6h.01M15 6h.01M9 12h.01M15 12h.01M9 18h.01M15 18h.01" />,
};

export function Icon({ name, size = 20, label }: { name: keyof typeof paths | string; size?: number; label?: string }) {
  return (
    <svg
      className="st-icon"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={label ? undefined : true}
      role={label ? 'img' : undefined}
      aria-label={label}
      focusable="false"
    >
      {paths[name] ?? null}
    </svg>
  );
}

type BtnProps = {
  children?: ReactNode;
  onClick?: () => void;
  kind?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'publish';
  icon?: string;
  type?: 'button' | 'submit';
  disabled?: boolean;
  busy?: boolean;
  title?: string;
  block?: boolean;
  small?: boolean;
  label?: string;
};

export function Button({ children, onClick, kind = 'secondary', icon, type = 'button', disabled, busy, title, block, small, label }: BtnProps) {
  return (
    <button
      type={type}
      className={`st-btn st-btn-${kind}${block ? ' st-btn-block' : ''}${small ? ' st-btn-small' : ''}${!children ? ' st-btn-icon' : ''}`}
      onClick={onClick}
      disabled={disabled || busy}
      title={title ?? label}
      aria-label={label}
      aria-busy={busy || undefined}
    >
      {busy ? <span className="st-spin" aria-hidden="true" /> : icon ? <Icon name={icon} size={small ? 16 : 18} /> : null}
      {children && <span>{children}</span>}
    </button>
  );
}

/** A side panel on large screens, a bottom sheet on phones. Escape closes; focus stays inside while open. */
export function Sheet({
  title,
  subtitle,
  onClose,
  children,
  footer,
  wide,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const id = useId();
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    const first = ref.current?.querySelector<HTMLElement>('input, textarea, select, [contenteditable="true"], button:not(.st-sheet-close)');
    (first ?? ref.current)?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
      if (e.key === 'Tab' && ref.current) trapFocus(e, ref.current);
    };
    document.addEventListener('keydown', onKey);
    document.body.classList.add('st-locked');
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.classList.remove('st-locked');
      prev?.focus?.();
    };
  }, [onClose]);
  return (
    <div className="st-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`st-sheet${wide ? ' st-sheet-wide' : ''}`} role="dialog" aria-modal="true" aria-labelledby={id} ref={ref} tabIndex={-1}>
        <header className="st-sheet-head">
          <div>
            <h2 id={id}>{title}</h2>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <button type="button" className="st-sheet-close" onClick={onClose} aria-label="Close">
            <Icon name="close" />
          </button>
        </header>
        <div className="st-sheet-body">{children}</div>
        {footer && <footer className="st-sheet-foot">{footer}</footer>}
      </div>
    </div>
  );
}

function trapFocus(e: KeyboardEvent, root: HTMLElement) {
  const items = [...root.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input, select, textarea, [contenteditable="true"], [tabindex]:not([tabindex="-1"])')].filter(
    (el) => el.offsetParent !== null,
  );
  if (!items.length) return;
  const first = items[0];
  const last = items[items.length - 1];
  if (e.shiftKey && document.activeElement === first) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault();
    first.focus();
  }
}

export interface ConfirmOptions {
  title: string;
  body?: ReactNode;
  confirm: string;
  cancel?: string;
  danger?: boolean;
}

export function ConfirmDialog({ o, onDone }: { o: ConfirmOptions; onDone: (ok: boolean) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const id = useId();
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    ref.current?.querySelector<HTMLElement>('[data-default]')?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onDone(false);
      }
      if (e.key === 'Tab' && ref.current) trapFocus(e, ref.current);
    };
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('keydown', onKey, true);
      prev?.focus?.();
    };
  }, [onDone]);
  return (
    <div className="st-overlay st-overlay-center">
      <div className="st-dialog" role="alertdialog" aria-modal="true" aria-labelledby={id} ref={ref}>
        {o.danger && (
          <div className="st-dialog-icon">
            <Icon name="alert" size={22} />
          </div>
        )}
        <h2 id={id}>{o.title}</h2>
        {o.body && <div className="st-dialog-body">{o.body}</div>}
        <div className="st-dialog-actions">
          <button type="button" className="st-btn st-btn-secondary" onClick={() => onDone(false)} data-default={o.danger ? '' : undefined}>
            {o.cancel ?? 'Cancel'}
          </button>
          <button type="button" className={`st-btn ${o.danger ? 'st-btn-danger' : 'st-btn-primary'}`} onClick={() => onDone(true)} data-default={o.danger ? undefined : ''}>
            {o.confirm}
          </button>
        </div>
      </div>
    </div>
  );
}

export interface Toast {
  id: number;
  text: string;
  kind: 'ok' | 'error' | 'info';
  action?: { label: string; run: () => void };
}

export function Toasts({ toasts, dismiss }: { toasts: Toast[]; dismiss: (id: number) => void }) {
  return (
    <div className="st-toasts" aria-live="polite" aria-atomic="false">
      {toasts.map((t) => (
        <div key={t.id} className={`st-toast st-toast-${t.kind}`} role={t.kind === 'error' ? 'alert' : 'status'}>
          <Icon name={t.kind === 'error' ? 'alert' : t.kind === 'ok' ? 'check' : 'info'} size={18} />
          <span>{t.text}</span>
          {t.action && (
            <button
              type="button"
              className="st-toast-action"
              onClick={() => {
                t.action!.run();
                dismiss(t.id);
              }}
            >
              {t.action.label}
            </button>
          )}
          <button type="button" className="st-toast-close" onClick={() => dismiss(t.id)} aria-label="Dismiss">
            <Icon name="close" size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}

export function Empty({ icon, title, children, action }: { icon: string; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="st-empty">
      <div className="st-empty-mark">
        <Icon name={icon} size={30} />
      </div>
      <h3>{title}</h3>
      {children && <p>{children}</p>}
      {action}
    </div>
  );
}

export function Loading({ text = 'Loading…' }: { text?: string }) {
  return (
    <div className="st-loading" role="status">
      <span className="st-spin" aria-hidden="true" />
      {text}
    </div>
  );
}

export function PageHead({ title, lead, back, actions }: { title: string; lead?: ReactNode; back?: boolean; actions?: ReactNode }) {
  return (
    <header className="st-pagehead">
      {back && (
        <a className="st-back" href="#/">
          <Icon name="back" size={16} /> Dashboard
        </a>
      )}
      <div className="st-pagehead-row">
        <div>
          <h1>{title}</h1>
          {lead && <p className="st-lead">{lead}</p>}
        </div>
        {actions && <div className="st-pagehead-actions">{actions}</div>}
      </div>
    </header>
  );
}

export const fmtDate = (s: string) => {
  const d = new Date(`${s}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? s : d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
};
