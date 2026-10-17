/**
 * StatusDonut
 * ---------------------------------------------------------------------------
 * Shares of a whole as a ring, with the total in the middle.
 *
 * Built from four SVG circles rather than a charting library: the whole point
 * is to show three proportions that never change shape, and a dependency would
 * add more kilobytes than the chart has geometry.
 *
 * How the ring is drawn: every segment is a circle with the same radius, given
 * a `stroke-dasharray` of "segmentLength gapRest" and a `stroke-dashoffset`
 * that rotates it to where the previous segments ended. Offsets are negative
 * because SVG dash offsets run backwards around the path.
 *
 * `segments` = [{ key, label, value, color }]. Zero-value segments are skipped
 * so their stroke cannot paint a hairline at the 12 o'clock start.
 */
export default function StatusDonut({
  segments,
  total,
  size = 168,
  thickness = 20,
  centerLabel = 'Total',
}) {
  const stroke = thickness;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const safeTotal = total > 0 ? total : 1;

  let consumed = 0;
  const arcs = segments
    .filter((s) => s.value > 0)
    .map((s) => {
      const length = (s.value / safeTotal) * circumference;
      const arc = {
        ...s,
        dash: `${length} ${circumference - length}`,
        offset: -consumed,
      };
      consumed += length;
      return arc;
    });

  return (
    <div className="donut">
      <svg
        className="donut__svg"
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        role="img"
        aria-label={segments.map((s) => `${s.label}: ${s.value}`).join(', ')}
      >
        {/* Track, so an all-zero register still reads as a ring rather than a hole. */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--ink-100)"
          strokeWidth={stroke}
        />
        <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
          {arcs.map((a) => (
            <circle
              key={a.key}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke={a.color}
              strokeWidth={stroke}
              strokeDasharray={a.dash}
              strokeDashoffset={a.offset}
              strokeLinecap="butt"
            />
          ))}
        </g>
        <text
          className="donut__value"
          x="50%"
          y="47%"
          textAnchor="middle"
          dominantBaseline="middle"
        >
          {total}
        </text>
        <text
          className="donut__label"
          x="50%"
          y="62%"
          textAnchor="middle"
          dominantBaseline="middle"
        >
          {centerLabel}
        </text>
      </svg>

      <ul className="donut__legend">
        {segments.map((s) => (
          <li key={s.key} className="donut__legend-item">
            <span className="donut__swatch" style={{ background: s.color }} />
            <span className="donut__legend-label">{s.label}</span>
            <span className="donut__legend-value">{s.value}</span>
            <span className="donut__legend-pct">
              {total > 0 ? `${Math.round((s.value / total) * 100)}%` : '0%'}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
