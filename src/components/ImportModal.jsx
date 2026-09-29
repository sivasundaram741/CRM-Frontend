import { useRef, useState } from 'react';
import { api } from '../lib/api.js';
import { useMutation } from '../hooks/useApi.js';
import { Modal, Spinner, EmptyState } from './ui.jsx';

/**
 * Imports records from a spreadsheet.
 *
 * The file is read on the server, which already owns the .xlsx format for
 * exports, and comes back as a preview before anything is written — a run that
 * quietly dropped unrecognised columns looked exactly like one that worked.
 */

const ACCEPT = '.csv,.tsv,.txt,.xlsx,.json';
const PREVIEW_ROWS = 8;

const fileIcon = (
  <svg className="h-8 w-8 text-slate-300" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5A3.375 3.375 0 0010.125 2.25H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
  </svg>
);

export default function ImportModal({ open, onClose, endpoint, label = 'records', onDone }) {
  const inputRef = useRef(null);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [result, setResult] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const { run, pending, error, setError } = useMutation();

  const reset = () => { setFile(null); setPreview(null); setResult(null); setError(null); };
  const close = () => { reset(); onClose(); };

  const read = async (chosen) => {
    if (!chosen) return;
    setFile(chosen);
    setPreview(null);
    setResult(null);
    const form = new FormData();
    form.append('file', chosen);
    try {
      const res = await run(() => api.upload(`${endpoint}/import/preview`, form));
      setPreview(res.data);
    } catch { /* message shown in the modal */ }
  };

  const confirm = async () => {
    try {
      const res = await run((a) => a.post(`${endpoint}/import`, { rows: preview.rows }));
      setResult(res.data);
      if (res.data.insertedCount) onDone?.(`Imported ${res.data.insertedCount} ${label}${res.data.failedCount ? `, ${res.data.failedCount} failed` : ''}`);
    } catch { /* message shown in the modal */ }
  };

  const matched = preview ? Object.entries(preview.mapping) : [];

  return (
    <Modal
      open={open} onClose={close} title={`Import ${label}`} width="max-w-3xl"
      footer={
        <>
          <button className="btn-ghost" onClick={close}>{result ? 'Done' : 'Cancel'}</button>
          {preview && !result && (
            <button className="btn-primary" onClick={confirm} disabled={pending}>
              {pending ? <Spinner className="h-4 w-4" /> : `Import ${preview.rows.length} ${label}`}
            </button>
          )}
        </>
      }
    >
      {error && <p className="mb-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}

      {/* ---------------------------------------------------------- 1. choose */}
      {!preview && !result && (
        <>
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => { e.preventDefault(); setDragOver(false); read(e.dataTransfer.files?.[0]); }}
            onClick={() => inputRef.current?.click()}
            className={`grid cursor-pointer place-items-center gap-2 rounded-xl border-2 border-dashed px-6 py-10 text-center transition
              ${dragOver ? 'border-brand-500 bg-brand-50' : 'border-slate-300 hover:border-brand-400 hover:bg-slate-50'}`}
          >
            {pending ? <Spinner className="h-8 w-8 text-brand-600" /> : fileIcon}
            <p className="text-sm font-medium text-slate-700">
              {pending ? `Reading ${file?.name}…` : 'Drop a spreadsheet here, or click to choose one'}
            </p>
            <p className="text-xs text-slate-500">Excel (.xlsx), CSV, tab-separated or JSON — up to 10&nbsp;MB</p>
          </div>
          <input ref={inputRef} type="file" accept={ACCEPT} className="hidden"
            onChange={(e) => { read(e.target.files?.[0]); e.target.value = ''; }} />

          <p className="mt-4 text-sm text-slate-600">
            Column headings are matched to fields by name, ignoring case and spacing — so a file exported
            from this app can be edited and imported straight back.
          </p>
        </>
      )}

      {/* --------------------------------------------------------- 2. preview */}
      {preview && !result && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-slate-700">
              <span className="font-medium">{preview.fileName}</span>
              {' — '}{preview.total} row{preview.total === 1 ? '' : 's'}, {matched.length} column{matched.length === 1 ? '' : 's'} recognised
            </p>
            <button className="btn-ghost btn-sm" onClick={reset}>Choose another file</button>
          </div>

          {preview.truncated && (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
              Only the first {preview.rows.length} rows will be imported. Split the file to bring in the rest.
            </p>
          )}

          {preview.unmatched.length > 0 && (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
              <span className="font-medium">Ignored:</span> {preview.unmatched.join(', ')} — no matching field.
            </p>
          )}

          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="w-10 px-3 py-2 font-medium">#</th>
                  {matched.map(([column, field]) => (
                    <th key={column} className="whitespace-nowrap px-3 py-2 font-medium">
                      {field}
                      {/* The original heading, so a wrong match is obvious. */}
                      {column !== field && <span className="ml-1 font-normal normal-case text-slate-400">← {column}</span>}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {preview.rows.slice(0, PREVIEW_ROWS).map((row, i) => (
                  <tr key={i} className="text-slate-700">
                    <td className="px-3 py-2 text-xs text-slate-400">{i + 1}</td>
                    {matched.map(([, field]) => (
                      <td key={field} className="max-w-[16rem] truncate px-3 py-2" title={String(row[field] ?? '')}>
                        {row[field] === undefined || row[field] === ''
                          ? <span className="text-slate-300">—</span>
                          : String(row[field])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {preview.rows.length > PREVIEW_ROWS && (
            <p className="text-xs text-slate-500">Showing {PREVIEW_ROWS} of {preview.rows.length} rows to be imported.</p>
          )}
        </div>
      )}

      {/* ---------------------------------------------------------- 3. result */}
      {result && (
        <div className="space-y-3">
          <div className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            <span className="font-semibold">{result.insertedCount}</span> {label} imported
            {result.failedCount ? <> · <span className="font-semibold">{result.failedCount}</span> could not be created</> : null}.
          </div>

          {/* Per-row errors were returned by the server all along and never
              shown, so a partial import looked like a complete one. */}
          {result.failed?.length > 0 && (
            <div className="max-h-64 overflow-y-auto rounded-lg border border-rose-200">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-rose-50 text-xs uppercase tracking-wide text-rose-700">
                  <tr><th className="w-16 px-3 py-2 font-medium">Row</th><th className="px-3 py-2 font-medium">Why it failed</th></tr>
                </thead>
                <tbody className="divide-y divide-rose-100">
                  {result.failed.map((f) => (
                    <tr key={f.row}><td className="px-3 py-2 text-slate-500">{f.row}</td><td className="px-3 py-2 text-rose-700">{f.error}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {!result.insertedCount && !result.failedCount && <EmptyState title="Nothing was imported" />}
        </div>
      )}
    </Modal>
  );
}
