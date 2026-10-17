import { dbError, fail, json, readBody, requireMethod, sameOrigin } from './_lib/respond.js';
import { requireAdmin } from './_lib/auth.js';
import { query } from './_lib/pg.js';
import { toMember, pickWritable } from './_lib/members.js';

/**
 * /api/members
 *   GET  — every member, newest first. Admin only.
 *   POST — create one. Admin only.
 *
 * Reads require a session: the register holds identity documents, so unlike the
 * public verification page it is never world-readable.
 */
export default async function handler(req, res) {
  if (requireMethod(req, res, ['GET', 'POST'])) return;

  const admin = await requireAdmin(req, res);
  if (!admin) return;

  if (req.method === 'GET') {
    try {
      const rows = await query('select * from members order by created_at desc');
      return json(res, 200, { members: rows.map(toMember) });
    } catch (err) {
      const e = dbError(err, 'Could not load members.');
      return fail(res, 500, e.code, e.message);
    }
  }

  if (!sameOrigin(req)) return fail(res, 403, 'FORBIDDEN', 'Request rejected.');
  const body = await readBody(req);

  if (!body.memberId || !String(body.memberId).trim()) {
    return fail(res, 400, 'INVALID', 'A member number is required.');
  }
  if (!body.fullName || !String(body.fullName).trim()) {
    return fail(res, 400, 'INVALID', 'A member name is required.');
  }

  const { values, problems } = pickWritable(body);
  if (problems.length) return fail(res, 400, 'INVALID', problems[0]);

  const columns = [...Object.keys(values), 'created_by'];
  const params = [...Object.values(values), admin.id];
  const placeholders = params.map((_, i) => `$${i + 1}`).join(', ');

  try {
    const rows = await query(
      `insert into members (${columns.join(', ')}) values (${placeholders}) returning *`,
      params,
    );
    return json(res, 201, { member: toMember(rows[0]) });
  } catch (err) {
    const e = dbError(err, 'Could not create the member.');
    return fail(res, 400, e.code, e.message);
  }
}
