/**
 * TrendBars
 * ---------------------------------------------------------------------------
 * A month-by-month column chart, built from divs.
 *
 * Columns rather than a line: the data is a count per discrete month, not a
 * continuous quantity, and a line implies readings between months that do not
 * exist.
 *
 * Height is a percentage of the tallest column, so the chart is resolution- and
 * container-independent. A bar with a non-zero value is never allowed to round
 * down to 0%, otherwise "1 member in June" would render as no member in June -
 * the chart would be quietly lying. It gets a 2% floor instead.
 *
 * `data` = [{ label, value }]
 */
export default function TrendBars({
  data,
  color = 'var(--brand-blue)',
  height = 190,
  emptyLabel = 'Nothing recorded yet',
}) {
  if (!data.length) {
    return <p className="trend__empty">{emptyLabel}</p>;
  }

  const peak = Math.max(...data.map((d) => d.value), 1);
  const totalInWindow = data.reduce((sum, d) => sum + d.value, 0);

  return (
    <figure className="trend">
      <div className="trend__plot" style={{ height }}>
        {data.map((d) => {
          const pct = d.value === 0 ? 0 : Math.max(2, (d.value / peak) * 100);
          return (
            <div className="trend__col" key={d.label}>
              <span className="trend__value" aria-hidden="true">
                {d.value || ''}
              </span>
              <div className="trend__track">
                <div
                  className="trend__bar"
                  style={{ height: `${pct}%`, background: color }}
                  title={`${d.label}: ${d.value}`}
                />
              </div>
              <span className="trend__label">{d.label}</span>
            </div>
          );
        })}
      </div>
      <figcaption className="trend__caption">
        {totalInWindow} card{totalInWindow === 1 ? '' : 's'} issued in this period
      </figcaption>
    </figure>
  );
}
