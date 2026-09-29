import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loading, ErrorState, EmptyState, Pagination, SearchInput, SortableTh, Select, UserSelect, Toast, errorToast } from './ui.jsx';
import ExportMenu from './ExportMenu.jsx';
import { useUsers, useDebounced } from '../hooks/useApi.js';

/**
 * The list surface every module screen is built on: toolbar (search + filters + export),
 * sortable table, empty/error states and paging.
 *
 * columns: { key, label, sortable, render(row), className, width }
 * filters: { key, label, options[] }
 */
export default function DataTable({
  list,
  columns,
  filters = [],
  title,
  actions,
  rowLink,
  onRowClick,
  selectable = false,
  onSelectionChange,
  exportName,
  emptyTitle = 'No records found',
  emptyHint,
  dense = false,
}) {
  const { rows, meta, loading, refreshing, error, query, setFilter, setPage, toggleSort, refresh } = list;
  const [selected, setSelected] = useState([]);
  const [exportError, setExportError] = useState('');
  // A `type: 'user'` filter is populated from the login-user list.
  const users = useUsers();

  // The box is typed into locally and only queried once typing pauses. Firing a
  // request per keystroke raced the responses and left the results reflecting
  // whichever reply landed last, which looked like it only matched one letter.
  const [term, setTerm] = useState(query.search || '');
  const debouncedTerm = useDebounced(term, 350);

  // Keep in step when the query is changed elsewhere (Clear, or a preset filter).
  useEffect(() => { setTerm(query.search || ''); }, [query.search]);

  useEffect(() => {
    if ((query.search || '') !== debouncedTerm) setFilter({ search: debouncedTerm });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedTerm]);

  const toggleRow = (id) => {
    const next = selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id];
    setSelected(next);
    onSelectionChange?.(next);
  };

  const toggleAll = () => {
    const next = selected.length === rows.length ? [] : rows.map((r) => r._id);
    setSelected(next);
    onSelectionChange?.(next);
  };

  return (
    <section className="space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <SearchInput value={term} onChange={setTerm} placeholder={`Search ${title || 'records'}…`} />
          {filters.map((f) => (f.type === 'user' ? (
            <UserSelect
              key={f.key}
              users={users}
              value={query[f.key] ?? ''}
              onChange={(e) => setFilter({ [f.key]: e.target.value })}
              placeholder={f.label}
              className="w-52"
            />
          ) : (
            <Select
              key={f.key}
              value={query[f.key] ?? ''}
              onChange={(e) => setFilter({ [f.key]: e.target.value })}
              options={f.options}
              placeholder={f.label}
              className="w-44"
            />
          )))}
          {(query.search || filters.some((f) => query[f.key])) && (
            <button
              className="btn-ghost btn-sm"
              onClick={() => {
                setTerm('');
                setFilter(Object.fromEntries([['search', ''], ...filters.map((f) => [f.key, ''])]));
              }}
            >
              Clear
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          {exportName && (
            <ExportMenu
              // Points at the module's /export endpoint with the active filters,
              // so the download covers every matching record rather than the
              // 25 rows currently rendered.
              path={list.path ? `${list.path}/export` : undefined}
              params={query}
              columns={columns.filter((c) => c.key !== 'actions').map((c) => c.key)}
              title={title ? `${title[0].toUpperCase()}${title.slice(1)} export` : 'Export'}
              // No filename: the server knows the resource and the active
              // filters, so it names the file after what was actually exported.
              onError={(err) => setExportError(err.message)}
            />
          )}
          {actions}
        </div>
      </div>

      {selectable && selected.length > 0 && (
        <div className="flex items-center gap-3 rounded-lg border border-brand-200 bg-brand-50 px-4 py-2.5 text-sm">
          <span className="font-medium text-brand-800">{selected.length} selected</span>
          <button className="text-brand-700 hover:underline" onClick={() => { setSelected([]); onSelectionChange?.([]); }}>Clear</button>
        </div>
      )}

      <div className="relative table-wrap">
        {/* Only the very first load blanks the table; later refetches keep the
            rows on screen under a translucent veil so the list never appears
            to empty itself while a filter is applied. */}
        {loading && <Loading />}
        {!loading && error && <ErrorState message={error} onRetry={refresh} />}
        {!loading && !error && rows.length === 0 && <EmptyState title={emptyTitle} hint={emptyHint} />}
        {!loading && refreshing && (
          <div className="pointer-events-none absolute inset-0 z-10 bg-white/50" aria-hidden="true" />
        )}

        {!loading && !error && rows.length > 0 && (
          <>
            <table className="min-w-full">
              <thead className="bg-slate-50">
                <tr>
                  {selectable && (
                    <th className="th w-10">
                      <input type="checkbox" className="rounded border-slate-300" checked={selected.length === rows.length} onChange={toggleAll} />
                    </th>
                  )}
                  {columns.map((col) => (col.sortable
                    ? <SortableTh key={col.key} field={col.key} sort={query.sort} onSort={toggleSort} className={col.className}>{col.label}</SortableTh>
                    : <th key={col.key} className={`th ${col.className || ''}`}>{col.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const cells = columns.map((col) => (
                    <td key={col.key} className={`${dense ? 'px-4 py-2 text-sm text-slate-700' : 'td'} ${col.className || ''}`}>
                      {col.render ? col.render(row) : plain(row[col.key])}
                    </td>
                  ));
                  return (
                    <tr
                      key={row._id}
                      className={`row ${rowLink || onRowClick ? 'cursor-pointer' : ''}`}
                      onClick={onRowClick ? () => onRowClick(row) : undefined}
                    >
                      {selectable && (
                        <td className="td w-10" onClick={(e) => e.stopPropagation()}>
                          <input type="checkbox" className="rounded border-slate-300" checked={selected.includes(row._id)} onChange={() => toggleRow(row._id)} />
                        </td>
                      )}
                      {rowLink
                        ? cells.map((cell, i) => (i === 0
                          ? <td key={columns[i].key} className={dense ? 'px-4 py-2 text-sm' : 'td'}>
                              <Link to={rowLink(row)} className="font-medium text-brand-700 hover:underline">
                                {columns[0].render ? columns[0].render(row) : plain(row[columns[0].key])}
                              </Link>
                            </td>
                          : cell))
                        : cells}
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <Pagination meta={meta} onPage={setPage} />
          </>
        )}
      </div>

      <Toast message={exportError ? errorToast(exportError) : ''} onDismiss={() => setExportError('')} />
    </section>
  );
}

function plain(value) {
  if (value == null) return '—';
  if (typeof value === 'object') return value.name || value.fullName || `${value.firstName || ''} ${value.lastName || ''}`.trim() || '—';
  return String(value);
}
