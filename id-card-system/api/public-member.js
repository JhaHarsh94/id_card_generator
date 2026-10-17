import { dbError, fail, json, requireMethod } from './_lib/respond.js';
import { queryOne } from './_lib/pg.js';
import { effectiveStatus } from './_lib/members.js';

/**
 * GET /api/public-member?memberId=<number>
 *
 * The QR verification endpoint, and the ONLY member read that is deliberately
 * unauthenticated - someone scanning a card has no account, and a verification
 * page that required one would be useless.
 *
 * What it returns is a strict subset: enough to check the card in your hand
 * against the register, and nothing more. No photograph (it would let anyone
 * who guesses a number harvest faces), no revocation reason (an internal note),
 * no internal ids.
 *
 * `district` IS included: it is printed on the face of the card, so withholding
 * it would only stop a verifier from matching the two.
 *
 * The number arrives as a query parameter rather than a path segment; see the
 * note in api/member-row.js about the catch-all rewrite shadowing dynamic
 * routes.
 */
export default async function handler(req, res) {
  if (requireMethod(req, res, ['GET'])) return;

  const memberId = String(req.query?.memberId ?? '');
  if (!memberId) return fail(res, 400, 'INVALID', 'A member number is required.');

  try {
    const [row, org] = await Promise.all([
      queryOne(
        'select member_id, full_name, designation, state, district, valid_until, status from members where member_id = $1',
        [memberId],
      ),
      queryOne('select data from organization where id = 1'),
    ]);

    if (!row) return json(res, 200, { member: null });

    return json(res, 200, {
      member: {
        id: null,
        memberId: row.member_id,
        fullName: row.full_name,
        designation: row.designation,
        state: row.state,
        district: row.district ?? '',
        validUntil: row.valid_until,
        status: effectiveStatus(row),
        organizationName: org?.data?.name ?? null,
        isPublic: true,
      },
    });
  } catch (err) {
    const e = dbError(err, 'Verification is temporarily unavailable.');
    return fail(res, 503, e.code, e.message);
  }
}
