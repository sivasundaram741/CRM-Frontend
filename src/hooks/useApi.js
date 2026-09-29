import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../lib/api.js';

/** GET a path and track loading/error. `deps` re-fetches; `refresh()` re-runs on demand. */
export function useFetch(path, params, deps = []) {
  const [state, setState] = useState({ data: null, meta: null, loading: true, error: null, path: null });
  const [nonce, setNonce] = useState(0);
  const paramsKey = JSON.stringify(params || {});
  const alive = useRef(true);

  useEffect(() => () => { alive.current = false; }, []);

  // Dropping stale data in an effect is too late: effects run after the render
  // has already happened, so a screen switching resource would render once with
  // the new selection and the previous response — and throw on a field that
  // only existed in the old shape. Resetting here, during render, means no
  // child ever sees the mismatch. React re-renders immediately and does not
  // loop, because `state.path` then matches.
  if (path && state.path !== path) {
    setState({ data: null, meta: null, loading: true, refreshing: true, error: null, path });
  }

  useEffect(() => {
    if (!path) return;
    let current = true;
    // Same path, new params (a filter or page): keep the rows on screen and
    // mark it refreshing, so a list does not blank on every keystroke.
    setState((s) => ({ ...s, loading: s.data === null, refreshing: true, error: null, path }));

    api.get(path, params)
      .then((res) => current && setState({
        data: res.data, meta: res.meta || null, loading: false, refreshing: false, error: null, path,
      }))
      .catch((err) => current && setState((s) => ({
        data: s.data, meta: s.meta, loading: false, refreshing: false, error: err.message, path,
      })));
    return () => { current = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, paramsKey, nonce, ...deps]);

  const refresh = useCallback(() => setNonce((n) => n + 1), []);
  return { ...state, refresh };
}

/**
 * List screens: paging, search, sorting and filters in one hook.
 * Returns the rows plus everything the toolbar and pager need.
 */
export function useList(path, initial = {}) {
  const [query, setQuery] = useState({ page: 1, limit: 25, search: '', sort: '-createdAt', ...initial });
  const { data, meta, loading, refreshing, error, refresh } = useFetch(path, query);

  const setFilter = useCallback((patch) => {
    setQuery((q) => ({ ...q, ...patch, page: patch.page ?? 1 }));
  }, []);

  return {
    rows: data || [],
    meta,
    loading,
    refreshing,
    error,
    // Exposed so an export can hit `<path>/export` with the same filters.
    path,
    query,
    setQuery,
    setFilter,
    setPage: (page) => setQuery((q) => ({ ...q, page })),
    setSearch: (search) => setFilter({ search }),
    toggleSort: (field) => setQuery((q) => ({
      ...q,
      sort: q.sort === field ? `-${field}` : field,
      page: 1,
    })),
    refresh,
  };
}

/** Mutations with pending state, used by every form and action button. */
export function useMutation() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(null);

  const run = useCallback(async (fn) => {
    setPending(true);
    setError(null);
    try {
      return await fn(api);
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setPending(false);
    }
  }, []);

  return { run, pending, error, setError };
}

/**
 * The login accounts behind every "assigned to" / "owner" picker.
 * Cached per option-set so the whole app shares one request.
 */
const usersCache = new Map();
const userListeners = new Set();

export function useUsers({ role, team, workload } = {}) {
  const key = JSON.stringify({ role, team, workload });
  const [users, setUsers] = useState(() => usersCache.get(key) || []);

  useEffect(() => {
    let alive = true;
    const load = () => {
      if (usersCache.has(key)) { setUsers(usersCache.get(key)); return; }
      api.get('/users/assignable', { role, team, workload: workload ? 'true' : undefined })
        .then((res) => { usersCache.set(key, res.data); if (alive) setUsers(res.data); })
        .catch(() => {});
    };
    load();
    // Subscribed so `invalidateUsers()` actually refreshes open pickers —
    // clearing the cache alone left every mounted picker showing stale people.
    userListeners.add(load);
    return () => { alive = false; userListeners.delete(load); };
  }, [key, role, team, workload]);

  return users;
}

/** Called after any user is created or changed, so every picker re-reads. */
export function invalidateUsers() {
  usersCache.clear();
  userListeners.forEach((load) => load());
}

/** `{ value, label }` pairs for a user picker, with role as secondary text. */
export function userOptions(users) {
  return (users || []).map((u) => ({
    value: u._id,
    label: u.fullName || `${u.firstName} ${u.lastName || ''}`.trim(),
    hint: u.designation || ROLE_TEXT[u.role] || u.role,
    avatarUrl: u.avatarUrl,
    role: u.role,
  }));
}

const ROLE_TEXT = {
  SuperAdmin: 'Super Admin', Admin: 'Admin', SalesManager: 'Sales Manager',
  SalesExecutive: 'Sales Executive', MarketingExecutive: 'Marketing Executive',
  CustomerSupport: 'Customer Support', Finance: 'Finance', Customer: 'Customer',
};

export function useDebounced(value, delay = 350) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

/**
 * Configurable pick lists — statuses, stages, priorities, sources, categories.
 * Fetched once per key and shared across screens; concurrent callers await the
 * same request rather than each firing their own.
 */
const masterCache = new Map();
const masterWaiters = new Map();
const masterListeners = new Set();

function loadMaster(key) {
  if (masterCache.has(key)) return Promise.resolve(masterCache.get(key));
  if (!masterWaiters.has(key)) {
    masterWaiters.set(key, api.get(`/settings/masters/${key}`)
      .then((res) => { masterCache.set(key, res.data); return res.data; })
      .catch(() => [])
      .finally(() => masterWaiters.delete(key)));
  }
  return masterWaiters.get(key);
}

export function useMaster(key) {
  const [items, setItems] = useState(() => masterCache.get(key) || []);
  useEffect(() => {
    let alive = true;
    const refresh = () => loadMaster(key).then((rows) => { if (alive) setItems(rows); });
    refresh();
    masterListeners.add(refresh);
    return () => { alive = false; masterListeners.delete(refresh); };
  }, [key]);
  return items;
}

/**
 * Just the active names, in configured order. Falls back to the supplied
 * constants until the list loads, so a dropdown is never empty — and the app
 * still works against a database whose masters have not been seeded.
 */
export function useMasterNames(key, fallback = []) {
  const rows = useMaster(key);
  const fallbackKey = fallback.join('|');
  return useMemo(() => {
    const active = rows.filter((r) => r.isActive !== false).map((r) => r.name);
    return active.length ? active : fallback;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, fallbackKey]);
}

/** Name → configured colour, so badges follow whatever an admin set. */
export function useMasterColors(key) {
  const rows = useMaster(key);
  return useMemo(() => Object.fromEntries(rows.filter((r) => r.color).map((r) => [r.name, r.color])), [rows]);
}

/** Currency codes from the currency master, for money fields. */
export function useCurrencyCodes(fallback = ['INR', 'USD', 'EUR', 'AED']) {
  const rows = useMaster('currencies');
  return useMemo(() => {
    const codes = rows.filter((r) => r.isActive !== false).map((r) => r.code);
    return codes.length ? codes : fallback;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, fallback.join('|')]);
}

export function useMasterDefault(key, fallback) {
  const rows = useMaster(key);
  return rows.find((r) => r.isDefault)?.name ?? fallback;
}

/** Called after editing master data so every open screen re-reads its list. */
export function invalidateMasters() {
  masterCache.clear();
  masterListeners.forEach((refresh) => refresh());
}
