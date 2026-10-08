/**
 * ID number generation.
 *
 * The reference card shows "ID No.0095030" - a zero-padded numeric ID with no
 * prefix. Generation is deliberately simple and predictable because
 * administrators read these numbers out over the phone.
 */

/** Zero-pad a numeric part: 95030 with padding 7 -> "0095030". */
export function padNumber(value, padding = 7) {
  return String(value).padStart(padding, '0');
}

/**
 * Build a full ID number from the organisation's numbering config.
 * @param {{idPrefix?: string, idStart?: number, idPadding?: number}} config
 * @param {number} sequence  zero-based offset from idStart
 */
export function formatMemberId(config, sequence = 0) {
  const prefix = config.idPrefix ?? '';
  const padding = config.idPadding ?? 7;
  const start = config.idStart ?? 1;
  return `${prefix}${padNumber(start + sequence, padding)}`;
}

/**
 * Suggest the next free ID.
 *
 * `existing` should be the list of member IDs already in use. We take the
 * highest numeric value rather than the highest count, so deleting a member in
 * the middle never causes a collision with a later number.
 *
 * @returns {string} a candidate ID the admin can still override by hand
 */
export function suggestNextId(config, existing = []) {
  const prefix = config.idPrefix ?? '';

  const numbers = existing
    .map((id) => String(id ?? '').trim())
    .filter((id) => id.startsWith(prefix) || prefix === '')
    .map((id) => Number(id.slice(prefix.length)))
    .filter((n) => Number.isInteger(n) && n >= 0);

  const highest = numbers.length ? Math.max(...numbers) : (config.idStart ?? 1) - 1;
  return formatMemberId(config, Math.max(0, highest + 1 - (config.idStart ?? 1)));
}

/**
 * Validate an ID the admin typed by hand.
 * @returns {{ok: true} | {ok: false, reason: string}}
 */
export function validateMemberId(value, { existing = [], currentId = null } = {}) {
  const id = String(value ?? '').trim();

  if (!id) return { ok: false, reason: 'ID number is required.' };
  if (id.length < 3) return { ok: false, reason: 'ID number is too short.' };
  if (id.length > 24) return { ok: false, reason: 'ID number is too long.' };
  if (!/^[A-Za-z0-9-]+$/.test(id)) {
    return { ok: false, reason: 'Use letters, numbers and hyphens only.' };
  }
  if (existing.some((e) => e === id && e !== currentId)) {
    return { ok: false, reason: `ID number ${id} is already assigned.` };
  }
  return { ok: true };
}

/**
 * Bulk-generate a contiguous run of IDs, skipping any that already exist.
 * @returns {{ ids: string[], skipped: string[] }}
 */
export function generateIdRun(config, count, existing = []) {
  const taken = new Set(existing.map((id) => String(id).trim()));
  const ids = [];
  const skipped = [];

  let cursor = suggestNextId(config, existing);
  let guard = 0;
  const maxTries = count * 50 + 1000;

  while (ids.length < count && guard < maxTries) {
    guard += 1;
    if (taken.has(cursor)) {
      skipped.push(cursor);
    } else {
      ids.push(cursor);
    }
    const next = Number(cursor.slice((config.idPrefix ?? '').length)) + 1;
    cursor = formatMemberId(config, next - (config.idStart ?? 1));
  }
  return { ids, skipped };
}