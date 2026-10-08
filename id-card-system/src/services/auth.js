/**
 * Authentication service.
 * ---------------------------------------------------------------------------
 * Two backends behind one interface:
 *
 *   Supabase Auth  - used as soon as VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY
 *                    are present. This is the production path.
 *
 *   Local fallback - used only for development before a project is connected.
 *                    Credentials are held in localStorage and the password is
 *                    compared as a SHA-256 digest, never as plaintext.
 *
 * The UI never knows which one is active, so connecting Supabase later is a
 * configuration change rather than a code change.
 *
 * The fallback is NOT production security: anyone with devtools can read
 * localStorage. It exists so the login flow can be built and reviewed now.
 */

import { supabase, supabaseConfigured } from './supabase';

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
   Local fallback store
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

export function usingSupabase() {
  return supabaseConfigured;
}

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

  if (supabaseConfigured) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: address,
      password,
    });
    if (error) {
      // Deliberately vague: never reveal whether the email exists.
      return { ok: false, error: 'Email or password is incorrect.' };
    }
    return {
      ok: true,
      user: {
        id: data.user.id,
        email: data.user.email,
        name: data.user.user_metadata?.name ?? address,
        role: data.user.user_metadata?.role ?? 'administrator',
      },
    };
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
  if (supabaseConfigured) {
    await supabase.auth.signOut();
    return { ok: true };
  }
  writeLocalSession(null);
  return { ok: true };
}

/** Current session user, or null. */
export async function getSession() {
  if (supabaseConfigured) {
    const { data } = await supabase.auth.getSession();
    const user = data?.session?.user;
    if (!user) return null;
    return {
      id: user.id,
      email: user.email,
      name: user.user_metadata?.name ?? user.email,
      role: user.user_metadata?.role ?? 'administrator',
    };
  }
  return localSession()?.user ?? null;
}

/** Subscribe to auth changes (sign-in, sign-out, token refresh). */
export function onAuthChange(handler) {
  if (supabaseConfigured) {
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      handler(
        session
          ? {
            id: session.user.id,
            email: session.user.email,
            name: session.user.user_metadata?.name ?? session.user.email,
            role: session.user.user_metadata?.role ?? 'administrator',
          }
          : null,
      );
    });
    return () => data.subscription.unsubscribe();
  }
  return () => {};
}

/**
 * Start a password reset.
 * Always reports success, whether or not the address exists - telling an
 * anonymous caller which emails are registered would leak account data.
 */
export async function requestPasswordReset(email) {
  const address = String(email ?? '').trim();
  if (!address.includes('@')) {
    return { ok: false, error: 'Enter a valid email address.' };
  }
  if (supabaseConfigured) {
    await supabase.auth.resetPasswordForEmail(address, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
  }
  return { ok: true };
}

/** The demo credential, surfaced on the login page in local mode only. */
export function demoCredential() {
  return supabaseConfigured ? null : { email: DEMO_ADMIN.email, password: 'demo1234' };
}