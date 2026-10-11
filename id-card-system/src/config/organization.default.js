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
  registrationText: 'पंजीकरण सं०',
  /** The number itself, shown under the label in the top-left corner. */
  registrationValue: '29/2024',

  /**
   * English trust name, shown in 3D beside the logo at the top-right.
   * Rendered gold with a red-then-navy extrusion (two colours) so it stays
   * legible over both the blue and the red halves of the header.
   */
  trustNameEn: 'PUNAM KABIRA SARV DHARAM SAHAYATA TRUST',

  /**
   * State authority, shown in the header between the registration number and the
   * member ID number.
   *
   * It began in the footer, was briefly tried under the trust name, and settled
   * here: sitting between the two numbers it reads as the body that issued both.
   * Empty = not rendered.
   */
  authorityText: 'Government of Uttar Pradesh',

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
  signatoryName: 'मनोज कुमार कबीरा',
  signatoryDesignation: 'संस्थापक/अध्यक्ष',

  // ---- fixed copy -------------------------------------------------------
  /** Small line under the validity date. */
  scopeText: 'All India',

  /** Supporting / objective band above the footer. */
  supportText:
    'जनकल्याण विश्वास : बाल विवाह, अनाताल विवाह, अनाम विवाह, दहेज प्रथा',

  /**
   * Footer band. `\n` renders as a line break.
   * The state authority line is not here any more - it sits in the header
   * between the two numbers (see authorityText).
   * Head office: ग्राम लुहारा, अमीनगर सराय, बागपत, उत्तर प्रदेश 250606.
   * Contact numbers are listed exactly as supplied by the organisation.
   */
  footerText:
    'निवास कार्यालय :- ग्राम लुहारा अमीनगर सराय बागपत उत्तर प्रदेश 250606\n'
    + 'संपर्क सूत्र : 9458447100, 9557502151, 9457396300',

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