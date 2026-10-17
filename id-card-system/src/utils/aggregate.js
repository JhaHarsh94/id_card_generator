/**
 * Aggregation helpers for the dashboard and the reports page.
 *
 * Both screens summarise the same member list in slightly different ways, so
 * the counting lives here rather than being written twice and drifting.
 */

/** The last `count` months as { year, month, label }, oldest first. */
export function recentMonths(count, from = new Date()) {
  const out = [];
  for (let i = count - 1; i >= 0; i -= 1) {
    const d = new Date(from.getFullYear(), from.getMonth() - i, 1);
    out.push({
      year: d.getFullYear(),
      month: d.getMonth(),
      label: d.toLocaleString('en-IN', { month: 'short' }),
    });
  }
  return out;
}

/**
 * Count members by an arbitrary key, highest first.
 *
 * Blank and whitespace-only keys are skipped rather than collected into an
 * "" bucket - a row labelled with nothing is noise in a report.
 */
export function tally(members, pick) {
  const map = new Map();
  for (const member of members ?? []) {
    const key = String(pick(member) ?? '').trim();
    if (!key) continue;
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  return [...map.entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label));
}

/** Cards created per month across the given month window. */
export function monthlyIssuance(members, months) {
  return months.map(({ year, month, label }) => ({
    label,
    year,
    month,
    value: (members ?? []).filter((row) => {
      const d = new Date(row.createdAt);
      return !Number.isNaN(d.getTime())
        && d.getFullYear() === year
        && d.getMonth() === month;
    }).length,
  }));
}

/** Whole days from `from` (a date) until `iso` (YYYY-MM-DD). Negative = past. */
export function daysUntil(iso, from = new Date()) {
  const target = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(target.getTime())) return null;
  const start = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  return Math.round((target - start) / 86400000);
}
