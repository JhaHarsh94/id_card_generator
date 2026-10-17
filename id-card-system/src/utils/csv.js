/**
 * CSV export helpers.
 *
 * Two things make this worth writing out rather than joining strings:
 *
 * 1. Every field is quoted and internal quotes are doubled, per RFC 4180. A
 *    member's name or address containing a comma or a quote would otherwise
 *    shift every following column one to the left in the opened file.
 *
 * 2. A UTF-8 BOM is written at the front. Excel on Windows does NOT assume
 *    UTF-8 when opening a .csv - without the BOM it decodes the file as the
 *    system ANSI codepage and every Devanagari name comes out as mojibake.
 *    The BOM is invisible in the sheet; its absence is not.
 */

/** RFC 4180 field quoting. */
function escapeField(value) {
  if (value === null || value === undefined) return '';
  const text = String(value);
  // Always quote: dates and IDs that look numeric stay text this way, so a
  // leading zero in an ID such as 0095030 is not silently dropped by Excel.
  return `"${text.replace(/"/g, '""')}"`;
}

/**
 * Build a CSV document.
 *
 * @param {Array<object>} rows
 * @param {Array<{key: string, label: string, value?: (row) => unknown}>} columns
 * @param {{bom?: boolean}} [options]
 */
export function toCsv(rows, columns, { bom = true } = {}) {
  const header = columns.map((c) => escapeField(c.label)).join(',');
  const body = rows.map((row) => columns
    .map((c) => escapeField(c.value ? c.value(row) : row[c.key]))
    .join(','));
  // CRLF is what RFC 4180 specifies and what Excel expects.
  return `${bom ? '\uFEFF' : ''}${[header, ...body].join('\r\n')}\r\n`;
}

/** Trigger a browser download of a CSV string. */
export function downloadCsv(filename, csv) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Revoking immediately can cancel the download in some browsers; one frame
  // is enough for the click to have been handled.
  requestAnimationFrame(() => URL.revokeObjectURL(url));
}

/**
 * Filename-safe stamp, e.g. 2026-10-16.
 * Used so consecutive exports do not overwrite each other.
 */
export function stamp(date = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
