import { dbError, fail, json, readBody, requireMethod, sameOrigin } from './_lib/respond.js';
import { requireAdmin } from './_lib/auth.js';
import { query, queryOne } from './_lib/pg.js';
import { toMember, pickWritable } from './_lib/members.js';

/**
 * /api/member-row?id=<uuid>
 *   GET    — one member
 *   PATCH  — update
 *   DELETE — remove
 *
 * Admin only, all three. `id` is the uuid primary key, not the printed member
 * number: the number can change during a correction, the uuid cannot.
 *
 * WHY A QUERY PARAMETER AND NOT /api/members/:id
 * The dynamic-segment form is the more conventional URL, and it was the first
 * version of this route. It cannot be used here: vercel.json carries a
 * catch-all rewrite (`/(.*)` -> `/index.html`) so the single-page app can serve
 * client-side routes, and that rewrite shadows every dynamic function route
 * while leaving flat ones alone. The result was `/api/members/<uuid>` quietly
 * returning the HTML shell - a 200 with a page in it, which a fetch() would
 * happily try to parse as JSON. Flat filenames sidestep the whole ambiguity.
 */
export default async function handler(req, res) {
  if (requireMethod(req, res, ['GET', 'PATCH', 'PUT', 'DELETE'])) return;

  const admin = await requireAdmin(req, res);
  if (!admin) return;

  const id = String(req.query?.id ?? '');
  if (!id) return fail(res, 400, 'INVALID', 'A member id is required.');

  if (req.method === 'GET') {
    try {
      const row = await queryOne('select * from members where id = $1', [id]);
      if (!row) return fail(res, 404, 'NOT_FOUND', 'That member does not exist.');
      return json(res, 200, { member: toMember(row) });
    } catch (err) {
      const e = dbError(err, 'Could not load the member.');
      return fail(res, 500, e.code, e.message);
    }
  }

  if (!sameOrigin(req)) return fail(res, 403, 'FORBIDDEN', 'Request rejected.');

  if (req.method === 'DELETE') {
    try {
      const rows = await query('delete from members where id = $1 returning id', [id]);
      if (!rows.length) return fail(res, 404, 'NOT_FOUND', 'That member does not exist.');
      return json(res, 200, { ok: true });
    } catch (err) {
      const e = dbError(err, 'Could not delete the member.');
      return fail(res, 500, e.code, e.message);
    }
  }

  // PATCH / PUT
  const body = await readBody(req);
  const { values, problems } = pickWritable(body);
  if (problems.length) return fail(res, 400, 'INVALID', problems[0]);

  const entries = Object.entries(values);
  if (!entries.length) return fail(res, 400, 'INVALID', 'Nothing to update.');

  const sets = entries.map(([col], i) => `${col} = $${i + 1}`);
  const params = [...entries.map(([, v]) => v), id];

  try {
    const rows = await query(
      `update members set ${sets.join(', ')} where id = $${params.length} returning *`,
      params,
    );
    if (!rows.length) return fail(res, 404, 'NOT_FOUND', 'That member does not exist.');
    return json(res, 200, { member: toMember(rows[0]) });
  } catch (err) {
    const e = dbError(err, 'Could not update the member.');
    return fail(res, 400, e.code, e.message);
  }
}
