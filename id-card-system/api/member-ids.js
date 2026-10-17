import { dbError, fail, json, requireMethod } from './_lib/respond.js';
import { query } from './_lib/pg.js';

/**
 * GET /api/member-ids
 *
 * Every number that has been issued — numbers only, no names, no photos.
 *
 * Public on purpose: the number is printed on the face of the card, so it is
 * already visible to anyone holding one, and knowing which numbers are taken is
 * what stops the "next number" suggestion from offering one that will fail the
 * unique constraint. Nothing here identifies a person.
 */
export default async function handler(req, res) {
  if (requireMethod(req, res, ['GET'])) return;
  try {
    const rows = await query('select member_id from members order by member_id');
    return json(res, 200, { memberIds: rows.map((r) => r.member_id) });
  } catch (err) {
    const e = dbError(err, 'Could not load member numbers.');
    return fail(res, 500, e.code, e.message);
  }
}
