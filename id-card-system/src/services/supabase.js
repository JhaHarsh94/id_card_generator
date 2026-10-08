import { createClient } from '@supabase/supabase-js';

/**
 * Supabase client.
 *
 * The client is only created when BOTH environment variables are present.
 * Until the organisation supplies them the app runs in local demo mode, so the
 * UI can be developed and reviewed without a backend.
 *
 * IMPORTANT: `VITE_SUPABASE_ANON_KEY` is the *public* anon key. It is safe to
 * ship in frontend code ONLY because every table is protected by Row Level
 * Security (see supabase/schema.sql). The service-role key must never be used
 * here and must never be committed.
 */

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

/** True when a real backend is configured. */
export const supabaseConfigured = Boolean(url && anonKey);

export const supabase = supabaseConfigured
  ? createClient(url, anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  })
  : null;

/** Bucket that stores member photos and organisation assets. */
export const STORAGE_BUCKET = 'id-assets';

/**
 * Build a public URL for a stored asset.
 * @param {string} path  e.g. 'members/0095030/photo.webp'
 */
export function assetUrl(path) {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;
  if (!supabase) return null;
  return supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path).data.publicUrl;
}