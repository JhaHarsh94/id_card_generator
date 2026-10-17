/**
 * Row <-> app-object mapping for the API.
 *
 * The database uses snake_case and the UI uses camelCase. Keeping the
 * translation in one place means a column rename touches this file only, not
 * every page.
 */

/** Map a `members` row to the shape every page already expects. */
export function toMember(row) {
  if (!row) return null;
  return {
    id: row.id,
    memberId: row.member_id,
    fullName: row.full_name,
    designation: row.designation,
    state: row.state,
    district: row.district ?? '',
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
 * The columns a client may write.
 *
 * Everything else - the uuid, created_at, updated_at, created_by - is server
 * owned. Filtering here rather than trusting a column list in the request body
 * is what stops a caller from back-dating a record or stamping it as created by
 * somebody else.
 */
export const WRITABLE_COLUMNS = {
  memberId: 'member_id',
  fullName: 'full_name',
  designation: 'designation',
  state: 'state',
  district: 'district',
  photoUrl: 'photo_url',
  validFrom: 'valid_from',
  validUntil: 'valid_until',
  status: 'status',
  revocationReason: 'revocation_reason',
};

/** Largest photo we will store: a processed card photo at webp quality. */
export const MAX_PHOTO_BYTES = 1_500_000;

/**
 * Build a column map from a client payload, dropping anything not writable.
 * Returns { values, problems } so the caller can reject with a useful message
 * instead of letting Postgres throw "column does not exist".
 */
export function pickWritable(payload) {
  const values = {};
  const problems = [];

  for (const [key, column] of Object.entries(WRITABLE_COLUMNS)) {
    if (payload[key] === undefined) continue;
    values[column] = payload[key];
  }

  if (values.photo_url && typeof values.photo_url === 'string'
      && values.photo_url.length > MAX_PHOTO_BYTES) {
    problems.push('The photo is too large. Please use a smaller image.');
  }

  if (values.status && !['active', 'expired', 'revoked'].includes(values.status)) {
    delete values.status;
  }

  // Dates must arrive as YYYY-MM-DD; a Date object or a timestamp is rejected
  // by Postgres for a `date` column.
  for (const col of ['valid_from', 'valid_until']) {
    if (values[col] instanceof Date) {
      values[col] = values[col].toISOString().slice(0, 10);
    } else if (values[col] && typeof values[col] === 'string') {
      values[col] = values[col].slice(0, 10);
    } else if (values[col] === '' || values[col] === null) {
      values[col] = null;
    }
  }

  return { values, problems };
}

/**
 * The status a verifier sees: revocation wins, otherwise the calendar decides.
 * Mirrors the frontend's `deriveStatus` so the card, the admin list and the
 * public QR page can never disagree.
 */
export function effectiveStatus(row) {
  if (row.status === 'revoked') return 'revoked';
  if (!row.valid_until) return row.status === 'expired' ? 'expired' : 'active';
  const today = new Date().toISOString().slice(0, 10);
  if (String(row.valid_until) < today) return 'expired';
  return 'active';
}
