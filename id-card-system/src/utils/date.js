/**
 * Date helpers.
 *
 * The whole system stores validity as a plain calendar DATE (no time, no
 * timezone). Using JS `Date` objects for that is a well-known source of
 * off-by-one-day bugs, so these helpers do all arithmetic in UTC on
 * year/month/day components and format explicitly as DD/MM/YYYY.
 *
 * The reference card displays "Valid up to: 08/08/2027" - i.e. DD/MM/YYYY.
 */

const MONTHS_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

/** Pad to two digits. */
const pad = (n) => String(n).padStart(2, '0');

/**
 * Coerce assorted inputs into a { y, m, d } plain object.
 * Accepts:
 *   - a { y, m, d } plain object (as returned by addMonths / today)
 *   - a Date
 *   - an ISO string  'YYYY-MM-DD'
 *   - a display string 'DD/MM/YYYY'
 *   - a compact date  'YYYYMMDD'
 * Returns null when nothing sensible can be read.
 */
export function toYMD(value) {
  if (!value) return null;
  const checked = (y, m, d) => {
    const parts = { y: Number(y), m: Number(m), d: Number(d) };
    return isValidYMD(parts) ? parts : null;
  };

  // Already decomposed - common when addMonths() is composed into a format call.
  if (typeof value === 'object' && !(value instanceof Date)) {
    const { y, m, d } = value;
    return checked(y, m, d);
  }

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return {
      y: value.getUTCFullYear(),
      m: value.getUTCMonth() + 1,
      d: value.getUTCDate(),
    };
  }

  const raw = String(value).trim();
  if (!raw) return null;

  let m;
  if ((m = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?=$|T\d{2}:\d{2})/))) {
    return checked(m[1], m[2], m[3]);
  }
  if ((m = raw.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/))) {
    return checked(m[3], m[2], m[1]);
  }
  if ((m = raw.match(/^(\d{4})(\d{2})(\d{2})$/))) {
    return checked(m[1], m[2], m[3]);
  }
  return null;
}

/** Build a UTC Date at midnight, safe for day arithmetic. */
export function fromYMD({ y, m, d }) {
  const date = new Date(0);
  date.setUTCFullYear(y, m - 1, d);
  date.setUTCHours(0, 0, 0, 0);
  return date;
}

/** True when the parts form a real calendar date (rejects 31/02). */
export function isValidYMD(value) {
  if (!value || typeof value !== 'object') return false;
  const { y, m, d } = value;
  if (![y, m, d].every(Number.isInteger) || y < 1 || y > 9999) return false;
  if (m < 1 || m > 12 || d < 1 || d > 31) return false;
  const dt = fromYMD({ y, m, d });
  return (
    dt.getUTCFullYear() === y &&
    dt.getUTCMonth() === m - 1 &&
    dt.getUTCDate() === d
  );
}

/** Canonical storage format: 'YYYY-MM-DD'. Also the <input type="date"> format. */
export function toISODate(value) {
  const p = toYMD(value);
  if (!p) return '';
  return `${p.y}-${pad(p.m)}-${pad(p.d)}`;
}

/** Display format used on the card and in tables: 'DD/MM/YYYY'. */
export function formatDate(value) {
  const p = toYMD(value);
  if (!p) return '';
  return `${pad(p.d)}/${pad(p.m)}/${p.y}`;
}

/** '08 Aug 2027' */
export function formatDateLong(value) {
  const p = toYMD(value);
  if (!p) return '';
  return `${pad(p.d)} ${MONTHS_SHORT[p.m - 1]} ${p.y}`;
}

/** Organisation calendar date, consistent on phones, desktops and the server. */
export function today(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(now);
  const pick = (type) => Number(parts.find((part) => part.type === type)?.value);
  return { y: pick('year'), m: pick('month'), d: pick('day') };
}

/**
 * Add whole months, clamping the day to the end of the target month.
 * Adding a year to 31 Aug gives 31 Aug the following year; 31 Aug + 6 months
 * gives 28/29 Feb rather than rolling into March.
 */
export function addMonths(value, months) {
  const p = toYMD(value);
  if (!p || !Number.isInteger(months)) return null;

  const totalMonths = (p.y * 12 + (p.m - 1)) + months;
  const y = Math.floor(totalMonths / 12);
  const m = ((totalMonths % 12) + 12) % 12 + 1;

  const daysInTarget = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const d = Math.min(p.d, daysInTarget);

  return { y, m, d };
}

/** Whole days from a to b (b - a). Negative when b is in the past. */
export function daysBetween(a, b) {
  const pa = toYMD(a);
  const pb = toYMD(b);
  if (!pa || !pb) return null;
  return Math.round(
    (fromYMD(pb).getTime() - fromYMD(pa).getTime()) / 86_400_000,
  );
}

/** Human-friendly "expires in 3 months" / "expired 2 months ago". */
export function describeValidity(validUntil) {
  const delta = daysBetween(today(), validUntil);
  if (delta === null) return '';
  if (delta === 0) return 'Expires today';
  if (delta < 0) {
    const n = Math.abs(delta);
    const label = n < 31 ? `${n} day${n === 1 ? '' : 's'} ago` : null;
    if (label) return `Expired ${label}`;
    const months = Math.round(n / 30.44);
    return `Expired ${months} month${months === 1 ? '' : 's'} ago`;
  }
  if (delta < 31) return `Expires in ${delta} day${delta === 1 ? '' : 's'}`;
  const months = Math.round(delta / 30.44);
  return `Expires in ${months} month${months === 1 ? '' : 's'}`;
}
