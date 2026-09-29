import { useEffect, useState } from 'react';
import { statusClass, initials } from '../lib/format.js';
import { assetUrl } from '../lib/config.js';

// ---------------------------------------------------------------- feedback

export function Spinner({ className = 'h-5 w-5' }) {
  return (
    <svg className={`animate-spin text-brand-600 ${className}`} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  );
}

export function Loading({ label = 'Loading…', className = 'py-16' }) {
  return (
    <div className={`flex flex-col items-center justify-center gap-3 text-slate-500 ${className}`}>
      <Spinner className="h-7 w-7" />
      <span className="text-sm">{label}</span>
    </div>
  );
}

export function ErrorState({ message, onRetry }) {
  return (
    <div className="card-pad flex flex-col items-center gap-3 py-12 text-center">
      <div className="grid h-11 w-11 place-items-center rounded-full bg-rose-100 text-xl text-rose-600">!</div>
      <p className="text-sm font-medium text-slate-700">{message || 'Something went wrong'}</p>
      {onRetry && <button className="btn-ghost btn-sm" onClick={onRetry}>Try again</button>}
    </div>
  );
}

export function EmptyState({ title = 'Nothing here yet', hint, action }) {
  return (
    <div className="flex flex-col items-center gap-2 py-14 text-center">
      <div className="grid h-12 w-12 place-items-center rounded-xl bg-slate-100 text-slate-400">
        <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 7h16M4 12h10M4 17h7" />
        </svg>
      </div>
      <p className="font-medium text-slate-700">{title}</p>
      {hint && <p className="max-w-sm text-sm text-slate-500">{hint}</p>}
      {action}
    </div>
  );
}

// ---------------------------------------------------------------- primitives

export const Badge = ({ children, tone }) => (
  <span className={`chip ${tone || statusClass(children)}`}>{children ?? '—'}</span>
);

export function Avatar({ name, url, size = 'h-8 w-8' }) {
  // Avatars may be an uploaded path or an external URL; assetUrl handles both.
  if (url) return <img src={assetUrl(url)} alt={name} className={`${size} rounded-full object-cover`} />;
  return (
    <span className={`${size} grid shrink-0 place-items-center rounded-full bg-brand-100 text-xs font-semibold text-brand-700`}>
      {initials(name)}
    </span>
  );
}

export function PageHeader({ title, subtitle, actions, breadcrumb }) {
  return (
    <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {breadcrumb && <p className="mb-1 text-xs font-medium text-slate-400">{breadcrumb}</p>}
        <h1 className="text-xl font-semibold tracking-tight text-slate-900">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/**
 * `required` renders the asterisk, so mandatory fields are marked consistently
 * everywhere instead of each caller appending " *" to its own label — which is
 * how several modules ended up with no indicator at all.
 */
export function Field({ label, children, error, hint, required, className = '' }) {
  return (
    <label className={`block ${className}`}>
      <span className="label">
        {label}
        {required && <span className="ml-0.5 font-semibold text-rose-600" title="Required" aria-hidden="true">*</span>}
        {required && <span className="sr-only"> (required)</span>}
      </span>
      {children}
      {hint && !error && <span className="mt-1 block text-xs text-slate-400">{hint}</span>}
      {error && <span className="mt-1 block text-xs text-rose-600">{error}</span>}
    </label>
  );
}

// Form controls live in inputs.jsx; re-exported here so every screen keeps
// importing its widgets from one place.
export { Select, MultiSelect, UserSelect, DatePicker, DateRangePicker } from './inputs.jsx';

// ---------------------------------------------------------------- overlays

export function Modal({ open, onClose, title, children, footer, width = 'max-w-2xl' }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4 backdrop-blur-sm sm:p-8">
      <div className="absolute inset-0" onClick={onClose} aria-hidden="true" />
      <div className={`relative z-10 my-4 w-full ${width} rounded-2xl bg-white shadow-2xl`} role="dialog" aria-modal="true">
        <header className="flex items-center justify-between border-b border-slate-200 px-5 py-3.5">
          <h2 className="text-base font-semibold text-slate-900">{title}</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600" aria-label="Close">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </header>
        <div className="max-h-[70vh] overflow-y-auto px-5 py-4">{children}</div>
        {footer && <footer className="flex justify-end gap-2 border-t border-slate-200 px-5 py-3.5">{footer}</footer>}
      </div>
    </div>
  );
}

export function Drawer({ open, onClose, title, children, footer }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40 backdrop-blur-sm">
      <div className="absolute inset-0" onClick={onClose} aria-hidden="true" />
      <aside className="relative z-10 flex h-full w-full max-w-xl flex-col bg-white shadow-2xl">
        <header className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <h2 className="text-base font-semibold text-slate-900">{title}</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100" aria-label="Close">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </header>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <footer className="flex justify-end gap-2 border-t border-slate-200 px-5 py-3.5">{footer}</footer>}
      </aside>
    </div>
  );
}

export function ConfirmDialog({ open, onClose, onConfirm, title = 'Are you sure?', message, confirmLabel = 'Confirm', danger }) {
  const [busy, setBusy] = useState(false);
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      width="max-w-md"
      footer={
        <>
          <button className="btn-ghost" onClick={onClose} disabled={busy}>Cancel</button>
          <button
            className={danger ? 'btn-danger' : 'btn-primary'}
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try { await onConfirm(); onClose(); } finally { setBusy(false); }
            }}
          >
            {busy ? 'Working…' : confirmLabel}
          </button>
        </>
      }
    >
      <p className="text-sm text-slate-600">{message}</p>
    </Modal>
  );
}

// ---------------------------------------------------------------- data display

/**
 * `fill` spreads the tabs across the full width in equal columns, for a bar
 * that is the screen's primary navigation. Left off, tabs size to their labels
 * — stretching two tabs across a whole page would look odd.
 */
export function Tabs({ tabs, active, onChange, fill = false }) {
  return (
    <div className={`mb-4 flex overflow-x-auto border-b border-slate-200 ${fill ? '' : 'gap-1'}`}>
      {tabs.map((tab) => {
        const key = typeof tab === 'string' ? tab : tab.key;
        const label = typeof tab === 'string' ? tab : tab.label;
        const count = typeof tab === 'object' ? tab.count : undefined;
        return (
          <button
            key={key}
            onClick={() => onChange(key)}
            className={`whitespace-nowrap border-b-2 px-3.5 py-2.5 text-sm font-medium transition ${
              // basis-0 + grow gives every tab an equal share; min-w-max stops a
              // long label being squeezed, so the bar scrolls instead of clipping.
              fill ? 'grow basis-0 min-w-max text-center' : ''
            } ${
              active === key
                ? 'border-brand-600 text-brand-700'
                : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700'
            }`}
          >
            {label}
            {count != null && <span className="ml-1.5 rounded-full bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600">{count}</span>}
          </button>
        );
      })}
    </div>
  );
}

export function Pagination({ meta, onPage }) {
  if (!meta || meta.totalPages <= 1) return null;
  const { page, totalPages, total, limit } = meta;
  const from = (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);

  return (
    <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3 text-sm">
      <p className="text-slate-500">
        Showing <span className="font-medium text-slate-700">{from}–{to}</span> of{' '}
        <span className="font-medium text-slate-700">{total}</span>
      </p>
      <div className="flex items-center gap-1">
        <button className="btn-ghost btn-sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>Previous</button>
        <span className="px-2 text-slate-500">Page {page} of {totalPages}</span>
        <button className="btn-ghost btn-sm" disabled={page >= totalPages} onClick={() => onPage(page + 1)}>Next</button>
      </div>
    </div>
  );
}

/** `className` overrides the default width — pass `w-full` inside narrow panes. */
export function SearchInput({ value, onChange, placeholder = 'Search…', className = 'w-full sm:w-64' }) {
  return (
    <div className={`relative ${className}`}>
      <svg className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path strokeLinecap="round" d="M21 21l-4.3-4.3M17 11a6 6 0 11-12 0 6 6 0 0112 0z" />
      </svg>
      <input className="input pl-9" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
    </div>
  );
}

/** Definition list used across every detail screen. */
export function DetailGrid({ items, columns = 'sm:grid-cols-2 lg:grid-cols-3' }) {
  return (
    <dl className={`grid grid-cols-1 gap-x-6 gap-y-4 ${columns}`}>
      {items.filter(Boolean).map(({ label, value }) => (
        <div key={label}>
          <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</dt>
          <dd className="mt-1 text-sm text-slate-800">{value ?? '—'}</dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * `message` is either a string (success by default) or `{ text, tone }`.
 * The object form matters: failures were being pushed through the same toast as
 * confirmations, so an error announced itself in success green.
 */
export function Toast({ message, tone, onDismiss }) {
  const isObject = !!message && typeof message === 'object';
  const text = isObject ? message.text : message;
  const kind = (isObject && message.tone) || tone || 'success';

  useEffect(() => {
    if (!text) return;
    // Errors stay long enough to read and copy.
    const timer = setTimeout(() => onDismiss?.(), kind === 'error' ? 6000 : 3500);
    return () => clearTimeout(timer);
  }, [text, kind, onDismiss]);

  if (!text) return null;

  const tones = {
    success: { bg: 'bg-emerald-600', icon: 'M5 13l4 4L19 7' },
    error: { bg: 'bg-rose-600', icon: 'M12 9v4m0 4h.01M10.3 3.9L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z' },
    warning: { bg: 'bg-amber-500', icon: 'M12 9v4m0 4h.01M10.3 3.9L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z' },
    info: { bg: 'bg-slate-800', icon: 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
  };
  const { bg, icon } = tones[kind] || tones.success;

  return (
    <div
      role={kind === 'error' ? 'alert' : 'status'}
      className={`fixed bottom-6 left-1/2 z-[60] flex max-w-[90vw] -translate-x-1/2 items-start gap-2 rounded-lg px-4 py-2.5 text-sm font-medium text-white shadow-lg ${bg}`}
    >
      <svg className="mt-0.5 h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d={icon} />
      </svg>
      <span>{text}</span>
    </div>
  );
}

/** Marks a toast payload as a failure. */
export const errorToast = (err) => ({ text: typeof err === 'string' ? err : err?.message || 'Something went wrong', tone: 'error' });

/** Small helper for tables: renders a sortable column header. */
export function SortableTh({ field, sort, onSort, children, className = '' }) {
  const active = sort === field || sort === `-${field}`;
  const desc = sort === `-${field}`;
  return (
    <th className={`th cursor-pointer select-none hover:text-slate-700 ${className}`} onClick={() => onSort(field)}>
      <span className="inline-flex items-center gap-1">
        {children}
        {active && <span className="text-brand-600">{desc ? '↓' : '↑'}</span>}
      </span>
    </th>
  );
}
