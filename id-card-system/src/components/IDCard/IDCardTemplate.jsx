import { forwardRef, useLayoutEffect, useRef } from 'react';
import { CARD, COLORS } from '../../config/cardDesign';
import { formatDate } from '../../utils/date';
import { buildVerifyUrl } from '../../utils/verification';
import { useQrDataUrl } from '../../hooks/useQrDataUrl';
import '../../styles/id-card.css';

/** Fit changing text inside its fixed slot after the self-hosted fonts load. */
function useFittedText(ref, content) {
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return undefined;
    let cancelled = false;
    const fit = () => {
      if (cancelled) return;
      element.style.removeProperty('font-size');
      let size = parseFloat(getComputedStyle(element).fontSize);
      while ((element.scrollWidth > element.clientWidth + 1
        || element.scrollHeight > element.clientHeight + 1) && size > 4) {
        size -= 0.5;
        element.style.fontSize = `${size}px`;
      }
    };
    fit();
    Promise.all([
      document.fonts?.load('800 56px "Noto Sans Devanagari"'),
      document.fonts?.load('400 28px "Noto Sans Devanagari"'),
    ]).then(fit).catch(fit);
    return () => { cancelled = true; };
  }, [ref, content]);
}

function FittedText({ as: Tag = 'div', className, children }) {
  const ref = useRef(null);
  useFittedText(ref, children);
  return <Tag ref={ref} className={className}>{children}</Tag>;
}

/** One fixed canvas shared by preview, PNG, PDF and print. */
const IDCardTemplate = forwardRef(function IDCardTemplate(
  { organization = {}, member = {}, verifyUrl = null, className = '', showDemoFlag = true }, ref,
) {
  const org = organization;
  const name = member.name || member.fullName || 'सदस्य का नाम';
  const qrTarget = org.qrEnabled === true && member.memberId
    ? verifyUrl || buildVerifyUrl(member.memberId, org.verifyBaseUrl)
    : null;
  const { url: qrDataUrl, error: qrError } = useQrDataUrl(qrTarget, { size: 256 });

  return (
    <article
      ref={ref}
      className={`idcard ${className}`}
      aria-label={`Membership card — ${name}`}
      data-qr-pending={Boolean(qrTarget && !qrDataUrl && !qrError)}
      data-qr-error={Boolean(qrError)}
      style={{
        '--card-width': `${CARD.width}px`, '--card-height': `${CARD.height}px`,
        '--c-blue': COLORS.blue, '--c-red': COLORS.red, '--c-gold': COLORS.gold,
      }}
    >
      <header className="idcard__header">
        <div className="idcard__corner idcard__corner--left">
          <span>{org.registrationText || 'पंजीकरण सं०'}</span>
          <span>{org.registrationValue || '29/2024'}</span>
        </div>
        <FittedText className="idcard__authority">
          {org.authorityText || 'GOVERNMENT OF UTTAR PRADESH'}
        </FittedText>
        <div className="idcard__corner idcard__corner--right">
          <span>ID NO.</span>
          <FittedText as="span" className="idcard__member-id">{member.memberId || '—'}</FittedText>
        </div>
        <FittedText as="h2" className="idcard__trust-name">{org.name}</FittedText>
      </header>

      <div className="idcard__body">
        <div className="idcard__logo">
          {org.logoUrl && <img src={org.logoUrl} alt="Trust emblem" />}
        </div>

        <div className="idcard__identity">
          <FittedText className="idcard__name">{name}</FittedText>
          <FittedText className="idcard__designation">{member.designation || 'सदस्य'}</FittedText>
          <FittedText className="idcard__state">{member.state || ''}</FittedText>
          <FittedText className="idcard__district">{member.district || ''}</FittedText>
          <FittedText className="idcard__validity">
            {`वैधता दिनांक: ${formatDate(member.validUntil) || '—'}`}
          </FittedText>
          <FittedText className="idcard__scope">{org.scopeText || ''}</FittedText>
        </div>

        <div className="idcard__photo">
          {member.photoUrl ? (
            <img src={member.photoUrl} alt={`Portrait of ${name}`} crossOrigin="anonymous" />
          ) : (
            <div className="idcard__photo-empty" aria-label="Member photo">
              <svg width="80" height="80" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="1.2" aria-hidden="true">
                <circle cx="12" cy="8" r="4" />
                <path d="M4 22v-2a8 8 0 0 1 16 0v2" />
              </svg>
            </div>
          )}
        </div>

        {org.signatureUrl && <img className="idcard__signature" src={org.signatureUrl} alt="Authorised signature" />}
        {org.sealUrl && <img className="idcard__seal" src={org.sealUrl} alt="Trust seal" />}
        <div className="idcard__signatory">
          <FittedText className="idcard__signatory-name">{org.signatoryName || ''}</FittedText>
          <FittedText className="idcard__signatory-role">{org.signatoryDesignation || ''}</FittedText>
        </div>

        {qrDataUrl && (
          <div className="idcard__qr"><img src={qrDataUrl} alt="Scan to verify membership" /></div>
        )}
        {showDemoFlag && org.isDemo && <span className="idcard__demo-flag">Demo data</span>}
      </div>

      <footer className="idcard__footer">
        {String(org.footerText || '').split('\n').map((line, index) => (
          <FittedText key={index} className={`idcard__footer-line idcard__footer-line--${index + 1}`}>
            {line}
          </FittedText>
        ))}
      </footer>
    </article>
  );
});

export default IDCardTemplate;
