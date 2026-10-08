/**
 * Local data store (development / pre-Supabase)
 * ---------------------------------------------------------------------------
 * Phase 5 replaces this with Supabase. Until then the app needs somewhere real
 * to read and write so the forms, the members table, exports and the public
 * verification page can all be exercised end to end.
 *
 * Backed by localStorage, so data survives a page reload. Every record carries
 * `id`, `createdAt` and `updatedAt`.
 *
 * Swap this module for services/members.js when Supabase is connected - the
 * exported function signatures are deliberately identical.
 */

import { addMonths, toISODate, today } from '../utils/date';
import { organizationDefaults } from '../config/organization.default';

/**
 * v4: the photo seal was replaced with the organisation's rubber stamp, and
 * cached v3 organisation settings would still point at the old portrait.
 */
const MEMBERS_KEY = 'idcms.members.v4';
const ORG_KEY = 'idcms.organization.v4';

/* ==========================================================================
   Demo seed - clearly marked placeholder data
   ========================================================================== */

function seedMembers() {
  const base = today();
  const now = new Date().toISOString();

  const mk = (n, data) => ({
    id: `seed-${n}`,
    memberId: data.memberId,
    fullName: data.fullName,
    designation: data.designation,
    state: data.state,
    district: data.district ?? '',
    photoUrl: null,
    validFrom: toISODate(base),
    validUntil: toISODate(addMonths(base, data.months)),
    status: data.status ?? 'active',
    revocationReason: data.revocationReason ?? null,
    isDemo: true,
    createdAt: data.createdAt ?? now,
    updatedAt: data.createdAt ?? now,
  });

  return [
    mk(1, {
      memberId: '0095030',
      fullName: 'सुनीता देवी',
      designation: 'प्रधान जिला अध्यक्ष',
      state: 'उत्तर प्रदेश',
      district: 'बागपत',
      months: 11,
    }),
    mk(2, {
      memberId: '0095031',
      fullName: 'मनोज कुमार',
      designation: 'संस्थापक सत्यापक',
      state: 'उत्तर प्रदेश',
      district: 'बागपत',
      months: 22,
    }),
    mk(3, {
      memberId: '0095032',
      fullName: 'रेखा यादव',
      designation: 'प्रखण्ड अध्यक्ष',
      state: 'उत्तर प्रदेश',
      district: 'मेरठ',
      months: 6,
    }),
    mk(4, {
      memberId: '0095033',
      fullName: 'सुनीता पाल',
      designation: 'महिला समिति अध्यक्ष',
      state: 'हरियाणा',
      district: 'पानीपत',
      months: -2, // already lapsed -> renders as Expired
    }),
    mk(5, {
      memberId: '0095034',
      fullName: 'कविता सिंह',
      designation: 'सदस्य',
      state: 'राजस्थान',
      district: 'जयपुर',
      months: 14,
      status: 'revoked',
      revocationReason: 'सदस्यता समाप्त',
    }),
  ];
}

/* ==========================================================================
   Storage plumbing
   ========================================================================== */

function safeParse(raw, fallback) {
  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(raw);
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

function readMembers() {
  const stored = safeParse(localStorage.getItem(MEMBERS_KEY), null);
  if (Array.isArray(stored) && stored.length) return stored;
  const seeded = seedMembers();
  localStorage.setItem(MEMBERS_KEY, JSON.stringify(seeded));
  return seeded;
}

function writeMembers(members) {
  localStorage.setItem(MEMBERS_KEY, JSON.stringify(members));
  return members;
}

/* ==========================================================================
   Organisation settings
   ========================================================================== */

export function getOrganization() {
  const stored = safeParse(localStorage.getItem(ORG_KEY), null);
  return { ...organizationDefaults, ...(stored ?? {}) };
}

export function saveOrganization(patch) {
  const next = { ...getOrganization(), ...patch, isDemo: false };
  localStorage.setItem(ORG_KEY, JSON.stringify(next));
  return next;
}

export function resetOrganization() {
  localStorage.removeItem(ORG_KEY);
  return organizationDefaults;
}

/* ==========================================================================
   Members
   ========================================================================== */

const delay = (ms = 120) => new Promise((r) => setTimeout(r, ms));

export async function listMembers() {
  await delay();
  return readMembers().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getMember(memberId) {
  await delay(60);
  return readMembers().find((m) => m.memberId === memberId) ?? null;
}

export async function getMemberByRowId(rowId) {
  await delay(60);
  return readMembers().find((m) => m.id === rowId) ?? null;
}

export async function createMember(data) {
  await delay(200);
  const members = readMembers();

  if (members.some((m) => m.memberId === data.memberId)) {
    const err = new Error('duplicate');
    err.code = 'DUPLICATE_ID';
    throw err;
  }

  const now = new Date().toISOString();
  const record = {
    id: `m-${Date.now().toString(36)}`,
    ...data,
    isDemo: false,
    createdAt: now,
    updatedAt: now,
  };
  delete record.photoFile;

  writeMembers([record, ...members]);
  return record;
}

export async function updateMember(rowId, patch) {
  await delay(200);
  const members = readMembers();

  if (
    patch.memberId
    && members.some((m) => m.memberId === patch.memberId && m.id !== rowId)
  ) {
    const err = new Error('duplicate');
    err.code = 'DUPLICATE_ID';
    throw err;
  }

  const next = members.map((m) =>
    m.id === rowId
      ? { ...m, ...patch, updatedAt: new Date().toISOString() }
      : m,
  );
  writeMembers(next);
  return next.find((m) => m.id === rowId) ?? null;
}

export async function deleteMember(rowId) {
  await delay(150);
  writeMembers(readMembers().filter((m) => m.id !== rowId));
}

export async function revokeMember(rowId, reason) {
  return updateMember(rowId, {
    status: 'revoked',
    revocationReason: reason ?? null,
  });
}

export async function renewMember(rowId, validUntil) {
  const members = readMembers();
  const current = members.find((m) => m.id === rowId);
  if (!current) return null;

  return updateMember(rowId, {
    validFrom: toISODate(today()),
    validUntil: toISODate(validUntil),
    // Renewing a revoked ID does not silently reinstate it.
    status: current.status === 'revoked' ? 'revoked' : 'active',
  });
}

export async function checkMemberIdAvailable(memberId, exceptRowId = null) {
  const members = readMembers();
  return !members.some((m) => m.memberId === memberId && m.id !== exceptRowId);
}

export function existingMemberIds() {
  return readMembers().map((m) => m.memberId);
}

/** Wipe all local data and reseed. Development convenience only. */
export function resetDemoData() {
  localStorage.removeItem(MEMBERS_KEY);
  return readMembers();
}