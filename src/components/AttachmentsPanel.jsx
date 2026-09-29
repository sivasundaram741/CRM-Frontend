import { useRef, useState } from 'react';
import { api } from '../lib/api.js';
import { assetUrl } from '../lib/config.js';
import { useFetch } from '../hooks/useApi.js';
import { EmptyState, Loading, Spinner } from './ui.jsx';
import { fromNow, nameOf } from '../lib/format.js';

const ICONS = {
  pdf: '📕', doc: '📘', docx: '📘', xls: '📗', xlsx: '📗', csv: '📗',
  png: '🖼️', jpg: '🖼️', jpeg: '🖼️', gif: '🖼️', webp: '🖼️', svg: '🖼️',
  zip: '🗜️', rar: '🗜️', txt: '📄',
};

const sizeOf = (bytes) => {
  if (!bytes) return '';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  return `${Math.round((bytes / 1024 ** i) * 10) / 10} ${units[i]}`;
};

/**
 * Files attached to any record. Mirrors NotesPanel — the API is polymorphic, so
 * the same panel serves leads, customers, deals, quotations, invoices and tickets.
 */
export default function AttachmentsPanel({ entityType, entityId, readOnly }) {
  const { data, loading, refresh } = useFetch('/attachments', { entityType, entityId });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef(null);

  const upload = async (files) => {
    const list = Array.from(files || []);
    if (!list.length) return;
    setBusy(true);
    setError('');
    try {
      for (const file of list) {
        const form = new FormData();
        form.append('file', file);
        form.append('entityType', entityType);
        form.append('entityId', entityId);
        await api.upload('/attachments', form);
      }
      refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const remove = async (file) => {
    setError('');
    try {
      await api.del(`/attachments/${file._id}`);
      refresh();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="space-y-4">
      {error && <p className="rounded-lg border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-sm text-rose-700">{error}</p>}

      {!readOnly && (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => { e.preventDefault(); setDragOver(false); upload(e.dataTransfer.files); }}
          className={`rounded-xl border-2 border-dashed p-6 text-center transition ${
            dragOver ? 'border-brand-400 bg-brand-50' : 'border-slate-300 bg-white'}`}
        >
          <input ref={inputRef} type="file" multiple className="hidden" onChange={(e) => upload(e.target.files)} />
          {busy ? (
            <span className="inline-flex items-center gap-2 text-sm text-slate-600"><Spinner className="h-4 w-4" /> Uploading…</span>
          ) : (
            <>
              <p className="text-sm text-slate-600">
                Drop files here, or{' '}
                <button type="button" className="font-medium text-brand-700 hover:underline" onClick={() => inputRef.current?.click()}>
                  browse
                </button>
              </p>
              <p className="mt-1 text-xs text-slate-400">Up to 15 MB per file.</p>
            </>
          )}
        </div>
      )}

      {loading && <Loading />}
      {!loading && !data?.length && <div className="card-pad"><EmptyState title="No files attached" hint={readOnly ? undefined : 'Upload a proposal, purchase order or signed document.'} /></div>}

      {!!data?.length && (
        <ul className="space-y-2">
          {data.map((file) => (
            <li key={file._id} className="card-pad flex items-center gap-3">
              <span className="text-xl" aria-hidden="true">
                {ICONS[file.originalName?.split('.').pop()?.toLowerCase()] || '📎'}
              </span>
              <div className="min-w-0 flex-1">
                <a
                  className="block truncate text-sm font-medium text-brand-700 hover:underline"
                  href={assetUrl(file.path)}
                  target="_blank"
                  rel="noreferrer"
                >
                  {file.originalName}
                </a>
                <p className="text-xs text-slate-500">
                  {sizeOf(file.size)}
                  {file.uploadedBy ? ` · ${nameOf(file.uploadedBy)}` : ''} · {fromNow(file.createdAt)}
                </p>
              </div>
              {!readOnly && (
                <button className="text-xs text-slate-400 hover:text-rose-600" onClick={() => remove(file)}>
                  Delete
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
