import { useEffect, useRef, useState } from 'react';
import { api } from '../lib/api.js';
import { Spinner } from './ui.jsx';

/**
 * Download picker for a table.
 *
 * Rendering happens on the server so every format shares one implementation and
 * — for a list screen — the whole filtered result set is exported rather than
 * the page currently on screen.
 *
 * Either give it `path` + `params` (a module's /export endpoint) or `rows`
 * (a table the client already holds, such as a report breakdown).
 */
const ALL_FORMATS = {
  xlsx: { label: 'Excel', hint: '.xlsx' },
  docx: { label: 'Word', hint: '.docx' },
  pdf: { label: 'PDF', hint: '.pdf' },
  csv: { label: 'CSV', hint: '.csv' },
  html: { label: 'HTML', hint: '.html' },
  txt: { label: 'Text', hint: '.txt' },
  json: { label: 'JSON', hint: '.json' },
  ics: { label: 'Calendar', hint: '.ics' },
};

// `ics` is opt-in: it is only meaningful for rows that carry a date and time.
const DEFAULT_FORMATS = ['xlsx', 'docx', 'pdf', 'csv', 'html', 'txt', 'json'];

export default function ExportMenu({
  path, params, rows, columns, title, filename, disabled, onError,
  label = 'Export', formats = DEFAULT_FORMATS,
}) {
  const choices = formats.map((k) => ({ key: k, ...ALL_FORMATS[k] })).filter((f) => f.label);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState('');
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const away = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    const esc = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', away);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', away); document.removeEventListener('keydown', esc); };
  }, [open]);

  const run = async (format) => {
    setBusy(format);
    // Only used if the server's Content-Disposition cannot be read (a proxy
    // that drops the header); normally the server's name wins.
    const fallback = `${String(filename || title || 'export').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
      || 'export'}-${new Date().toISOString().slice(0, 10)}.${format}`;

    try {
      if (path) {
        const query = { ...params, format, title, filename };
        // Paging is irrelevant to an export — the server sends the full set.
        delete query.page; delete query.limit;
        if (columns?.length) query.columns = columns.join(',');
        await api.file(path, { download: true, filename: fallback, params: query });
      } else {
        await api.file('/export', {
          download: true,
          method: 'POST',
          filename: fallback,
          body: { format, rows, columns, title, filename },
        });
      }
      setOpen(false);
    } catch (err) {
      onError?.(err);
    } finally {
      setBusy('');
    }
  };

  const empty = !path && !rows?.length;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        className="btn-ghost btn-sm"
        disabled={disabled || empty}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        {busy ? <Spinner className="h-4 w-4" /> : (
          <span className="inline-flex items-center gap-1.5">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v12m0 0l-4-4m4 4l4-4M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2" />
            </svg>
            {label}
          </span>
        )}
      </button>

      {open && (
        <div role="menu" className="absolute right-0 z-30 mt-1 w-44 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
          {choices.map((f) => (
            <button
              key={f.key}
              role="menuitem"
              type="button"
              disabled={!!busy}
              onClick={() => run(f.key)}
              className="flex w-full items-center justify-between px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
            >
              <span>{f.label}</span>
              <span className="font-mono text-[11px] text-slate-400">{busy === f.key ? '…' : f.hint}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
