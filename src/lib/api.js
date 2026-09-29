import { apiUrl } from './config.js';

const TOKEN_KEY = 'crm.accessToken';
const REFRESH_KEY = 'crm.refreshToken';
const USER_KEY = 'crm.user';

export const tokenStore = {
  get access() { return localStorage.getItem(TOKEN_KEY); },
  get refresh() { return localStorage.getItem(REFRESH_KEY); },
  get user() {
    try { return JSON.parse(localStorage.getItem(USER_KEY) || 'null'); } catch { return null; }
  },
  save({ accessToken, refreshToken, user }) {
    if (accessToken) localStorage.setItem(TOKEN_KEY, accessToken);
    if (refreshToken) localStorage.setItem(REFRESH_KEY, refreshToken);
    if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
  },
  clear() {
    [TOKEN_KEY, REFRESH_KEY, USER_KEY].forEach((k) => localStorage.removeItem(k));
  },
};

export class ApiError extends Error {
  constructor(message, status, errors = []) {
    super(message);
    this.status = status;
    this.errors = errors;
  }
}

let refreshing = null;

async function refreshSession() {
  // Collapse concurrent 401s into a single refresh call.
  refreshing ??= (async () => {
    const refreshToken = tokenStore.refresh;
    if (!refreshToken) return false;
    const res = await fetch(apiUrl('/auth/refresh'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    if (!res.ok) return false;
    const json = await res.json();
    tokenStore.save(json.data);
    return true;
  })().finally(() => { refreshing = null; });
  return refreshing;
}

async function request(method, path, { body, params, isForm, retry = true } = {}) {
  const url = apiUrl(path);
  for (const [key, value] of Object.entries(params || {})) {
    if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, value);
  }

  const headers = {};
  const token = tokenStore.access;
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body && !isForm) headers['Content-Type'] = 'application/json';

  const res = await fetch(url, {
    method,
    headers,
    body: isForm ? body : body ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401 && retry && tokenStore.refresh) {
    if (await refreshSession()) return request(method, path, { body, params, isForm, retry: false });
    tokenStore.clear();
    if (!window.location.pathname.startsWith('/login')) window.location.href = '/login';
  }

  const text = await res.text();
  const json = text ? JSON.parse(text) : {};

  if (!res.ok) throw new ApiError(json.message || `Request failed (${res.status})`, res.status, json.errors || []);
  return json;
}

export const api = {
  get: (path, params) => request('GET', path, { params }),
  post: (path, body) => request('POST', path, { body }),
  put: (path, body) => request('PUT', path, { body }),
  patch: (path, body) => request('PATCH', path, { body }),
  del: (path, body) => request('DELETE', path, { body }),
  upload: (path, formData) => request('POST', path, { body: formData, isForm: true }),

  /**
   * Opens or saves a server-generated file. A plain link cannot be used because
   * the endpoint needs the bearer token, so the bytes are fetched and handed to
   * the browser as a blob.
   */
  async file(path, { download = false, filename, params, method = 'GET', body } = {}) {
    const headers = {};
    const token = tokenStore.access;
    if (token) headers.Authorization = `Bearer ${token}`;
    if (body) headers['Content-Type'] = 'application/json';

    const url = apiUrl(path);
    for (const [key, value] of Object.entries(params || {})) {
      if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, value);
    }

    const res = await fetch(url, { method, headers, body: body ? JSON.stringify(body) : undefined });
    if (!res.ok) {
      // Errors still come back as the usual JSON envelope.
      let message = `Request failed (${res.status})`;
      try { message = (await res.json()).message || message; } catch { /* not JSON */ }
      throw new ApiError(message, res.status);
    }

    // The server names the file — it knows the resource, the filters and the
    // format. Readable cross-origin only because the API sets
    // Access-Control-Expose-Headers; `filename` is the fallback if a proxy
    // strips it.
    const disposition = res.headers.get('content-disposition') || '';
    const sent = decodeURIComponent(disposition.match(/filename\*=UTF-8''([^;]+)/)?.[1]
      || disposition.match(/filename="?([^";]+)"?/)?.[1]
      || '');

    const blobUrl = URL.createObjectURL(await res.blob());
    if (download) {
      const link = Object.assign(document.createElement('a'), { href: blobUrl, download: sent || filename || 'download' });
      document.body.appendChild(link);
      link.click();
      link.remove();
    } else {
      window.open(blobUrl, '_blank', 'noopener');
    }
    // Give the tab/download a moment to take the blob before releasing it.
    setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
  },
};

/** Turns a list of records into a CSV file the browser downloads. */
export function downloadCsv(rows, filename, columns) {
  if (!rows?.length) return;
  const keys = columns || Object.keys(rows[0]).filter((k) => !['__v', 'id'].includes(k));
  const escape = (value) => {
    if (value == null) return '';
    if (typeof value === 'object') value = value.name || value.fullName || value._id || JSON.stringify(value);
    const str = String(value).replace(/"/g, '""');
    return /[",\n]/.test(str) ? `"${str}"` : str;
  };

  const csv = [keys.join(','), ...rows.map((row) => keys.map((k) => escape(row[k])).join(','))].join('\n');
  const url = URL.createObjectURL(new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8' }));
  const link = Object.assign(document.createElement('a'), { href: url, download: filename });
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
