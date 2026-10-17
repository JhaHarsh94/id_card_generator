/**
 * Response helpers shared by every API route.
 *
 * All errors go out as a stable JSON shape — `{ code, message }` — because the
 * frontend branches on `err.code` (for example `DUPLICATE_ID` shows "this
 * number is already issued" instead of a generic failure). Throwing a Postgres
 * message at the UI would both leak internals and break that contract.
 */

/** Send a JSON response. */
export function json(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  // Functions are same-origin only; never cache a session- or auth-shaped reply.
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

/** Send an error the frontend can act on. */
export function fail(res, status, code, message) {
  json(res, status, { code, message });
}

/**
 * Read a JSON request body.
 *
 * Vercel usually pre-parses it into `req.body`, but not in every shape (it can
 * arrive as a string, or as an already-object body depending on headers), so
 * all three cases are handled here rather than assumed in each route.
 */
export async function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body || '{}');
    } catch {
      return {};
    }
  }
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString('utf8');
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

/**
 * Method guard. Returns true when the route handled the mismatch itself.
 */
export function requireMethod(req, res, allowed) {
  if (allowed.includes(req.method)) return false;
  res.setHeader('Allow', allowed.join(', '));
  fail(res, 405, 'METHOD_NOT_ALLOWED', `Use ${allowed.join(' or ')}.`);
  return true;
}

/**
 * Basic defences for state-changing requests.
 *
 * The session lives in a SameSite=Lax cookie, so a cross-site POST will not
 * carry it at all - this check is the belt to that pair of braces, catching the
 * (older) browsers where Lax does not apply to the request being made. Only
 * requests from a known origin are rejected; requests with no Origin header at
 * all (same-origin navigations, curl) pass.
 */
export function sameOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return true;
  const host = req.headers.host;
  if (!host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

/**
 * Map a Postgres error onto the codes the UI understands.
 */
export function dbError(err, fallback) {
  const code = err?.code;
  if (code === '23505' || /duplicate|unique/i.test(String(err?.message ?? ''))) {
    return { code: 'DUPLICATE_ID', message: 'That member number is already issued.' };
  }
  if (code === 'ECONNREFUSED' || code === 'ENOTFOUND' || code === 'ETIMEDOUT') {
    return { code: 'DB_UNAVAILABLE', message: 'The database is not reachable. Please try again.' };
  }
  return { code: 'DB_ERROR', message: fallback };
}
