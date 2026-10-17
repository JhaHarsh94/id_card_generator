import { json, requireMethod } from '../_lib/respond.js';
import { destroySession } from '../_lib/auth.js';

/** POST /api/auth/logout — revoke the session and clear the cookie. */
export default async function handler(req, res) {
  if (requireMethod(req, res, ['POST'])) return;
  try {
    await destroySession(req, res);
  } catch {
    // Even if the delete fails, the cookie must go.
  }
  json(res, 200, { ok: true });
}
