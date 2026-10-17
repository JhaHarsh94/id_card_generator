import { fail, json, readBody, requireMethod, sameOrigin } from '../_lib/respond.js';
import { createSession, recordLoginAttempt, clearLoginAttempts, loginThrottled, verifyPassword } from '../_lib/auth.js';
import { queryOne } from '../_lib/pg.js';

/**
 * POST /api/auth/login
 *
 * Sets an httpOnly session cookie. The response never distinguishes "unknown
 * address" from "wrong password" - that difference is exactly what makes an
 * account-existence oracle useful to an attacker.
 */
export default async function handler(req, res) {
  if (requireMethod(req, res, ['POST'])) return;
  if (!sameOrigin(req)) return fail(res, 403, 'FORBIDDEN', 'Request rejected.');

  const body = await readBody(req);
  const email = String(body.email ?? '').trim().toLowerCase();
  const password = String(body.password ?? '');

  if (!email.includes('@')) return fail(res, 400, 'INVALID', 'Enter a valid email address.');
  if (!password) return fail(res, 400, 'INVALID', 'Enter your password.');

  const ip = (req.headers['x-forwarded-for'] ?? '').split(',')[0].trim() || 'unknown';
  const key = `${ip}:${email}`;

  const throttle = loginThrottled(key);
  if (throttle.blocked) {
    return fail(res, 429, 'RATE_LIMITED', `Too many attempts. Try again in ${throttle.retryAfter} seconds.`);
  }

  let user;
  try {
    user = await queryOne(
      'select id, name, email, role, password_hash from admin_users where lower(email) = $1',
      [email],
    );
  } catch {
    return fail(res, 503, 'DB_UNAVAILABLE', 'Sign-in is temporarily unavailable. Please try again.');
  }

  const ok = user ? await verifyPassword(password, user.password_hash) : false;
  if (!user || !ok) {
    recordLoginAttempt(key);
    return fail(res, 401, 'INVALID_CREDENTIALS', 'Email or password is incorrect.');
  }

  clearLoginAttempts(key);
  try {
    await createSession(req, res, user);
  } catch {
    return fail(res, 503, 'DB_UNAVAILABLE', 'Sign-in is temporarily unavailable. Please try again.');
  }

  json(res, 200, {
    ok: true,
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
  });
}
