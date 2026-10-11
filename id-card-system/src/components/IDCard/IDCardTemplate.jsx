import {
  forwardRef,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
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

/**
 * Shrink a single-line heading until it fits the width available to it.
 *
 * Character counts are the wrong tool for this. The trust name is a fixed
 * string whose rendered width depends on which font actually loaded - the
 * width shifted by ~7% when the self-hosted Noto replaced the Nirmala UI
 * fallback, which was enough to clip the final letter. Measuring the rendered
 * box is the only version of this that stays correct across font swaps,
 * unicode-range coverage and browser zoom.
 *
 * Returns the font size in px to apply, and re-measures when webfonts settle,
 * since the first paint measures against a fallback face.
 */
function useFittedFontSize(ref, { max, min }) {
  const [px, setPx] = useState(max);

  const measure = useCallback(() => {
    const el = ref.current;
    const host = el?.parentElement;
    if (!el || !host) return;

    const hostStyle = getComputedStyle(host);
    const available =
      host.clientWidth
      - parseFloat(hostStyle.paddingLeft || '0')
      - parseFloat(hostStyle.paddingRight || '0');
    if (available <= 0) return;

    // Measure at the ceiling size so the ratio is taken from a known baseline
    // rather than compounding across successive re-renders.
    el.style.fontSize = `${max}px`;
    const natural = el.scrollWidth;
    if (natural <= available) {
      setPx(max);
      return;
    }

    setPx(Math.max(min, Math.floor(max * (available / natural))));
  }, [ref, max, min]);

  useLayoutEffect(() => {
    measure();
  }, [measure]);

  useEffect(() => {
    // A fallback face measures differently from the real one. Re-run once the
    // webfonts have loaded, otherwise the first measurement is kept and the
    // heading stays the wrong size.
    let cancelled = false;
    const rerun = () => { if (!cancelled) measure(); };

    if (document.fonts?.status === 'loaded') {
      rerun();
    } else {
      document.fonts?.ready.then(rerun).catch(() => {});
    }

    window.addEventListener('resize', rerun);
    return () => {
      cancelled = true;
      window.removeEventListener('resize', rerun);
    };
  }, [measure]);

  return px;
}

/**
 * splitTrustName() used to cut the trust name on the word boundary nearest the
 * middle, so each half could take the colour opposite the background beneath it.
 * The name is now a single gold colour, so there is nothing to split - the
 * helper and its markup are both gone.
 *
 * Kept here as a note rather than deleted silently: if the design ever goes
 * back to the two-colour treatment, this is what has to come back with it.
 */

function IDCardTemplate(
  { organization, member, verifyUrl = null, className = '', showDemoFlag = true },
  ref,
) {
  const org = organization ?? {};
  const m = member ?? {};

  // The trust name is the widest fixed element on the card and must never
  // clip, so its size is measured rather than guessed from its length.
  const trustNameRef = useRef(null);
  const trustNamePx = useFittedFontSize(trustNameRef, { max: 54, min: 22 });

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
        <div className="idcard__header-bg" />
        <div className="idcard__header-accent" aria-hidden="true" />
        <div className="idcard__header-rule" aria-hidden="true" />

        <div className="idcard__header-text">
          {/* English trust name, single gold colour with a deep extrusion.
              It was previously split into two colours (red over the blue half,
              white over the red half) to invert against the background. The
              client preferred one solid colour, so the split was dropped and
              gold chosen: it is the only hue that holds its contrast against
              BOTH the blue and the red half of the header, and it already
              appears in the emblem and the corner rules. */}
          {org.trustNameEn ? (
            <div
              ref={trustNameRef}
              className="idcard__trust-name"
              style={{ fontSize: `${trustNamePx}px` }}
            >
              {org.trustNameEn}
            </div>
          ) : null}
        </div>

        {/* Registration number, top-left corner */}
        {org.registrationText ? (
          <div className="idcard__corner idcard__corner--left">
            <span className="idcard__corner-label">पंजीकरण सं०</span>
            <span className="idcard__corner-value">{org.registrationValue ?? org.registrationText}</span>
          </div>
        ) : null}

        {/* Member ID number, top-right corner */}
        <div className="idcard__corner idcard__corner--right">
          <span className="idcard__corner-label">ID No.</span>
          <span className="idcard__corner-value">{memberId || '—'}</span>
        </div>

        {/* State authority, centred in the gap the two corner blocks leave
            between them. It reads as the issuing authority for both numbers -
            which is what it factually is - rather than as a third data field.
            This used to be the first line of the footer; the client moved it
            up here. */}
        {org.authorityText ? (
          <div className="idcard__authority">{org.authorityText}</div>
        ) : null}

        {/* Certification badge - omitted entirely when the organisation has none */}
        {org.isoText ? (
          <div className="idcard__iso">
            <span className="idcard__iso-text">{org.isoText}</span>
          </div>
        ) : null}
      </header>

      {/* ================= BODY ================= */}
      <div className="idcard__body">
        {/* organisation logo - fixed slot, left side */}
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

      {/*
        The support / objective band (जनकल्याण विश्वास …) sat here as a navy pill
        directly below the ALL INDIA pill. The client asked for that line to go,
        so the band is no longer rendered. `org.supportText` is deliberately left
        in the config - emptying the field in Settings is enough to bring it
        back, and the band is where the space it used to occupy is reclaimed
        (the body below was extended to match).
      */}

      {/* ================= FOOTER (fixed) ================= */}
      <footer className="idcard__footer">
        <div className="idcard__footer-text">{org.footerText ?? ''}</div>
      </footer>
    </div>
  );
}

export default forwardRef(IDCardTemplate);