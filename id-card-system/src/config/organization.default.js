/**
 * ORGANISATION CONTENT (data, not design)
 * ---------------------------------------------------------------------------
 * The organisation is पूर्ण कबीरा सब धर्म सहायता समिति, बागपद — registration
 * 29/2024, founder मनोज कुमार.
 *
 * These values fill FIXED SLOTS on the locked member ID card. Which slot each
 * value occupies is part of the design and cannot change; the values themselves
 * are editable through Settings.
 *
 * `isDemo: false` - the organisation details below are the client's real,
 * confirmed values, so the "DEMO DATA" watermark is switched off. The seeded
 * MEMBER records are still placeholders and are replaced on first real use.
 */

import logoUrl from '../assets/org/logo-client.png';
import stampUrl from '../assets/org/stamp-client.png';
import signatureUrl from '../assets/org/signature.png';

export const organizationDefaults = {
  /** Controls the "DEMO DATA" watermark. Real organisation - off. */
  isDemo: false,

  // ---- header -----------------------------------------------------------
  /** Main heading in the header band. */
  name: 'पूर्ण कबीरा सब धर्म सहायता समिति',
  /** Optional second heading line. Empty = not rendered. */
  nameHi: '',
  /** Superscript mark after the organisation name. */
  registrationMark: '',

  // ---- header (left / centre / right) ---------------------------------
  /** Top-left of the header band. */
  registrationText: 'पंजीकरण सं० : 29/2024',

  /**
   * English trust name, shown in 3D beside the logo at the top-right.
   * Rendered gold with a red-then-navy extrusion (two colours) so it stays
   * legible over both the blue and the red halves of the header.
   */
  trustNameEn: 'PUNAM KABIRA SARV DHARAM SAHAYATA TRUST',

  /** Optional certification badge. Empty = badge not rendered. */
  isoText: '',

  // ---- assets -----------------------------------------------------------
  /** Organisation logo, shown on the white disc at the top of the header. */
  logoUrl,
  /**
   * Circular rubber stamp overlapping the member photo - the organisation's
   * official stamp, not the logo.
   */
  sealUrl: stampUrl,
  /** Full uncropped stamp, including the signature. */
  signatureUrl,

  // ---- signatory (fixed on every card) ----------------------------------
  signatoryName: 'मनोज कुमार',
  signatoryDesignation: 'संस्थापक सत्यापक',

  // ---- fixed copy -------------------------------------------------------
  /** Small line under the validity date. */
  scopeText: 'All India',

  /** Supporting / objective band above the footer. */
  supportText:
    'जनकल्याण विश्वास : बाल विवाह, अनाताल विवाह, अनाम विवाह, दहेज प्रथा - 250605',

  /**
   * Footer band. `\n` renders as a line break.
   * Head office is Luhara, Aminagar Sarai, Baghpat, Uttar Pradesh 250605.
   */
  footerText:
    'पता (मुख्य कार्यालय) : लुहारा, अमीनगर सराया, बागपत, उत्तर प्रदेश - 250605\n'
    + 'मोबाइल नं. : 9458447100  ·  सहायक : 9997598847',

  // ---- ID numbering -----------------------------------------------------
  idPrefix: '',
  idStart: 95030,
  idPadding: 7, // 0095030

  // ---- behaviour --------------------------------------------------------
  defaultValidityMonths: 12,
  qrEnabled: true,
  verifyBaseUrl: '',
};

export default organizationDefaults;