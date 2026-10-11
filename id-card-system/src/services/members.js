/**
 * Members data store - Supabase backed.
 * ---------------------------------------------------------------------------
 * Drop-in replacement for services/members.js. The exported function
 * signatures are identical on purpose, so every page imports from here without
 * knowing which backend is live.
 *
 * The choice of backend is made once, at module load, from the environment:
 *
 *   VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY present  ->  Supabase
 *   otherwise                                          ->  localStore
 *
 * Both are exported through the SAME names, so the UI never branches on the
 * backend. That is what lets the app be reviewed with no backend at all and
 * then switched to a real one without touching a single page.
 *
 * Row Level Security does the access control here - the anon key is safe to
 * ship in the browser bundle because it can only read rows the policies allow.
 * Admin-only operations simply fail at the database if the caller is not an
 * admin; nothing in this file trusts the client.
 */

import {
  createMember as localCreateMember,
  deleteMember as localDeleteMember,
  existingMemberIds as localExistingMemberIds,
  getMember as localGetMember,
  getMemberByRowId as localGetMemberByRowId,
  getOrganization as localGetOrganization,
  listMembers as localListMembers,
  resetDemoData as localResetDemoData,
  resetOrganization as localResetOrganization,
  saveOrganization as localSaveOrganization,
  updateMember as localUpdateMember,
} from './localStore';

import { organizationDefaults } from '../config/organization.default';
import { toISODate, today } from '../utils/date';
import { supabase, supabaseConfigured } from './supabase';

/** True when reads and writes go to Postgres rather than localStorage. */
export const usingSupabase = supabaseConfigured;

/* ==========================================================================
   Row <-> app-object mapping
   ==========================================================================
   The database uses snake_case; the UI uses camelCase. Keeping the translation
   in one place means a column rename touches this file only, not every page.
   ========================================================================== */

function toMember(row) {
  if (!row) return null;
  return {
    id: row.id,
    memberId: row.member_id,
    fullName: row.full_name,
    designation: row.designation,
    state: row.state,
    district: row.district ?? '',
    // The UI stores a ready-to-use URL. Storage objects live in a PRIVATE
    // bucket, so the path is kept alongside and resolved on demand.
    photoUrl: row.photo_url ?? null,
    photoPath: row.photo_path ?? null,
    validFrom: row.valid_from ?? '',
    validUntil: row.valid_until ?? '',
    status: row.status ?? 'active',
    revocationReason: row.revocation_reason ?? null,
    isDemo: false,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Map an app object to column names.
 *
 * `id` is deliberately excluded: it is the uuid primary key, assigned by the
 * database. Writing it back would either be ignored or, worse, silently move a
 * record to a different primary key.
 */
function toColumns(data) {
  const out = {};
  const map = {
    memberId: 'member_id',
    fullName: 'full_name',
    designation: 'designation',
    state: 'state',
    district: 'district',
    photoUrl: 'photo_url',
    photoPath: 'photo_path',
    validFrom: 'valid_from',
    validUntil: 'valid_until',
    status: 'status',
    revocationReason: 'revocation_reason',
  };
  for (const [key, column] of Object.entries(map)) {
    if (data[key] !== undefined) out[column] = data[key];
  }
  // Dates must arrive as YYYY-MM-DD; a Date object would be rejected.
  if (out.valid_from) out.valid_from = toISODate(out.valid_from);
  if (out.valid_until) out.valid_until = toISODate(out.valid_until);
  return out;
}

/**
 * Raise an error the UI can distinguish.
 *
 * The UI checks `err.code === 'DUPLICATE_ID'` to show "this number is already
 * issued" instead of a generic failure, so the code has to survive the trip
 * through PostgREST's error object.
 */
function raise(message, code) {
  const err = new Error(message);
  if (code) err.code = code;
  return err;
}

/** Turn a PostgREST error into something the UI can act on. */
function rethrow(error, context) {
  const raw = String(error?.message ?? error ?? '');
  if (error?.code === '23505' || /duplicate key|already exists/i.test(raw)) {
    throw raise('duplicate', 'DUPLICATE_ID');
  }
  throw raise(`${context}: ${raw}`, error?.code);
}

/* ==========================================================================
   Members
   ========================================================================== */

async function sbListMembers() {
  const { data, error } = await supabase
    .from('members')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) rethrow(error, 'Could not load members');
  return (data ?? []).map(toMember);
}

async function sbGetMember(memberId) {
  const { data, error } = await supabase
    .from('members')
    .select('*')
    .eq('member_id', memberId)
    .maybeSingle();
  if (error) rethrow(error, 'Could not load the member');
  return toMember(data);
}

async function sbGetMemberByRowId(rowId) {
  const { data, error } = await supabase
    .from('members')
    .select('*')
    .eq('id', rowId)
    .maybeSingle();
  if (error) rethrow(error, 'Could not load the member');
  return toMember(data);
}

async function sbCreateMember(data) {
  const row = {
    ...toColumns(data),
    // created_by ties the record to the signed-in admin. RLS allows the insert
    // only if that admin row exists, so an unauthenticated caller is rejected
    // by the database rather than by a check here.
    created_by: (await currentAdminId()) ?? null,
  };
  // photoFile is a browser-side File handle; only the already-compressed
  // data URL in photoUrl is meaningful to the database.
  delete row.photoFile;

  const { data: created, error } = await supabase
    .from('members')
    .insert(row)
    .select('*')
    .single();
  if (error) rethrow(error, 'Could not create the member');
  return toMember(created);
}

async function sbUpdateMember(rowId, patch) {
  const { data, error } = await supabase
    .from('members')
    .update(toColumns(patch))
    .eq('id', rowId)
    .select('*')
    .single();
  if (error) rethrow(error, 'Could not update the member');
  return toMember(data);
}

async function sbDeleteMember(rowId) {
  const { error } = await supabase.from('members').delete().eq('id', rowId);
  if (error) rethrow(error, 'Could not delete the member');
}

/**
 * The signed-in admin's uuid, or null when there is no session.
 *
 * Returns null rather than throwing: creating a member must not be blocked by a
 * failed lookup - if the id cannot be resolved, RLS decides whether the insert
 * is allowed, which is the correct authority.
 */
async function currentAdminId() {
  const { data } = await supabase.auth.getUser();
  return data?.user?.id ?? null;
}

/* ==========================================================================
   Organisation settings
   ==========================================================================
   The organization table is a single row (id = 1). Reads are public; writes are
   admin-only per RLS.
   ========================================================================== */

const ORG_MAP = {
  name: 'organization_name',
  nameHi: 'organization_name_hi',
  registrationMark: 'registration_mark',
  registrationText: 'registration_text',
  registrationValue: 'registration_value',
  trustNameEn: 'trust_name_en',
  authorityText: 'authority_text',
  isoText: 'iso_text',
  logoUrl: 'logo_url',
  sealUrl: 'seal_url',
  signatureUrl: 'signature_url',
  signatoryName: 'signatory_name',
  signatoryDesignation: 'signatory_designation',
  scopeText: 'scope_text',
  supportText: 'support_text',
  footerText: 'footer_text',
  idPrefix: 'id_prefix',
  idStart: 'id_start',
  idPadding: 'id_padding',
  defaultValidityMonths: 'default_validity_months',
  qrEnabled: 'qr_enabled',
  isDemo: 'is_demo',
};

/**
 * Merge one organization row onto the defaults.
 *
 * A column that is empty means "not configured yet", NOT "the trust wants a
 * blank here". Treating '' as a real value wiped good defaults: the database
 * ships with every text column at its '' default, so registration_text,
 * footer_text and signatory_name all overwrote the real values and the card
 * rendered with a blank footer and a DEMO DATA watermark.
 *
 * So only a value that carries something is allowed to replace a default.
 */
function applyOrganizationRow(row) {
  const next = { ...organizationDefaults };
  for (const [key, column] of Object.entries(ORG_MAP)) {
    const value = row?.[column];
    if (value === undefined || value === null) continue;
    if (typeof value === 'string' && value.trim() === '') continue;
    next[key] = value;
  }
  // A row that exists but has never been filled in is still demo data. The
  // watermark stays on until is_demo is explicitly turned off.
  if (row?.is_demo === false) next.isDemo = false;
  return next;
}

/**
 * Cached organisation settings.
 *
 * Seeded from localStore so that reading is meaningful before any network call
 * completes - a login page that renders the trust's name cannot afford to wait
 * for a round trip. `hydrateStores()` replaces it with the database row as soon
 * as that arrives.
 *
 * This is why getOrganization() stays SYNCHRONOUS even when Supabase is live.
 * It is called from render paths in thirteen places; making it async would mean
 * rewriting every one of them and, worse, would make the card flash empty on
 * every load. A synchronous read of a warmed cache is the cheaper trade.
 */
let orgCache = localGetOrganization();

/** Member numbers already issued. Same caching rationale as orgCache. */
let idsCache = localExistingMemberIds();

function getOrganization() {
  return orgCache;
}

async function sbSaveOrganization(patch) {
  const row = { id: 1, is_demo: false };
  for (const [key, value] of Object.entries(patch)) {
    const column = ORG_MAP[key];
    if (column && value !== undefined) row[column] = value;
  }
  const { data, error } = await supabase
    .from('organization')
    .upsert(row, { onConflict: 'id' })
    .select('*')
    .single();
  if (error) rethrow(error, 'Could not save settings');
  const next = applyOrganizationRow(data);
  next.isDemo = false;
  orgCache = next;
  return next;
}

/**
 * Public lookup for the QR verification page.
 *
 * MUST read `public_members`, not `members`. The members table is admin-only
 * under RLS, so an anonymous visitor scanning a QR would get an RLS error and
 * the page would report NOT FOUND for a perfectly valid card. public_members is
 * the curated, world-readable view built for exactly this.
 *
 * The returned shape deliberately omits revocation_reason, photo and district -
 * those are the organisation's records, not a stranger's business.
 */
async function sbGetPublicMember(memberId) {
  const { data, error } = await supabase
    .from('public_members')
    .select('*')
    .eq('member_id', memberId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;

  return {
    id: null,
    memberId: data.member_id,
    fullName: data.full_name,
    designation: data.designation,
    state: data.state,
    validUntil: data.valid_until,
    status: data.effective_status,
    organizationName: data.organization_name,
    isPublic: true,
  };
}

/**
 * Every issued member number.
 *
 * Read from public_members rather than members: the members table is admin-only,
 * and the public form needs this list to suggest the next free number without a
 * session. Only the numbers are exposed - no names, no photos.
 */
async function sbExistingMemberIds() {
  const { data, error } = await supabase.from('public_members').select('member_id');
  if (error) return localExistingMemberIds();
  return (data ?? []).map((r) => r.member_id);
}

/**
 * Pull the organisation row and the issued member numbers into the caches.
 *
 * Called once when the app mounts. Everything that reads getOrganization() or
 * existingMemberIds() synchronously afterwards is therefore already correct.
 */
export async function hydrateStores() {
  if (!usingSupabase) return;

  const [org, ids] = await Promise.all([
    supabase.from('organization').select('*').eq('id', 1).maybeSingle(),
    supabase.from('public_members').select('member_id'),
  ]);

  if (!org.error && org.data) {
    orgCache = applyOrganizationRow(org.data);
  }

  if (!ids.error && ids.data) {
    idsCache = ids.data.map((r) => r.member_id);
  }
}

/** Synchronous, cached. See the note on orgCache above. */
export function existingMemberIds() {
  return idsCache;
}

/**
 * Refresh the id cache after a write, so the next suggestion sees the number
 * that was just issued instead of offering it again.
 */
export async function refreshMemberIds() {
  if (!usingSupabase) return localExistingMemberIds();
  return sbExistingMemberIds().then((ids) => {
    idsCache = ids;
    return ids;
  });
}

/* ==========================================================================
   Public export
   ==========================================================================
   Signatures are identical across both backends. The two synchronous reads
   (getOrganization, existingMemberIds) are served from cache on either backend,
   so no call site has to know which one is live.
   ========================================================================== */

export const listMembers = usingSupabase ? sbListMembers : localListMembers;
export const getMember = usingSupabase ? sbGetMember : localGetMember;
export const getMemberByRowId = usingSupabase ? sbGetMemberByRowId : localGetMemberByRowId;
export const createMember = usingSupabase ? sbCreateMember : localCreateMember;
export const updateMember = usingSupabase ? sbUpdateMember : localUpdateMember;
export const deleteMember = usingSupabase ? sbDeleteMember : localDeleteMember;
export const saveOrganization = usingSupabase ? sbSaveOrganization : localSaveOrganization;
export const getPublicMember = usingSupabase ? sbGetPublicMember : localGetMember;

export { getOrganization };

/** Clear the caches back to whatever localStorage holds (development helper). */
export function resetOrganization() {
  orgCache = localResetOrganization();
  return orgCache;
}

/*
 * Renew and revoke are expressed as an update of status/validity, so they are
 * built on whichever updateMember is live rather than duplicated per backend.
 * Renewing a revoked ID must not silently reinstate it - that rule is the
 * organisation's, not the storage layer's, so it is applied here.
 */
export async function renewMember(rowId, validUntil) {
  const current = await getMemberByRowId(rowId);
  if (!current) return null;
  return updateMember(rowId, {
    validFrom: toISODate(today()),
    validUntil: toISODate(validUntil),
    status: current.status === 'revoked' ? 'revoked' : 'active',
  });
}

export function revokeMember(rowId, reason) {
  return updateMember(rowId, { status: 'revoked', revocationReason: reason ?? null });
}

export async function checkMemberIdAvailable(memberId, exceptRowId = null) {
  if (!usingSupabase) {
    const found = await localGetMember(memberId);
    return !found || found.id === exceptRowId;
  }
  const { data, error } = await supabase
    .from('members')
    .select('id')
    .eq('member_id', memberId)
    .maybeSingle();
  // On error, allow the attempt through rather than blocking a legitimate
  // number - the unique constraint is the real authority and will reject it.
  if (error) return true;
  return !data || data.id === exceptRowId;
}

/** Wipe the local demo data. Meaningless when Supabase is live. */
export function resetDemoData() {
  return localResetDemoData();
}