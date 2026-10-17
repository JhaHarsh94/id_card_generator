import { json, requireMethod } from '../_lib/respond.js';
import { currentUser } from '../_lib/auth.js';

/**
 * GET /api/auth/session
 *
 * Answers "who is signed in?" for a page load. A missing or stale session is a
 * perfectly normal answer (200 with `user: null`), not an error - the boot
 * sequence calls this before it knows whether to show the admin area.
 */
export default async function handler(req, res) {
  if (requireMethod(req, res, ['GET'])) return;
  let user = null;
  try {
    user = await currentUser(req);
  } catch {
    user = null;
  }
  json(res, 200, { user });
}
