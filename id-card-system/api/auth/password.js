import { fail, json, readBody, requireMethod, sameOrigin } from '../_lib/respond.js';
import { currentTokenHash, hashPassword, requireAdmin, verifyPassword } from '../_lib/auth.js';
import { query, queryOne } from '../_lib/pg.js';

/** A password has to be worth something: 10+ characters with a mix. */
function passwordProblem(password) {
  const value = String(password ?? '');
  if (value.length < 10) return 'Use at least 10 characters.';
  if (!/[a-z]/.test(value)) return 'Add a lowercase letter.';
  if (!/[A-Z]/.test(value)) return 'Add an uppercase letter.';
  if (!/[0-9]/.test(value)) return 'Add a number.';
  return null;
}

/**
 * POST /api/auth/password
 *
 * Change the signed-in admin's own password. Demands the current password even
 * though the caller already holds a session: a session proves the browser was
 * signed in, not that the person at the keyboard is the owner, and this is the
 * one action that lets an attacker take an account over permanently.
 */
export default async function handler(req, res) {
  if (requireMethod(req, res, ['POST'])) return;

  const admin = await requireAdmin(req, res);
  if (!admin) return;
  if (!sameOrigin(req)) return fail(res, 403, 'FORBIDDEN', 'Request rejected.');

  const body = await readBody(req);
  const current = String(body.currentPassword ?? '');
  const next = String(body.newPassword ?? '');

  const problem = passwordProblem(next);
  if (problem) return fail(res, 400, 'WEAK_PASSWORD', problem);

  const row = await queryOne('select password_hash from admin_users where id = $1', [admin.id]);
  if (!row) return fail(res, 404, 'NOT_FOUND', 'Account not found.');

  if (!(await verifyPassword(current, row.password_hash))) {
    return fail(res, 401, 'INVALID_CREDENTIALS', 'Your current password is incorrect.');
  }

  const hash = await hashPassword(next);
  await query('update admin_users set password_hash = $1 where id = $2', [hash, admin.id]);

  /*
   * Sign out every OTHER session.
   *
   * The caller's own session must survive. Being ejected from the very page you
   * used to change your password reads as a failure, and it teaches people not
   * to rotate credentials - so the session to keep is identified by its own
   * token hash.
   *
   * NOT by "the most recent row". On an account signed in from two devices, the
   * newest session belongs to whichever device signed in last, which is not
   * necessarily the one making this request. Keeping that instead would sign the
   * caller out and leave the device they were trying to protect still logged in
   * - wrong in both directions at once.
   */
  const tokenHash = currentTokenHash(req);
  if (tokenHash) {
    await query(
      'delete from sessions where admin_id = $1 and token_hash <> $2',
      [admin.id, tokenHash],
    );
  } else {
    // No cookie to preserve: revoke everything rather than guess.
    await query('delete from sessions where admin_id = $1', [admin.id]);
  }

  json(res, 200, { ok: true });
}
