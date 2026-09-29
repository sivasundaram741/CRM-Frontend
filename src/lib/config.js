/**
 * Runtime configuration, read once from the Vite environment.
 *
 * `VITE_API_URL` blank (the development default) means "same origin": requests
 * go to /api on whatever host serves the app and the dev-server proxy forwards
 * them to the API. Setting it points the browser straight at another host,
 * which is what a deployed build needs when the API lives elsewhere.
 */

/** Trailing slashes would produce `//api` once joined. */
const trimEnd = (value) => String(value || '').trim().replace(/\/+$/, '');

export const API_BASE_URL = trimEnd(import.meta.env.VITE_API_URL);

export const APP_NAME = import.meta.env.VITE_APP_NAME || 'CRM Suite';

/** True when the browser talks to the API directly rather than through the proxy. */
export const isCrossOrigin = !!API_BASE_URL;

/**
 * Absolute URL for an API path. Accepts `/leads` or `/api/leads` so callers can
 * keep writing whichever reads better at the call site.
 */
export function apiUrl(path) {
  const suffix = path.startsWith('/api') ? path : `/api${path.startsWith('/') ? path : `/${path}`}`;
  return new URL(`${API_BASE_URL}${suffix}`, window.location.origin);
}

/**
 * Absolute URL for a file the API serves (uploaded attachments, avatars).
 * The API stores these as `/uploads/…`, which only resolves against the app's
 * own origin — wrong as soon as the API is on another host.
 */
export function assetUrl(path) {
  if (!path) return '';
  if (/^(https?:)?\/\//i.test(path) || path.startsWith('data:')) return path;
  return `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
}
