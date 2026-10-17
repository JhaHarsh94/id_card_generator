/**
 * API client.
 * ---------------------------------------------------------------------------
 * The single transport for everything that touches Postgres. The browser never
 * sees a database connection string: it calls same-origin `/api/*` functions,
 * which hold the credential on the server. That is the whole reason this layer
 * exists - a browser-side database client would have to ship the credential to
 * every visitor.
 *
 * WHICH BACKEND IS LIVE
 * Chosen once, at module load, from the build:
 *
 *   VITE_DATA_BACKEND=local   -> localStorage (development only)
 *   VITE_DATA_BACKEND=api     -> /api/* (forced, e.g. `vercel dev`)
 *   unset + production build  -> /api/*
 *   unset + `npm run dev`     -> localStorage
 *
 * The default matters: a `vite build` is what gets deployed, so the deployed
 * artefact always talks to the API without anyone having to remember a flag,
 * while `npm run dev` keeps working with no backend at all.
 */

const explicit = import.meta.env.VITE_DATA_BACKEND;

/** True when reads and writes go through /api rather than localStorage. */
export const usingApi = explicit === 'api'
  ? true
  : explicit === 'local'
    ? false
    : Boolean(import.meta.env.PROD);

const BASE = '/api';

/**
 * An error carrying the machine-readable `code` the UI branches on
 * (DUPLICATE_ID, UNAUTHENTICATED, ...). A bare Error would force every caller
 * to pattern-match on a message.
 */
export class ApiError extends Error {
  constructor(code, message, status) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
  }
}

/**
 * Perform a request and normalise the outcome.
 *
 * `credentials: 'same-origin'` is what carries the session cookie; without it
 * every admin call would come back 401.
 */
async function request(path, { method = 'GET', body } = {}) {
  let res;
  try {
    res = await fetch(`${BASE}${path}`, {
      method,
      credentials: 'same-origin',
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError('NETWORK', 'Cannot reach the server. Check your connection.', 0);
  }

  let payload = null;
  try {
    payload = await res.json();
  } catch {
    payload = null;
  }

  if (!res.ok) {
    throw new ApiError(
      payload?.code ?? `HTTP_${res.status}`,
      payload?.message ?? 'Something went wrong. Please try again.',
      res.status,
    );
  }
  return payload ?? {};
}

export const api = {
  get: (path) => request(path),
  post: (path, body) => request(path, { method: 'POST', body: body ?? {} }),
  put: (path, body) => request(path, { method: 'PUT', body: body ?? {} }),
  patch: (path, body) => request(path, { method: 'PATCH', body: body ?? {} }),
  del: (path) => request(path, { method: 'DELETE' }),
};

/** Build a query string from defined values only. */
export function qs(params) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') search.set(key, String(value));
  }
  const text = search.toString();
  return text ? `?${text}` : '';
}
