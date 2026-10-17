import { ChevronLeft, ChevronRight } from 'lucide-react';

/**
 * Pagination
 * ---------------------------------------------------------------------------
 * Page controls for a long table.
 *
 * The members table used to render every row it had. That is fine at a dozen
 * members and unusable at a few thousand: the browser lays out and paints
 * thousands of rows, each with a photo, and the page becomes sluggish long
 * before it becomes wrong. Paging also gives the operator a stable sense of
 * "where am I" that an endless list does not.
 *
 * The page window is a fixed-width run around the current page rather than the
 * full page list, so the control never wraps on a phone no matter how many
 * pages a large register produces.
 */
export default function Pagination({
  page,
  pageCount,
  pageSize,
  total,
  onPage,
  onPageSize,
  pageSizes = [10, 25, 50, 100],
}) {
  if (total === 0) return null;

  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  // Always show first and last; show a run of up to 5 around the current page.
  const windowed = new Set([1, pageCount]);
  for (let p = page - 2; p <= page + 2; p += 1) {
    if (p >= 1 && p <= pageCount) windowed.add(p);
  }
  const pages = [...windowed].sort((a, b) => a - b);

  return (
    <div className="pager">
      <p className="pager__summary">
        <strong>{from}</strong>–<strong>{to}</strong> of <strong>{total}</strong>
      </p>

      <div className="pager__controls">
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={() => onPage(page - 1)}
          disabled={page <= 1}
          aria-label="Previous page"
        >
          <ChevronLeft size={15} />
        </button>

        {pages.map((p, i) => {
          const gap = i > 0 && p - pages[i - 1] > 1;
          return (
            <span className="pager__slot" key={p}>
              {gap ? <span className="pager__gap" aria-hidden="true">…</span> : null}
              <button
                type="button"
                className={`pager__page ${p === page ? 'is-current' : ''}`}
                onClick={() => onPage(p)}
                aria-current={p === page ? 'page' : undefined}
              >
                {p}
              </button>
            </span>
          );
        })}

        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={() => onPage(page + 1)}
          disabled={page >= pageCount}
          aria-label="Next page"
        >
          <ChevronRight size={15} />
        </button>
      </div>

      <label className="pager__size">
        <span>Rows</span>
        <select
          className="select select-sm"
          value={pageSize}
          onChange={(e) => onPageSize(Number(e.target.value))}
          aria-label="Rows per page"
        >
          {pageSizes.map((n) => (
            <option key={n} value={n}>{n}</option>
          ))}
        </select>
      </label>
    </div>
  );
}
