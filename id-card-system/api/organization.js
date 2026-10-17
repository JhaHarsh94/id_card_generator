import { dbError, fail, json, readBody, requireMethod, sameOrigin } from './_lib/respond.js';
import { requireAdmin } from './_lib/auth.js';
import { query } from './_lib/pg.js';

/**
 * /api/organization
 *   GET — the organisation configuration. PUBLIC.
 *   PUT — replace it. Admin only.
 *
 * GET is public because the login page and the QR verification page both render
 * the trust's name before anyone has signed in, and neither can wait for a
 * session to show a heading.
 *
 * The row is stored as one jsonb document rather than twenty columns: the set
 * of keys is design data that changes with the card, and a schema migration for
 * every new label would be pure overhead. Writes replace the whole document.
 */
export default async function handler(req, res) {
  if (requireMethod(req, res, ['GET', 'PUT'])) return;

  if (req.method === 'GET') {
    try {
      const rows = await query('select data from organization where id = 1');
      return json(res, 200, { data: rows[0]?.data ?? null });
    } catch (err) {
      const e = dbError(err, 'Could not load organisation settings.');
      return fail(res, 500, e.code, e.message);
    }
  }

  const admin = await requireAdmin(req, res);
  if (!admin) return;
  if (!sameOrigin(req)) return fail(res, 403, 'FORBIDDEN', 'Request rejected.');

  const body = await readBody(req);
  const data = body && typeof body.data === 'object' && body.data ? body.data : null;
  if (!data) return fail(res, 400, 'INVALID', 'Nothing to save.');

  // Saving real settings always drops the demo watermark; it is never a value
  // the operator sets deliberately.
  const next = { ...data, isDemo: false };

  try {
    const rows = await query(
      `insert into organization (id, data) values (1, $1::jsonb)
       on conflict (id) do update set data = excluded.data, updated_at = now()
       returning data`,
      [JSON.stringify(next)],
    );
    return json(res, 200, { data: rows[0].data });
  } catch (err) {
    const e = dbError(err, 'Could not save settings.');
    return fail(res, 500, e.code, e.message);
  }
}
