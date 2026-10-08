import { forwardRef, useMemo } from 'react';
import { COLORS } from '../../config/cardDesign';
import { formatDate } from '../../utils/date';
import { buildVerifyUrl } from '../../utils/verification';
import { useQrDataUrl } from '../../hooks/useQrDataUrl';
import '../../styles/id-card.css';

/**
 * IDCardTemplate
 * ---------------------------------------------------------------------------
 * The locked organisation member ID card.
 *
 * Not a designer: every fixed element sits at its measured position. The only
 * inputs are the member's own data and the organisation's saved settings.
 * The ref is forwarded so the card can be handed to html-to-image for export.
 */

/**
 * Step the font down for long values rather than letting them overflow into
 * the photo. Thresholds are tuned against the 856 x 540 canvas.
 */
function fit(text, md, sm) {
  const n = String(text ?? '').trim().length;
  if (sm && n > 34) return sm;
  if (md && n > 22) return md;
  return '';
}

function IDCardTemplate(
  { organization, member, verifyUrl = null, className = '', showDemoFlag = true },
  ref,
) {
  const org = organization ?? {};
  const m = member ?? {};

  const {
    name = '',
    designation = '',
    state = '',
    validUntil = '',
    memberId = '',
    photoUrl = null,
  } = m;

  // QR encodes ONLY the absolute public verification URL — no member or admin
  // data. It must be absolute or a phone camera cannot resolve it.
  const qrTarget = verifyUrl
    ?? (org.qrEnabled !== false && memberId ? buildVerifyUrl(memberId) : null);
  const { url: qrDataUrl } = useQrDataUrl(qrTarget, { size: 512 });
  const showQr = Boolean(org.qrEnabled !== false && qrDataUrl);

  const styleVars = useMemo(
    () => ({
      '--c-blue': COLORS.blue,
      '--c-blue-dark': COLORS.blueDark,
      '--c-red': COLORS.red,
      '--c-red-dark': COLORS.redDark,
      '--c-gold': COLORS.gold,
      '--c-white': COLORS.white,
    }),
    [],
  );

  return (
    <div ref={ref} className={`idcard ${className}`} style={styleVars}>
      {showDemoFlag && org.isDemo ? (
        <span className="idcard__demo-flag">Demo data</span>
      ) : null}

      {/* ================= HEADER (fixed) ================= */}
      <header className="idcard__header">
        <div className="idcard__header-bg idcard__diagonal" />

        <div className="idcard__header-text">
          <div className={`idcard__org-name ${fit(org.name, 'size-md', 'size-sm')}`}>
            {org.name ?? ''}
            {org.registrationMark ? <sup>{org.registrationMark}</sup> : null}
          </div>
          {org.nameHi ? <div className="idcard__org-name-hi">{org.nameHi}</div> : null}
        </div>

        {/* Certification badge - omitted entirely when the organisation has none */}
        {org.isoText ? (
          <div className="idcard__iso">
            <span className="idcard__iso-text">{org.isoText}</span>
          </div>
        ) : null}
      </header>

      {/* ================= SUB-HEADER (fixed) ================= */}
      <div className="idcard__subheader">
        <div className="idcard__subheader-text">{org.registrationText ?? ''}</div>
      </div>

      {/* ================= BODY ================= */}
      <div className="idcard__body">
        {/* organisation logo - fixed slot */}
        <div className="idcard__logo">
          <span className="idcard__logo-frame" aria-hidden="true" />
          {org.logoUrl ? <img src={org.logoUrl} alt="" /> : null}
        </div>

        {/* member identity - dynamic */}
        <div className="idcard__identity">
          <div className={`idcard__name ${fit(name, 'size-md', 'size-sm')}`}>
            {name || '—'}
          </div>

          {designation ? (
            <div className={`idcard__designation ${fit(designation, 'size-md', 'size-sm')}`}>
              {designation}
            </div>
          ) : null}

          {state ? (
            <div className={`idcard__state ${fit(state, 'size-md', 'size-sm')}`}>
              {state}
            </div>
          ) : null}

          <div className="idcard__validity">
            Valid up to:&nbsp;<em>{formatDate(validUntil) || '—'}</em>
          </div>

          {org.scopeText ? <div className="idcard__scope">{org.scopeText}</div> : null}
        </div>

        {/* member ID number - dynamic, fixed position */}
        <div className="idcard__idno">ID No.{memberId || '—'}</div>

        {/* member photo - dynamic, never stretched */}
        <div className="idcard__photo">
          {photoUrl ? (
            <img src={photoUrl} alt="" crossOrigin="anonymous" />
          ) : (
            <div className="idcard__photo-empty" aria-hidden="true">
              <svg width="46" height="46" viewBox="0 0 24 24" fill="none"
                   stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
                <path d="M20 21a8 8 0 0 0-16 0" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            </div>
          )}
        </div>

        {/* QR code - dynamic content, fixed position */}
        {showQr ? (
          <>
            <div className="idcard__qr">
              <img src={qrDataUrl} alt="" />
            </div>
            <div className="idcard__qr-label">Scan to verify</div>
          </>
        ) : null}

        {/* authority seal - fixed slot, overlaps the photo */}
        <div className="idcard__seal">
          {org.sealUrl ? (
            <img src={org.sealUrl} alt="" />
          ) : (
            <span className="idcard__seal-fallback">
              {org.signatoryDesignation ?? 'Authorised Signatory'}
            </span>
          )}
        </div>

        {/* signatory - fixed identity, fixed position */}
        <div className="idcard__signatory">
          <div className="idcard__signatory-name">{org.signatoryName ?? ''}</div>
          <div className="idcard__signatory-role">{org.signatoryDesignation ?? ''}</div>
        </div>
      </div>

      {/* ================= SUPPORT / OBJECTIVE BAND (fixed) ================= */}
      <div className="idcard__support">
        <div className={`idcard__support-text ${fit(org.supportText, 'size-md', 'size-sm')}`}>
          {org.supportText ?? ''}
        </div>
      </div>

      {/* ================= FOOTER (fixed) ================= */}
      <footer className="idcard__footer">
        <div className="idcard__footer-bg idcard__diagonal" />
        <div className="idcard__footer-text">{org.footerText ?? ''}</div>
      </footer>
    </div>
  );
}

export default forwardRef(IDCardTemplate);