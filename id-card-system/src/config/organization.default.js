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
 * `isDemo: true` keeps development honest: demo records are labelled so they
 * can never be mistaken for a genuine credential.
 */

import logoUrl from '../assets/org/logo.png';
import stampUrl from '../assets/org/stamp.png';
import signatureUrl from '../assets/org/signature.png';

export const organizationDefaults = {
  isDemo: true,

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

  /** Top-right of the header band. */
  founderLabel: 'संस्थापक सत्यापक',
  founderName: 'मनोज कुमार',
  founderPhone: 'मो० 9458447100',

  /** Optional certification badge. Empty = badge not rendered. */
  isoText: '',

  // ---- assets -----------------------------------------------------------
  /** Square organisation logo, left side of the card body. */
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