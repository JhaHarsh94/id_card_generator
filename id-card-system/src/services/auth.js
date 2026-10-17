/**
 * Authentication service.
 * ---------------------------------------------------------------------------
 * One interface, two backends:
 *
 *   usingApi  ->  /api/auth/*  against Neon. Sessions live in an httpOnly
 *                 cookie that the browser cannot read or forge; passwords are
 *                 verified server-side with scrypt.
 *
 *   otherwise ->  the local development fallback: users in localStorage with a
 *                 SHA-256 digest. NOT production security (devtools can read
 *                 it), which is exactly why it is never used in a built app.
 *
 * The UI never learns which one is live, so moving to a real backend stayed a
 * configuration change rather than a rewrite.
 */

import { api, usingApi } from './api';

const SESSION_KEY = 'idcms.session';
const USERS_KEY = 'idcms.admins';

/** Demo credential, clearly labelled so nobody mistakes it for production. */
const DEMO_ADMIN = {
  id: 'demo-admin',
  name: 'Administrator',
  email: 'admin@example.com',
  role: 'administrator',
  isDemo: true,
};

async function sha256(text) {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/* ==========================================================================
   Local fallback store (development only)
   ========================================================================== */

function localUsers() {
  try {
    const raw = localStorage.getItem(USERS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

async function ensureDemoUser() {
  const users = localUsers();
  if (users.some((u) => u.email === DEMO_ADMIN.email)) return;
  users.push({ ...DEMO_ADMIN, passwordHash: await sha256('demo1234') });
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

function localSession() {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY) ?? localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeLocalSession(session) {
  if (session) sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
  else {
    sessionStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(SESSION_KEY);
  }
}

/* ==========================================================================
   Public API
   ========================================================================== */

/**
 * Sign in.
 * @returns {{ ok: true, user: object } | { ok: false, error: string }}
 *          Errors are user-safe strings; never raw driver output.
 */
export async function signIn(email, password) {
  const address = String(email ?? '').trim();

  if (!address || !address.includes('@')) {
    return { ok: false, error: 'Enter a valid email address.' };
  }
  if (!password) {
    return { ok: false, error: 'Enter your password.' };
  }

  if (usingApi) {
    try {
      const { user } = await api.post('/auth/login', { email: address, password });
      return { ok: true, user };
    } catch (err) {
      // Deliberately vague: never reveal whether the email exists.
      return { ok: false, error: err?.message ?? 'Email or password is incorrect.' };
    }
  }

  await ensureDemoUser();
  const user = localUsers().find((u) => u.email.toLowerCase() === address.toLowerCase());
  if (!user || user.passwordHash !== (await sha256(password))) {
    return { ok: false, error: 'Email or password is incorrect.' };
  }

  const session = {
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
    startedAt: new Date().toISOString(),
  };
  writeLocalSession(session);
  return { ok: true, user: session.user };
}

export async function signOut() {
  if (usingApi) {
    try {
      await api.post('/auth/logout');
    } catch {
      // The cookie is cleared server-side; a network blip must not trap the
      // user in a signed-in-looking shell.
    }
    return { ok: true };
  }
  writeLocalSession(null);
  return { ok: true };
}

/** Current session user, or null. */
export async function getSession() {
  if (usingApi) {
    try {
      const { user } = await api.get('/auth/session');
      return user ?? null;
    } catch {
      // A backend outage resolves to anonymous, which locks the admin area
      // down rather than exposing it.
      return null;
    }
  }
  return localSession()?.user ?? null;
}

/**
 * Change the signed-in administrator's password.
 * Requires the current password - a live session proves the browser was signed
 * in, not that the person at the keyboard owns the account.
 */
export async function changePassword(currentPassword, newPassword) {
  if (!usingApi) return { ok: false, error: 'Not available in local mode.' };
  try {
    await api.post('/auth/password', { currentPassword, newPassword });
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err?.message ?? 'Could not change the password.' };
  }
}

/**
 * Subscribe to auth changes.
 *
 * Cookie sessions have no push channel, so nothing needs to be observed: the
 * provider already owns the state and updates it on sign-in and sign-out. The
 * local fallback needs no subscription either. Returning a no-op unsubscribe
 * keeps the provider's shape identical.
 */
export function onAuthChange() {
  return () => {};
}

/**
 * Password resets.
 *
 * There is no mailer wired to this deployment, so a self-service reset would be
 * a promise the system cannot keep. The sign-in screen points people at the
 * administrator instead; this stays so the page has a stable contract.
 */
export async function requestPasswordReset(email) {
  const address = String(email ?? '').trim();
  if (!address.includes('@')) {
    return { ok: false, error: 'Enter a valid email address.' };
  }
  return { ok: true };
}

/** The demo credential, surfaced on the login page in local mode only. */
export function demoCredential() {
  return usingApi ? null : { email: DEMO_ADMIN.email, password: 'demo1234' };
}
