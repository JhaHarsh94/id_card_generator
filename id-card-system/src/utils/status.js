/**
 * Status derivation - SINGLE SOURCE OF TRUTH.
 *
 * Priority is REVOKED > EXPIRED > ACTIVE. A revoked ID stays revoked forever
 * regardless of dates; an expired one is decided purely by comparing today's
 * date against `valid_until`.
 *
 * This module is deliberately free of React and of any storage concerns so the
 * dashboard, the members table, the card and the public verification page all
 * derive status through exactly the same code path.
 */

import { daysBetween, today, toYMD } from './date';

export const STATUS = {
  ACTIVE: 'active',
  EXPIRED: 'expired',
  REVOKED: 'revoked',
};

export const STATUS_OPTIONS = [
  { value: STATUS.ACTIVE, label: 'Active' },
  { value: STATUS.EXPIRED, label: 'Expired' },
  { value: STATUS.REVOKED, label: 'Revoked' },
];

/**
 * Resolve the effective status of a member record.
 *
 * @param {{ status?: string, validUntil?: string }} member
 * @param {{ y:number, m:number, d:number }} [now]  injectable for testing
 * @returns {'active'|'expired'|'revoked'}
 */
export function deriveStatus(member, now = today()) {
  const stored = String(member?.status ?? '').toLowerCase();

  // Revocation is an explicit, irreversible administrative decision.
  if (stored === STATUS.REVOKED) return STATUS.REVOKED;

  const until = toYMD(member?.validUntil);
  if (!until) return STATUS.EXPIRED; // no expiry on record = not verifiable

  // Inclusive: valid through the stated day. daysBetween returns 0 on the
  // expiry date itself, so the card is still good on its final day.
  const remaining = daysBetween(now, until);
  if (remaining === null) return STATUS.EXPIRED;

  return remaining < 0 ? STATUS.EXPIRED : STATUS.ACTIVE;
}

/** Human label for a status value. */
export function statusLabel(status) {
  switch (status) {
    case STATUS.ACTIVE: return 'Valid ID';
    case STATUS.EXPIRED: return 'Expired';
    case STATUS.REVOKED: return 'Revoked';
    default: return 'Unknown';
  }
}

/** Short label used in tables and sidebar counts. */
export function statusShortLabel(status) {
  switch (status) {
    case STATUS.ACTIVE: return 'Active';
    case STATUS.EXPIRED: return 'Expired';
    case STATUS.REVOKED: return 'Revoked';
    default: return 'Unknown';
  }
}

/**
 * Counts by derived status.
 * @param {Array} members
 * @returns {{ total:number, active:number, expired:number, revoked:number }}
 */
export function summarise(members, now = today()) {
  const out = { total: 0, active: 0, expired: 0, revoked: 0 };
  for (const member of members ?? []) {
    out.total += 1;
    out[deriveStatus(member, now)] += 1;
  }
  return out;
}