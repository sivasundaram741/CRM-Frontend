import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import dayjs from 'dayjs';

/* ------------------------------------------------------------------ Popover
 * Anchored, fixed-position layer. Fixed positioning matters: these controls sit
 * inside modals and `overflow-x:auto` tables, where an absolutely-positioned
 * panel would be clipped. Flips above the trigger when it would overflow.
 */
function Popover({ anchorRef, open, onClose, children, width, align = 'left' }) {
  const panelRef = useRef(null);
  const [style, setStyle] = useState({ visibility: 'hidden' });

  const place = useCallback(() => {
    const anchor = anchorRef.current;
    const panel = panelRef.current;
    if (!anchor || !panel) return;

    const rect = anchor.getBoundingClientRect();
    const panelHeight = panel.offsetHeight || 300;
    const panelWidth = width ?? Math.max(rect.width, 200);
    const spaceBelow = window.innerHeight - rect.bottom;
    const flip = spaceBelow < panelHeight + 12 && rect.top > panelHeight + 12;

    let left = align === 'right' ? rect.right - panelWidth : rect.left;
    left = Math.min(Math.max(8, left), window.innerWidth - panelWidth - 8);

    setStyle({
      position: 'fixed',
      top: flip ? rect.top - panelHeight - 6 : rect.bottom + 6,
      left,
      width: panelWidth,
      visibility: 'visible',
    });
  }, [anchorRef, width, align]);

  useLayoutEffect(() => {
    if (!open) return;
    place();
    const onScroll = () => place();
    window.addEventListener('resize', onScroll);
    window.addEventListener('scroll', onScroll, true);
    return () => {
      window.removeEventListener('resize', onScroll);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, [open, place]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === 'Escape' && (e.stopPropagation(), onClose());
    const onDown = (e) => {
      if (panelRef.current?.contains(e.target) || anchorRef.current?.contains(e.target)) return;
      onClose();
    };
    document.addEventListener('keydown', onKey, true);
    document.addEventListener('mousedown', onDown);
    return () => {
      document.removeEventListener('keydown', onKey, true);
      document.removeEventListener('mousedown', onDown);
    };
  }, [open, onClose, anchorRef]);

  if (!open) return null;
  return (
    <div
      ref={panelRef}
      style={style}
      className="z-[70] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl ring-1 ring-slate-900/5"
    >
      {children}
    </div>
  );
}

const chevron = (
  <svg className="h-4 w-4 shrink-0 text-slate-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
  </svg>
);

const clearIcon = (
  <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24" aria-hidden="true">
    <path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" />
  </svg>
);

/**
 * `hint` is an optional second line under the label — used where the label
 * alone is ambiguous, e.g. two customers with the same name distinguished by
 * their account number and company. It is searchable along with the label.
 */
const normalise = (options) =>
  (options || []).map((opt) => (typeof opt === 'object' && opt !== null
    ? { value: String(opt.value ?? ''), label: opt.label ?? String(opt.value ?? ''), hint: opt.hint || '' }
    : { value: String(opt), label: String(opt), hint: '' }));

/* ------------------------------------------------------------------ Select
 * Drop-in replacement for the native <select>: it still takes `options`,
 * `value` and an `onChange` that receives `{ target: { value } }`, so every
 * existing caller keeps working. Adds a search box past eight options,
 * full keyboard control and a clear button on optional fields.
 */
export function Select({
  options = [],
  value = '',
  onChange,
  placeholder = 'Select…',
  disabled,
  required,
  className = '',
  name,
  searchable,
  emptyMessage = 'No matches',
}) {
  const items = useMemo(() => normalise(options), [options]);
  const selected = items.find((o) => o.value === String(value ?? ''));
  const showSearch = searchable ?? items.length > 8;
  const clearable = placeholder !== null && !required && !!selected;

  const triggerRef = useRef(null);
  const searchRef = useRef(null);
  const listRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);

  const filtered = useMemo(() => {
    if (!query.trim()) return items;
    const q = query.trim().toLowerCase();
    return items.filter((o) => `${o.label} ${o.hint}`.toLowerCase().includes(q));
  }, [items, query]);

  useEffect(() => {
    if (!open) { setQuery(''); return; }
    const index = filtered.findIndex((o) => o.value === String(value ?? ''));
    setActive(index >= 0 ? index : 0);
    // Focusing the search box keeps typing and arrow keys in one place.
    requestAnimationFrame(() => searchRef.current?.focus());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;
    listRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [active, open]);

  const commit = (option) => {
    onChange?.({ target: { value: option ? option.value : '', name } });
    setOpen(false);
    triggerRef.current?.focus();
  };

  const onKeyDown = (e) => {
    if (!open) {
      if (['Enter', ' ', 'ArrowDown'].includes(e.key)) { e.preventDefault(); setOpen(true); }
      return;
    }
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((i) => Math.min(filtered.length - 1, i + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((i) => Math.max(0, i - 1)); }
    else if (e.key === 'Home') { e.preventDefault(); setActive(0); }
    else if (e.key === 'End') { e.preventDefault(); setActive(filtered.length - 1); }
    else if (e.key === 'Enter') { e.preventDefault(); if (filtered[active]) commit(filtered[active]); }
    else if (e.key === 'Tab') setOpen(false);
  };

  return (
    <div className={`relative ${className.includes('w-') ? className : `w-full ${className}`}`}>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={onKeyDown}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`flex w-full items-center gap-2 rounded-lg border bg-white px-3 py-2 text-left text-sm transition
          focus:outline-none focus:ring-2 focus:ring-brand-500/30 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400
          ${open ? 'border-brand-500 ring-2 ring-brand-500/30' : 'border-slate-300 hover:border-slate-400'}`}
      >
        <span className={`flex-1 truncate ${selected ? 'text-slate-800' : 'text-slate-400'}`}>
          {selected ? selected.label : placeholder}
        </span>
        {clearable && (
          <span
            role="button"
            tabIndex={-1}
            aria-label="Clear selection"
            onClick={(e) => { e.stopPropagation(); commit(null); }}
            className="rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            {clearIcon}
          </span>
        )}
        <span className={`transition-transform ${open ? 'rotate-180' : ''}`}>{chevron}</span>
      </button>

      {/* Mirrors the value for native form validation and submission. */}
      <input
        tabIndex={-1}
        aria-hidden="true"
        required={required}
        name={name}
        value={selected?.value ?? ''}
        onChange={() => {}}
        className="pointer-events-none absolute bottom-1 left-3 h-0 w-0 opacity-0"
      />

      <Popover anchorRef={triggerRef} open={open} onClose={() => setOpen(false)}>
        {showSearch && (
          <div className="border-b border-slate-100 p-2">
            <input
              ref={searchRef}
              value={query}
              onChange={(e) => { setQuery(e.target.value); setActive(0); }}
              onKeyDown={onKeyDown}
              placeholder="Type to filter…"
              className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm focus:border-brand-500 focus:outline-none"
            />
          </div>
        )}
        <ul ref={listRef} role="listbox" className="max-h-64 overflow-y-auto py-1" tabIndex={-1}>
          {!showSearch && <li className="hidden" />}
          {filtered.length === 0 && <li className="px-3 py-6 text-center text-sm text-slate-400">{emptyMessage}</li>}
          {filtered.map((option, i) => {
            const isSelected = option.value === String(value ?? '');
            return (
              <li key={option.value || `__${i}`}>
                <button
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  data-active={i === active}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => commit(option)}
                  className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition
                    ${i === active ? 'bg-brand-50 text-brand-800' : 'text-slate-700'}`}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">{option.label}</span>
                    {option.hint && <span className="block truncate text-xs text-slate-500">{option.hint}</span>}
                  </span>
                  {isSelected && (
                    <svg className="h-4 w-4 shrink-0 text-brand-600" fill="none" stroke="currentColor" strokeWidth="2.4" viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </Popover>
    </div>
  );
}

/* ------------------------------------------------------------------ UserSelect
 * The picker behind every "assigned to" / "owner" field. Options come from the
 * login-user list (`/users/assignable`), and each row shows who the person is —
 * avatar, name, role or designation, and optionally their open workload — so
 * the choice is informed rather than a name in a list.
 */
export function UserSelect({
  users = [],
  value = '',
  onChange,
  placeholder = 'Unassigned',
  required,
  disabled,
  className = '',
  showWorkload = false,
  name,
}) {
  const triggerRef = useRef(null);
  const searchRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);

  const selected = users.find((u) => String(u._id) === String(value ?? ''));
  const nameOf = (u) => u.fullName || `${u.firstName} ${u.lastName || ''}`.trim();
  const subtitleOf = (u) => u.designation || ROLE_LABELS[u.role] || u.role;

  const filtered = useMemo(() => {
    if (!query.trim()) return users;
    const q = query.trim().toLowerCase();
    return users.filter((u) =>
      nameOf(u).toLowerCase().includes(q)
      || (u.email || '').toLowerCase().includes(q)
      || (u.role || '').toLowerCase().includes(q)
      || (u.designation || '').toLowerCase().includes(q));
  }, [users, query]);

  useEffect(() => {
    if (!open) { setQuery(''); return; }
    setActive(Math.max(0, filtered.findIndex((u) => String(u._id) === String(value ?? ''))));
    requestAnimationFrame(() => searchRef.current?.focus());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const commit = (user) => {
    onChange?.({ target: { value: user ? user._id : '', name } });
    setOpen(false);
    triggerRef.current?.focus();
  };

  const onKeyDown = (e) => {
    if (!open) {
      if (['Enter', ' ', 'ArrowDown'].includes(e.key)) { e.preventDefault(); setOpen(true); }
      return;
    }
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((i) => Math.min(filtered.length - 1, i + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((i) => Math.max(0, i - 1)); }
    else if (e.key === 'Enter') { e.preventDefault(); if (filtered[active]) commit(filtered[active]); }
    else if (e.key === 'Tab') setOpen(false);
  };

  return (
    <div className={`relative ${className.includes('w-') ? className : `w-full ${className}`}`}>
      <button
        ref={triggerRef} type="button" disabled={disabled}
        onClick={() => setOpen((o) => !o)} onKeyDown={onKeyDown}
        aria-haspopup="listbox" aria-expanded={open}
        className={`flex w-full items-center gap-2 rounded-lg border bg-white px-3 py-2 text-left text-sm transition
          focus:outline-none focus:ring-2 focus:ring-brand-500/30 disabled:cursor-not-allowed disabled:bg-slate-50
          ${open ? 'border-brand-500 ring-2 ring-brand-500/30' : 'border-slate-300 hover:border-slate-400'}`}
      >
        {selected
          ? <UserAvatar user={selected} />
          : <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-slate-100 text-[10px] text-slate-400">?</span>}
        <span className={`flex-1 truncate ${selected ? 'text-slate-800' : 'text-slate-400'}`}>
          {selected ? nameOf(selected) : placeholder}
        </span>
        {selected && !required && (
          <span role="button" tabIndex={-1} aria-label="Clear assignment"
            onClick={(e) => { e.stopPropagation(); commit(null); }}
            className="rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
            {clearIcon}
          </span>
        )}
        <span className={`transition-transform ${open ? 'rotate-180' : ''}`}>{chevron}</span>
      </button>

      <input tabIndex={-1} aria-hidden="true" required={required} name={name}
        value={selected?._id ?? ''} onChange={() => {}}
        className="pointer-events-none absolute bottom-1 left-3 h-0 w-0 opacity-0" />

      <Popover anchorRef={triggerRef} open={open} onClose={() => setOpen(false)} width={320}>
        <div className="border-b border-slate-100 p-2">
          <input
            ref={searchRef} value={query}
            onChange={(e) => { setQuery(e.target.value); setActive(0); }}
            onKeyDown={onKeyDown}
            placeholder="Search by name, role or email…"
            className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm focus:border-brand-500 focus:outline-none"
          />
        </div>
        <ul role="listbox" className="max-h-72 overflow-y-auto py-1">
          {!required && (
            <li>
              <button type="button" onClick={() => commit(null)}
                className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-slate-500 hover:bg-slate-50">
                <span className="grid h-7 w-7 place-items-center rounded-full bg-slate-100 text-[10px] text-slate-400">?</span>
                Unassigned
              </button>
            </li>
          )}
          {filtered.length === 0 && <li className="px-3 py-6 text-center text-sm text-slate-400">No matching user</li>}
          {filtered.map((user, i) => {
            const isSelected = String(user._id) === String(value ?? '');
            return (
              <li key={user._id}>
                <button
                  type="button" role="option" aria-selected={isSelected}
                  onMouseEnter={() => setActive(i)} onClick={() => commit(user)}
                  className={`flex w-full items-center gap-2.5 px-3 py-2 text-left transition ${i === active ? 'bg-brand-50' : ''}`}
                >
                  <UserAvatar user={user} size="h-7 w-7" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-slate-800">{nameOf(user)}</span>
                    <span className="block truncate text-xs text-slate-500">{subtitleOf(user)}</span>
                  </span>
                  {showWorkload && user.workload && (
                    <span className="shrink-0 rounded-full bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium tabular-nums text-slate-600"
                      title={`${user.workload.openLeads} leads · ${user.workload.openDeals} deals · ${user.workload.openTasks} tasks · ${user.workload.openTickets} tickets`}>
                      {user.workloadTotal} open
                    </span>
                  )}
                  {isSelected && (
                    <svg className="h-4 w-4 shrink-0 text-brand-600" fill="none" stroke="currentColor" strokeWidth="2.4" viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </Popover>
    </div>
  );
}

const ROLE_LABELS = {
  SuperAdmin: 'Super Admin', Admin: 'Admin', SalesManager: 'Sales Manager',
  SalesExecutive: 'Sales Executive', MarketingExecutive: 'Marketing Executive',
  CustomerSupport: 'Customer Support', Finance: 'Finance', Customer: 'Customer',
};

function UserAvatar({ user, size = 'h-6 w-6' }) {
  const name = user.fullName || `${user.firstName || ''} ${user.lastName || ''}`.trim();
  if (user.avatarUrl) return <img src={user.avatarUrl} alt="" className={`${size} shrink-0 rounded-full object-cover`} />;
  const initials = name.split(' ').filter(Boolean).slice(0, 2).map((n) => n[0]).join('').toUpperCase();
  return (
    <span className={`${size} grid shrink-0 place-items-center rounded-full bg-brand-100 text-[10px] font-semibold text-brand-700`}>
      {initials || '?'}
    </span>
  );
}

/* ------------------------------------------------------------------ MultiSelect */

export function MultiSelect({ options = [], value = [], onChange, placeholder = 'Select…', className = '' }) {
  const items = useMemo(() => normalise(options), [options]);
  const chosen = (value || []).map(String);
  const triggerRef = useRef(null);
  const [open, setOpen] = useState(false);

  const toggle = (v) => {
    const next = chosen.includes(v) ? chosen.filter((x) => x !== v) : [...chosen, v];
    onChange?.({ target: { value: next } });
  };

  const labels = items.filter((o) => chosen.includes(o.value)).map((o) => o.label);

  return (
    <div className={`relative ${className || 'w-full'}`}>
      <button
        ref={triggerRef} type="button" onClick={() => setOpen((o) => !o)}
        className={`flex w-full items-center gap-2 rounded-lg border bg-white px-3 py-2 text-left text-sm
          ${open ? 'border-brand-500 ring-2 ring-brand-500/30' : 'border-slate-300 hover:border-slate-400'}`}
      >
        <span className={`flex-1 truncate ${labels.length ? 'text-slate-800' : 'text-slate-400'}`}>
          {labels.length ? labels.join(', ') : placeholder}
        </span>
        {chevron}
      </button>
      <Popover anchorRef={triggerRef} open={open} onClose={() => setOpen(false)}>
        <ul className="max-h-64 overflow-y-auto py-1">
          {items.map((option) => (
            <li key={option.value}>
              <label className="flex cursor-pointer items-center gap-2.5 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">
                <input type="checkbox" className="h-4 w-4 rounded border-slate-300 text-brand-600"
                  checked={chosen.includes(option.value)} onChange={() => toggle(option.value)} />
                <span className="truncate">{option.label}</span>
              </label>
            </li>
          ))}
        </ul>
      </Popover>
    </div>
  );
}

/* ------------------------------------------------------------------ DatePicker
 * Replaces `<input type="date">` and `type="datetime-local"`. Emits the same
 * string shape those inputs do — `YYYY-MM-DD`, or `YYYY-MM-DDTHH:mm` when
 * `withTime` — so existing form state and API payloads are unchanged.
 */
const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const HOURS = Array.from({ length: 24 }, (_, h) => String(h).padStart(2, '0'));
// Five-minute steps cover how meetings are actually scheduled; an existing
// off-step value is added to the list so editing a record never loses it.
const MINUTE_STEPS = Array.from({ length: 12 }, (_, m) => String(m * 5).padStart(2, '0'));

export function DatePicker({
  value = '',
  onChange,
  withTime = false,
  placeholder,
  disabled,
  required,
  min,
  max,
  className = '',
  name,
}) {
  const parsed = value ? dayjs(value) : null;
  const valid = parsed?.isValid() ? parsed : null;

  const triggerRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState(() => (valid || dayjs()).startOf('month'));
  const [time, setTime] = useState(valid && withTime ? valid.format('HH:mm') : '09:00');
  // Days -> months -> years, the way a date is usually narrowed down. Replaces
  // two native <select>s, which could not be styled to match and capped the
  // year range so a date outside it could not be reached at all.
  const [view, setView] = useState('day');

  const hourListRef = useRef(null);
  const minuteListRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    setCursor((valid || dayjs()).startOf('month'));
    setView('day');
    if (valid && withTime) setTime(valid.format('HH:mm'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Bring the current hour and minute into view when the panel opens. The
  // scroll position is set directly rather than with scrollIntoView, which
  // also scrolls the dialog behind the popover.
  useEffect(() => {
    if (view !== 'time') return;
    for (const ref of [hourListRef, minuteListRef]) {
      const list = ref.current;
      const selected = list?.querySelector('[data-selected="true"]');
      if (selected) list.scrollTop = selected.offsetTop - list.clientHeight / 2 + selected.clientHeight / 2;
    }
  }, [view]);

  const emit = (day, hhmm = time) => {
    if (!day) return onChange?.({ target: { value: '', name } });
    const next = withTime
      ? `${day.format('YYYY-MM-DD')}T${hhmm}`
      : day.format('YYYY-MM-DD');
    onChange?.({ target: { value: next, name } });
  };

  const pick = (day) => {
    emit(day);
    if (!withTime) setOpen(false);
  };

  const parts = (time || '09:00').split(':');
  const minuteOptions = MINUTE_STEPS.includes(parts[1])
    ? MINUTE_STEPS
    : [...MINUTE_STEPS, parts[1]].sort();

  const setTimeParts = (hh, mm) => {
    const next = `${hh}:${mm}`;
    setTime(next);
    if (valid) emit(valid, next);
  };

  const minDay = min ? dayjs(min) : null;
  const maxDay = max ? dayjs(max) : null;
  const disabledDay = (day) => (minDay && day.isBefore(minDay, 'day')) || (maxDay && day.isAfter(maxDay, 'day'));

  const gridStart = cursor.startOf('month').startOf('week');
  const days = Array.from({ length: 42 }, (_, i) => gridStart.add(i, 'day'));
  const today = dayjs();

  const PRESETS = withTime
    ? [['Now', () => dayjs()], ['In an hour', () => dayjs().add(1, 'hour')], ['Tomorrow 9am', () => dayjs().add(1, 'day').hour(9).minute(0)]]
    : [['Today', () => today], ['Tomorrow', () => today.add(1, 'day')], ['Next week', () => today.add(7, 'day')], ['In a month', () => today.add(1, 'month')]];

  const display = valid
    ? valid.format(withTime ? 'DD MMM YYYY, HH:mm' : 'DD MMM YYYY')
    : placeholder || (withTime ? 'Pick a date and time' : 'Pick a date');

  return (
    <div className={`relative ${className || 'w-full'}`}>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className={`flex w-full items-center gap-2 rounded-lg border bg-white px-3 py-2 text-left text-sm transition
          focus:outline-none focus:ring-2 focus:ring-brand-500/30 disabled:cursor-not-allowed disabled:bg-slate-50
          ${open ? 'border-brand-500 ring-2 ring-brand-500/30' : 'border-slate-300 hover:border-slate-400'}`}
      >
        <svg className="h-4 w-4 shrink-0 text-slate-400" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3M3 11h18M5 5h14a2 2 0 012 2v12a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2z" />
        </svg>
        <span className={`flex-1 truncate ${valid ? 'text-slate-800' : 'text-slate-400'}`}>{display}</span>
        {valid && !required && (
          <span
            role="button" tabIndex={-1} aria-label="Clear date"
            onClick={(e) => { e.stopPropagation(); emit(null); }}
            className="rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            {clearIcon}
          </span>
        )}
      </button>

      <input
        tabIndex={-1} aria-hidden="true" required={required} name={name}
        value={value || ''} onChange={() => {}}
        className="pointer-events-none absolute bottom-1 left-3 h-0 w-0 opacity-0"
      />

      <Popover anchorRef={triggerRef} open={open} onClose={() => setOpen(false)} width={296}>
        <div className="p-3">
          {(() => {
            // The time panel has nothing to page through — its heading is the
            // way back to the calendar.
            if (view === 'time') {
              return (
                <header className="mb-2 flex items-center gap-1">
                  <button type="button" onClick={() => setView('day')}
                    className="rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700" aria-label="Back to the calendar">
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" d="M15 19l-7-7 7-7" /></svg>
                  </button>
                  <span className="flex-1 text-center text-sm font-semibold text-slate-800">
                    {valid ? valid.format('DD MMM YYYY') : 'Pick a time'}
                  </span>
                  <span className="w-7" aria-hidden="true" />
                </header>
              );
            }

            // One step back/forward: a month in day view, a year in month view,
            // a decade in year view.
            const stepUnit = view === 'day' ? 'month' : view === 'month' ? 'year' : 'year';
            const stepSize = view === 'year' ? 12 : 1;
            const decadeStart = Math.floor(cursor.year() / 12) * 12;

            const heading = view === 'day' ? cursor.format('MMMM YYYY')
              : view === 'month' ? cursor.format('YYYY')
                : `${decadeStart} – ${decadeStart + 11}`;

            const nudge = (dir) => setCursor((c) => c.add(dir * stepSize, stepUnit));

            return (
              <header className="mb-2 flex items-center justify-between gap-1">
                <button type="button" onClick={() => nudge(-1)}
                  className="rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700" aria-label="Previous">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" d="M15 19l-7-7 7-7" /></svg>
                </button>

                {/* The heading is the control: it steps up a level each click. */}
                <button
                  type="button"
                  onClick={() => setView((v) => (v === 'day' ? 'month' : v === 'month' ? 'year' : 'day'))}
                  className="flex-1 rounded-lg px-2 py-1 text-sm font-semibold text-slate-800 transition hover:bg-slate-100"
                  aria-label={view === 'year' ? 'Back to days' : 'Choose a wider range'}
                >
                  {heading}
                  <span className="ml-1 text-[10px] text-slate-400">{view === 'year' ? '▾' : '▴'}</span>
                </button>

                <button type="button" onClick={() => nudge(1)}
                  className="rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700" aria-label="Next">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" d="M9 5l7 7-7 7" /></svg>
                </button>
              </header>
            );
          })()}

          {view === 'day' && (
            <div className="grid grid-cols-7 gap-0.5">
              {WEEKDAYS.map((d) => (
                <span key={d} className="py-1 text-center text-[11px] font-semibold uppercase text-slate-400">{d}</span>
              ))}
              {days.map((day) => {
                const inMonth = day.month() === cursor.month();
                const isSelected = valid && day.isSame(valid, 'day');
                const isToday = day.isSame(today, 'day');
                const off = disabledDay(day);
                return (
                  <button
                    key={day.format('YYYY-MM-DD')}
                    type="button"
                    disabled={off}
                    onClick={() => pick(day)}
                    className={`h-8 rounded-lg text-sm transition
                      ${isSelected ? 'bg-brand-600 font-semibold text-white'
                        : off ? 'cursor-not-allowed text-slate-200'
                        : inMonth ? 'text-slate-700 hover:bg-brand-50 hover:text-brand-700'
                        : 'text-slate-300 hover:bg-slate-50'}
                      ${isToday && !isSelected ? 'font-semibold text-brand-600 ring-1 ring-brand-200' : ''}`}
                  >
                    {day.date()}
                  </button>
                );
              })}
            </div>
          )}

          {view === 'month' && (
            <div className="grid grid-cols-3 gap-1.5 py-1">
              {Array.from({ length: 12 }, (_, m) => {
                const month = cursor.month(m);
                const isSelected = valid && month.isSame(valid, 'month');
                const isNow = month.isSame(today, 'month');
                // Out of range only when the whole month falls outside min/max.
                const off = (minDay && month.endOf('month').isBefore(minDay, 'day'))
                  || (maxDay && month.startOf('month').isAfter(maxDay, 'day'));
                return (
                  <button
                    key={m} type="button" disabled={off}
                    onClick={() => { setCursor(month.startOf('month')); setView('day'); }}
                    className={`rounded-lg py-2 text-sm transition
                      ${isSelected ? 'bg-brand-600 font-semibold text-white'
                        : off ? 'cursor-not-allowed text-slate-200'
                        : 'text-slate-700 hover:bg-brand-50 hover:text-brand-700'}
                      ${isNow && !isSelected ? 'font-semibold text-brand-600 ring-1 ring-brand-200' : ''}`}
                  >
                    {month.format('MMM')}
                  </button>
                );
              })}
            </div>
          )}

          {view === 'year' && (
            <div className="grid grid-cols-3 gap-1.5 py-1">
              {Array.from({ length: 12 }, (_, i) => Math.floor(cursor.year() / 12) * 12 + i).map((y) => {
                const year = cursor.year(y);
                const isSelected = valid && y === valid.year();
                const isNow = y === today.year();
                const off = (minDay && year.endOf('year').isBefore(minDay, 'day'))
                  || (maxDay && year.startOf('year').isAfter(maxDay, 'day'));
                return (
                  <button
                    key={y} type="button" disabled={off}
                    onClick={() => { setCursor(year); setView('month'); }}
                    className={`rounded-lg py-2 text-sm transition
                      ${isSelected ? 'bg-brand-600 font-semibold text-white'
                        : off ? 'cursor-not-allowed text-slate-200'
                        : 'text-slate-700 hover:bg-brand-50 hover:text-brand-700'}
                      ${isNow && !isSelected ? 'font-semibold text-brand-600 ring-1 ring-brand-200' : ''}`}
                  >
                    {y}
                  </button>
                );
              })}
            </div>
          )}

          {view === 'time' && (
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: 'Hour', ref: hourListRef, values: HOURS, index: 0 },
                { label: 'Minute', ref: minuteListRef, values: minuteOptions, index: 1 },
              ].map((column) => (
                <div key={column.label}>
                  <p className="mb-1 text-center text-[11px] font-semibold uppercase tracking-wide text-slate-400">{column.label}</p>
                  <div ref={column.ref} className="h-48 overflow-y-auto rounded-lg border border-slate-200 p-1">
                    {column.values.map((value) => {
                      const isSelected = parts[column.index] === value;
                      return (
                        <button
                          key={value} type="button" data-selected={isSelected}
                          onClick={() => setTimeParts(column.index === 0 ? value : parts[0], column.index === 1 ? value : parts[1])}
                          className={`block w-full rounded-md py-1.5 text-center text-sm transition
                            ${isSelected ? 'bg-brand-600 font-semibold text-white' : 'text-slate-700 hover:bg-brand-50 hover:text-brand-700'}`}
                        >
                          {value}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}

          {withTime && view !== 'time' && (
            <div className="mt-3 flex items-center gap-2 border-t border-slate-100 pt-3">
              <span className="text-xs font-medium text-slate-500">Time</span>
              {/* A button into the panel below, not <input type="time">, whose
                  browser-drawn dropdown opened on top of the calendar and could
                  be neither styled nor positioned. */}
              <button
                type="button"
                onClick={() => setView('time')}
                className="flex flex-1 items-center gap-2 rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm text-slate-800 transition hover:border-slate-400 hover:bg-slate-50"
              >
                <svg className="h-4 w-4 shrink-0 text-slate-400" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24" aria-hidden="true">
                  <circle cx="12" cy="12" r="9" />
                  <path strokeLinecap="round" d="M12 7v5l3 2" />
                </svg>
                {time}
              </button>
              <button type="button" className="btn-primary btn-sm" onClick={() => setOpen(false)}>Done</button>
            </div>
          )}

          {view === 'time' && (
            <div className="mt-3 flex items-center justify-between gap-2 border-t border-slate-100 pt-3">
              <span className="text-sm font-semibold text-slate-800">{time}</span>
              <button type="button" className="btn-primary btn-sm" onClick={() => setView('day')}>Set time</button>
            </div>
          )}

          <div className="mt-3 flex flex-wrap gap-1 border-t border-slate-100 pt-3">
            {PRESETS.map(([label, get]) => (
              <button
                key={label} type="button"
                onClick={() => {
                  const day = get();
                  if (withTime) { const hhmm = day.format('HH:mm'); setTime(hhmm); emit(day, hhmm); }
                  else emit(day);
                  setOpen(false);
                }}
                className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-brand-50 hover:text-brand-700"
              >
                {label}
              </button>
            ))}
            {valid && (
              <button type="button" onClick={() => { emit(null); setOpen(false); }}
                className="ml-auto rounded-lg px-2.5 py-1 text-xs font-medium text-rose-600 hover:bg-rose-50">
                Clear
              </button>
            )}
          </div>
        </div>
      </Popover>
    </div>
  );
}

/* ------------------------------------------------------------------ DateRangePicker
 * Preset list plus a custom from/to pair — the shape reports and filters need.
 */
export function DateRangePicker({ from, to, onChange, presets, className = '' }) {
  const triggerRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState({ from, to });

  useEffect(() => { setDraft({ from, to }); }, [from, to, open]);

  const DEFAULTS = presets || [
    ['Last 7 days', 7], ['Last 30 days', 30], ['Last 90 days', 90], ['Last 12 months', 365],
  ];

  const label = from && to
    ? `${dayjs(from).format('DD MMM YYYY')} — ${dayjs(to).format('DD MMM YYYY')}`
    : 'Select a period';

  const apply = (next) => {
    onChange?.(next);
    setOpen(false);
  };

  return (
    <div className={`relative ${className}`}>
      <button
        ref={triggerRef} type="button" onClick={() => setOpen((o) => !o)}
        className={`flex w-full items-center gap-2 rounded-lg border bg-white px-3 py-2 text-sm
          ${open ? 'border-brand-500 ring-2 ring-brand-500/30' : 'border-slate-300 hover:border-slate-400'}`}
      >
        <svg className="h-4 w-4 shrink-0 text-slate-400" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3M3 11h18M5 5h14a2 2 0 012 2v12a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2z" />
        </svg>
        <span className="flex-1 truncate text-slate-800">{label}</span>
        {chevron}
      </button>

      <Popover anchorRef={triggerRef} open={open} onClose={() => setOpen(false)} width={320} align="right">
        <ul className="border-b border-slate-100 py-1">
          {DEFAULTS.map(([text, days]) => (
            <li key={text}>
              <button
                type="button"
                onClick={() => apply({
                  from: dayjs().subtract(days, 'day').format('YYYY-MM-DD'),
                  to: dayjs().format('YYYY-MM-DD'),
                })}
                className="w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-brand-50 hover:text-brand-700"
              >
                {text}
              </button>
            </li>
          ))}
          <li>
            <button
              type="button"
              onClick={() => apply({ from: dayjs().startOf('year').format('YYYY-MM-DD'), to: dayjs().format('YYYY-MM-DD') })}
              className="w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-brand-50 hover:text-brand-700"
            >
              This year
            </button>
          </li>
        </ul>
        <div className="space-y-2.5 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Custom range</p>

          {/* The app's own picker rather than <input type="date">, which styles
              differently in every browser and has no month/year navigation. */}
          <label className="block">
            <span className="mb-1 block text-xs text-slate-500">From</span>
            <DatePicker
              value={draft.from || ''}
              max={draft.to || undefined}
              placeholder="Start date"
              onChange={(e) => setDraft((d) => ({ ...d, from: e.target.value }))}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs text-slate-500">To</span>
            <DatePicker
              value={draft.to || ''}
              min={draft.from || undefined}
              placeholder="End date"
              onChange={(e) => setDraft((d) => ({ ...d, to: e.target.value }))}
            />
          </label>

          {draft.from && draft.to && (
            <p className="text-xs text-slate-500">
              {dayjs(draft.to).diff(dayjs(draft.from), 'day') + 1} day(s) selected
            </p>
          )}

          <button type="button" className="btn-primary btn-sm w-full" disabled={!draft.from || !draft.to}
            onClick={() => apply(draft)}>
            Apply range
          </button>
        </div>
      </Popover>
    </div>
  );
}
