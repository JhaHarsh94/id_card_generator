import { STATUS, statusShortLabel } from '../utils/status';
import './StatusBadge.css';

/**
 * Status badge. Colour and wording are driven by the shared status module so a
 * badge can never disagree with the verification page.
 */
export default function StatusBadge({ status, size = 'md', showDot = true }) {
  const key = STATUS[status?.toUpperCase?.()] ?? status;
  const cls = key === STATUS.ACTIVE ? 'active'
    : key === STATUS.EXPIRED ? 'expired'
      : 'revoked';

  return (
    <span className={`badge badge-${cls} badge-${size}`}>
      {showDot ? <span className="badge-dot" aria-hidden="true" /> : null}
      {statusShortLabel(key)}
    </span>
  );
}