/**
 * Public verification URL builder.
 *
 * The QR code MUST contain an absolute URL. A relative path such as
 * "/verify/0095030" is meaningless to a phone camera - there is no origin to
 * resolve it against, so scanning would produce nothing.
 *
 * Resolution order:
 *   1. organisation.verifyBaseUrl  - set for a real deployment, e.g.
 *      "https://idcards.example.org". Use this when the admin UI and the public
 *      verification page are served from different domains.
 *   2. window.location.origin      - correct whenever the app is served from
 *      the same host that will be printed on the cards, which is the normal
 *      single-domain deployment.
 */

const BASE_KEY = 'idcms.verifyBaseUrl';

/** Persisted override, set from Settings. */
export function getVerifyBaseUrl() {
  try {
    return localStorage.getItem(BASE_KEY) || '';
  } catch {
    return '';
  }
}

export function setVerifyBaseUrl(value) {
  try {
    const url = String(value ?? '').trim();
    if (url) localStorage.setItem(BASE_KEY, url.replace(/\/+$/, ''));
    else localStorage.removeItem(BASE_KEY);
  } catch {
    /* storage unavailable - fall back to the current origin */
  }
}

/**
 * Build the scannable verification URL for a member ID.
 * @param {string} memberId
 * @returns {string} absolute URL
 */
export function buildVerifyUrl(memberId) {
  const id = encodeURIComponent(String(memberId ?? '').trim());
  const path = `/verify/${id}`;

  const configured = getVerifyBaseUrl();
  if (configured) return `${configured}${path}`;

  if (typeof window === 'undefined' || !window.location?.origin) return path;
  return `${window.location.origin}${path}`;
}