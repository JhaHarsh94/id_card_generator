/**
 * Members data store.
 * ---------------------------------------------------------------------------
 * One interface, two backends, chosen once at module load:
 *
 *   usingApi  ->  /api/*  (Neon Postgres, via the serverless functions in api/)
 *   otherwise ->  localStorage (services/localStore.js, development only)
 *
 * The exported names and signatures are IDENTICAL on both paths, which is the
 * whole point: a page never asks which backend is live. Swapping the backend is
 * a configuration change, not a rewrite.
 *
 * SECURITY
 * The browser holds no database credential at all. Every read and write goes to
 * a same-origin function that owns the connection string and, for anything that
 * is not public by design, checks the session cookie first. There is no
 * client-side "admin" flag to forge, and no anon key that can be replayed.
 *
 * The two synchronous reads - getOrganization() and existingMemberIds() - are
 * served from a warm cache on either backend. See the note on orgCache.
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
import { api, usingApi, qs } from './api';

/** True when reads and writes go to Postgres rather than localStorage. */
export { usingApi };

/* ==========================================================================
   Organisation settings
   ========================================================================== */

/**
 * Merge stored settings onto the defaults.
 *
 * A blank value means "not configured yet", NOT "the trust wants a blank here".
 * Honouring '' wiped real defaults and put a DEMO DATA watermark on real cards,
 * so only a value that carries something may replace a default.
 */
function applyOrganizationData(data) {
  const next = { ...organizationDefaults };
  if (!data || typeof data !== 'object') return next;
  for (const [key, value] of Object.entries(data)) {
    if (value === undefined || value === null) continue;
    if (typeof value === 'string' && value.trim() === '') continue;
    next[key] = value;
  }
  // Settings saved from the real admin area are never demo data.
  next.isDemo = false;
  return next;
}

/**
 * Cached organisation settings.
 *
 * Seeded so reading is meaningful before any network call completes - the login
 * page renders the trust's name and a QR verification page must not flash an
 * empty heading. This is why getOrganization() stays SYNCHRONOUS even though a
 * real backend exists: it is called from render paths in a dozen places, and
 * making it async would mean rewriting every one of them.
 */
let orgCache = usingApi ? { ...organizationDefaults } : localGetOrganization();

/** Member numbers already issued. Same caching rationale as orgCache. */
let idsCache = localExistingMemberIds();

/** The signed-in admin's uuid is no longer needed here - the API stamps it. */

/* ==========================================================================
   Members
   ========================================================================== */

async function apiListMembers() {
  const { members } = await api.get('/members');
  return members ?? [];
}

async function apiGetMember(memberId) {
  const { member } = await api.get(`/member${qs({ memberId })}`);
  return member ?? null;
}

async function apiGetMemberByRowId(rowId) {
  const { member } = await api.get(`/member-row${qs({ id: rowId })}`);
  return member ?? null;
}

async function apiCreateMember(data) {
  // photoFile is a browser-side File handle; only the compressed data URL in
  // photoUrl is meaningful to the database.
  const payload = { ...data };
  delete payload.photoFile;
  if (payload.validFrom) payload.validFrom = toISODate(payload.validFrom);
  if (payload.validUntil) payload.validUntil = toISODate(payload.validUntil);

  const { member } = await api.post('/members', payload);
  return member;
}

async function apiUpdateMember(rowId, patch) {
  const payload = { ...patch };
  delete payload.photoFile;
  if (payload.validFrom) payload.validFrom = toISODate(payload.validFrom);
  if (payload.validUntil) payload.validUntil = toISODate(payload.validUntil);

  const { member } = await api.patch(`/member-row${qs({ id: rowId })}`, payload);
  return member;
}

async function apiDeleteMember(rowId) {
  await api.del(`/member-row${qs({ id: rowId })}`);
}

/* ==========================================================================
   Organisation settings - writes
   ========================================================================== */

/**
 * Save a settings patch.
 *
 * The server stores the whole configuration as one document, so the patch is
 * merged onto what is already cached and the complete object is sent. Sending
 * just the patch would blank every field the operator did not touch.
 */
async function apiSaveOrganization(patch) {
  const next = { ...orgCache, ...patch, isDemo: false };
  const { data } = await api.put('/organization', { data: next });
  orgCache = applyOrganizationData(data);
  return orgCache;
}

/**
 * Public lookup for the QR verification page.
 *
 * Unauthenticated by design - a person scanning a card has no account. The
 * server returns a strict subset of the record (no photo, no revocation note).
 */
async function apiGetPublicMember(memberId) {
  const { member } = await api.get(`/public-member${qs({ memberId })}`);
  return member ?? null;
}

/* ==========================================================================
   Caches
   ========================================================================== */

async function apiExistingMemberIds() {
  const { memberIds } = await api.get('/member-ids');
  return memberIds ?? [];
}

/**
 * Pull the organisation document and the issued member numbers into the caches.
 * Called once when the app mounts, so every later synchronous read is correct.
 */
export async function hydrateStores() {
  if (!usingApi) return;

  const [org, ids] = await Promise.allSettled([
    api.get('/organization'),
    apiExistingMemberIds(),
  ]);

  if (org.status === 'fulfilled' && org.value?.data) {
    orgCache = applyOrganizationData(org.value.data);
  }
  if (ids.status === 'fulfilled') {
    idsCache = ids.value;
  }
}

/** Synchronous, cached. See the note on orgCache. */
export function existingMemberIds() {
  return idsCache;
}

/**
 * Refresh the id cache after a write, so the next suggestion sees the number
 * that was just issued instead of offering it again.
 */
export async function refreshMemberIds() {
  if (!usingApi) return localExistingMemberIds();
  const ids = await apiExistingMemberIds();
  idsCache = ids;
  return ids;
}

/* ==========================================================================
   Public export
   ========================================================================== */

export function getOrganization() {
  return orgCache;
}

export const listMembers = usingApi ? apiListMembers : localListMembers;
export const getMember = usingApi ? apiGetMember : localGetMember;
export const getMemberByRowId = usingApi ? apiGetMemberByRowId : localGetMemberByRowId;
export const createMember = usingApi ? apiCreateMember : localCreateMember;
export const updateMember = usingApi ? apiUpdateMember : localUpdateMember;
export const deleteMember = usingApi ? apiDeleteMember : localDeleteMember;
export const saveOrganization = usingApi ? apiSaveOrganization : localSaveOrganization;
export const getPublicMember = usingApi ? apiGetPublicMember : localGetMember;

/** Clear the caches back to whatever localStorage holds (development helper). */
export function resetOrganization() {
  orgCache = localResetOrganization();
  return orgCache;
}

/*
 * Renew and revoke are expressed as an update of status/validity, so they are
 * built on whichever updateMember is live rather than duplicated per backend.
 * Renewing a revoked ID must not silently reinstate it - that rule belongs to
 * the organisation, not the storage layer, so it is applied here.
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
  try {
    const found = await getMember(memberId);
    return !found || found.id === exceptRowId;
  } catch {
    // On error, allow the attempt through rather than blocking a legitimate
    // number - the unique constraint is the real authority and will reject it.
    return true;
  }
}

/** Wipe the local demo data. Meaningless when a real backend is live. */
export function resetDemoData() {
  return localResetDemoData();
}
