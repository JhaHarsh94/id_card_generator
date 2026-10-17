import { Link } from 'react-router-dom';

/**
 * BreakdownList
 * ---------------------------------------------------------------------------
 * A ranked count list - "how many members in each state", "how many in each
 * district". Each row is a label, a bar sized against the largest row, and the
 * count, which is the shape a register is actually read in.
 *
 * The bar is a proportion of the TOP row, not of the total: with one dominant
 * state every other bar would otherwise be an unreadable sliver, and the
 * question being asked of this list is "how do these compare to each other".
 *
 * `rows` = [{ label, value, to? }]. `to` makes a row a link into the filtered
 * member list, which is what turns a summary into something you can act on.
 */
export default function BreakdownList({
  rows,
  color = 'var(--brand-blue)',
  emptyLabel = 'No data',
  limit = 8,
  unit = 'member',
}) {
  if (!rows.length) return <p className="breakdown__empty">{emptyLabel}</p>;

  const shown = rows.slice(0, limit);
  const peak = Math.max(...shown.map((r) => r.value), 1);

  return (
    <ul className="breakdown">
      {shown.map((row) => {
        const content = (
          <>
            <span className="breakdown__label">{row.label}</span>
            <span className="breakdown__track">
              <span
                className="breakdown__fill"
                style={{ width: `${Math.max(3, (row.value / peak) * 100)}%`, background: color }}
              />
            </span>
            <span className="breakdown__value">{row.value}</span>
          </>
        );
        return (
          <li key={row.label} className="breakdown__row">
            {row.to
              ? <Link to={row.to} className="breakdown__link" title={`${row.value} ${unit}${row.value === 1 ? '' : 's'}`}>{content}</Link>
              : <span className="breakdown__link">{content}</span>}
          </li>
        );
      })}
      {rows.length > limit ? (
        <li className="breakdown__more">
          +{rows.length - limit} more
        </li>
      ) : null}
    </ul>
  );
}
