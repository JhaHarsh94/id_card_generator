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

  /** Line beneath the header: registration information. */
  registrationText: 'रजिस्ट्रेशन संख्या : 29/2024',
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
  scopeText: 'संस्थापक सत्यापक : मनोज कुमार · मो० 9458447100',
  /** Supporting / objective band above the footer. */
  supportText: 'गरीब बहन बेटियों की शादी करना व सहायता करना हमारा उद्देश्य',
  /** Footer band. `\n` renders as a line break. */
  footerText:
    'कार्यालय निवास : ग्राम कुँहरा, अमीनगर सरिया बागपद उत्तर प्रदेश - 250606\n'
    + 'कार्यालय : मेरठ बागपत रोड, सिंगावली अहिर नियर बिजलीघर बागपत उत्तर प्रदेश 250606',

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