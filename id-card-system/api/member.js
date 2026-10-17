import { dbError, fail, json, requireMethod } from './_lib/respond.js';
import { requireAdmin } from './_lib/auth.js';
import { queryOne } from './_lib/pg.js';
import { toMember } from './_lib/members.js';

/**
 * GET /api/member?memberId=<number>
 *
 * Look up by the PRINTED member number rather than the uuid. The card, the QR
 * code and every deep link address a member by that number, so this is the
 * lookup the app actually performs. Admin only - it returns the full record,
 * including the photograph.
 *
 * Taking the number as a query parameter rather than a path segment is
 * deliberate; see the note in api/member-row.js about the catch-all rewrite
 * shadowing dynamic routes.
 */
export default async function handler(req, res) {
  if (requireMethod(req, res, ['GET'])) return;

  const admin = await requireAdmin(req, res);
  if (!admin) return;

  const memberId = String(req.query?.memberId ?? '');
  if (!memberId) return fail(res, 400, 'INVALID', 'A member number is required.');

  try {
    const row = await queryOne('select * from members where member_id = $1', [memberId]);
    if (!row) return json(res, 200, { member: null });
    return json(res, 200, { member: toMember(row) });
  } catch (err) {
    const e = dbError(err, 'Could not load the member.');
    return fail(res, 500, e.code, e.message);
  }
}
