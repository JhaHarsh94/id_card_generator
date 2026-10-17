/**
 * Password hashing and cookie sessions.
 *
 * WHY HASHED SESSIONS
 * The browser holds only a random 256-bit token; the database stores the
 * SHA-256 of it. A dump of `sessions` therefore does not hand anyone a working
 * login - they would have to invert the digest, which for a random 32-byte
 * token is not feasible.
 *
 * WHY NOT A JWT
 * A self-contained token cannot be revoked without a server-side deny-list,
 * and "log this admin out now" is a requirement for a system that issues
 * credentials. A row in `sessions` gives immediate revocation and an honest
 * expiry, at the cost of one indexed lookup.
 *
 * WHY SCRYPT
 * It is in Node's standard library, so it adds no dependency, and it is memory
 * hard - a determined attacker cannot trade GPU cycles for bcrypt's cheap
 * verification the way they can with a single unsalted SHA-256.
 */

import { randomBytes, scrypt as scryptCb, timingSafeEqual, createHash } from 'node:crypto';
import { queryOne } from './pg.js';

const COOKIE_NAME = 'idcms_session';
const SESSION_DAYS = 30;
const SCRYPT = { N: 16384, r: 8, p: 1, keylen: 64 };

/* ------------------------------------------------------------------ crypto */

function scrypt(password, salt) {
  return new Promise((resolve, reject) => {
    scryptCb(
      password,
      salt,
      SCRYPT.keylen,
      { N: SCRYPT.N, r: SCRYPT.r, p: SCRYPT.p, maxmem: 64 * 1024 * 1024 },
      (err, buf) => (err ? reject(err) : resolve(buf.toString('hex'))),
    );
  });
}

/** Produce a storable `scrypt$N$r$p$salt$hash` string. */
export async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const hash = await scrypt(password, salt);
  return `scrypt$${SCRYPT.N}$${SCRYPT.r}$${SCRYPT.p}$${salt}$${hash}`;
}

/**
 * Verify a password against a stored hash.
 *
 * Uses a timing-safe comparison and, when the stored value is malformed,
 * returns false rather than throwing - a corrupt row must not become a
 * 500 that tells an attacker which accounts exist.
 */
export async function verifyPassword(password, stored) {
  if (typeof stored !== 'string') return false;
  const parts = stored.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
  const [, N, r, p, salt, expected] = parts;
  try {
    const actual = await scryptPasswordWith(password, salt, { N: +N, r: +r, p: +p });
    const a = Buffer.from(actual, 'utf8');
    const b = Buffer.from(expected, 'utf8');
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

function scryptPasswordWith(password, salt, opts) {
  return new Promise((resolve, reject) => {
    scryptCb(
      password,
      salt,
      SCRYPT.keylen,
      { N: opts.N, r: opts.r, p: opts.p, maxmem: 64 * 1024 * 1024 },
      (err, buf) => (err ? reject(err) : resolve(buf.toString('hex'))),
    );
  });
}

const sha256 = (text) => createHash('sha256').update(text).digest('hex');

/* ------------------------------------------------------------------ cookies */

/** Read a single cookie by name. */
export function readCookie(req, name) {
  const header = req.headers.cookie;
  if (!header) return null;
  for (const pair of header.split(';')) {
    const idx = pair.indexOf('=');
    if (idx === -1) continue;
    const key = pair.slice(0, idx).trim();
    if (key === name) return decodeURIComponent(pair.slice(idx + 1).trim());
  }
  return null;
}

function isSecure(req) {
  // Behind Vercel the original protocol arrives in this header; treating a
  // secure cookie as non-secure would silently drop the login in production.
  return req.headers['x-forwarded-proto'] === 'https';
}

function sessionCookie(req, token, maxAgeSeconds) {
  const attrs = [
    `${COOKIE_NAME}=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${maxAgeSeconds}`,
  ];
  if (isSecure(req)) attrs.push('Secure');
  return attrs.join('; ');
}

/* ------------------------------------------------------------------ sessions */

/** Issue a new session for an admin and set the cookie. */
export async function createSession(req, res, admin) {
  const token = randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86400_000);
  await queryOne(
    'insert into sessions (token_hash, admin_id, expires_at) values ($1, $2, $3) returning token_hash',
    [sha256(token), admin.id, expiresAt.toISOString()],
  );
  res.setHeader('Set-Cookie', sessionCookie(req, token, SESSION_DAYS * 86400));
  return token;
}

/** Revoke the session behind this request, if any. */
export async function destroySession(req, res) {
  const token = readCookie(req, COOKIE_NAME);
  if (token) {
    await queryOne('delete from sessions where token_hash = $1', [sha256(token)]);
  }
  // Max-Age=0 makes the browser drop it rather than leave a dead cookie.
  res.setHeader('Set-Cookie', sessionCookie(req, '', 0));
}

/** The admin attached to this request's session, or null. */
export async function currentUser(req) {
  const token = readCookie(req, COOKIE_NAME);
  if (!token) return null;

  const row = await queryOne(
    `select a.id, a.name, a.email, a.role, s.expires_at
       from sessions s
       join admin_users a on a.id = s.admin_id
      where s.token_hash = $1
      limit 1`,
    [sha256(token)],
  );
  if (!row) return null;

  if (new Date(row.expires_at).getTime() < Date.now()) {
    // Opportunistic cleanup: an expired row must not keep matching.
    await queryOne('delete from sessions where token_hash = $1', [sha256(token)]);
    return null;
  }

  return { id: row.id, name: row.name, email: row.email, role: row.role };
}

/**
 * The hash of the session behind this request, or null when there is none.
 *
 * Kept separate from currentUser() deliberately: that object is serialised
 * straight into API responses, and a session identifier must never reach the
 * client - even hashed, it is the credential's fingerprint. Handlers that need
 * to reason about "this session versus the others" call this instead.
 */
export function currentTokenHash(req) {
  const token = readCookie(req, COOKIE_NAME);
  return token ? sha256(token) : null;
}

/**
 * Resolve the caller, writing a 401 when there is no valid session.
 * Returns null only after the response has been sent.
 */
export async function requireAdmin(req, res) {
  let user = null;
  try {
    user = await currentUser(req);
  } catch {
    user = null;
  }
  if (!user) {
    res.statusCode = 401;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.end(JSON.stringify({ code: 'UNAUTHENTICATED', message: 'Please sign in to continue.' }));
    return null;
  }
  return user;
}

/* --------------------------------------------------------------- brute force */

/**
 * Deliberately tiny in-memory login throttle.
 *
 * It is per-instance, so it is not a substitute for a real WAF - but it does
 * slow down credential stuffing against a single warm instance, and it needs no
 * new infrastructure to do it. Attempts are keyed by address and reset after a
 * quiet period.
 */
const attempts = new Map();

export function loginThrottled(address) {
  const now = Date.now();
  const entry = attempts.get(address);
  if (!entry) return { blocked: false, retryAfter: 0 };
  // Prune as we go; the map is bounded by distinct addresses seen in one life.
  if (now - entry.last > 600_000) {
    attempts.delete(address);
    return { blocked: false, retryAfter: 0 };
  }
  if (entry.count >= 10 && now - entry.last < 60_000) {
    return { blocked: true, retryAfter: 60 };
  }
  if (now - entry.last > 60_000) entry.count = 0;
  return { blocked: false, retryAfter: 0 };
}

export function recordLoginAttempt(address) {
  const now = Date.now();
  const entry = attempts.get(address) ?? { count: 0, last: now };
  entry.count += 1;
  entry.last = now;
  attempts.set(address, entry);
}

/** A successful sign-in clears the counter for that address. */
export function clearLoginAttempts(address) {
  attempts.delete(address);
}
