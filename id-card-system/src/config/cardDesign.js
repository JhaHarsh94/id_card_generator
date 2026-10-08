/**
 * LOCKED ID-CARD DESIGN CONSTANTS
 * ---------------------------------------------------------------------------
 * Two separate things live here, and they must not be confused:
 *
 *  1. THE CARD DESIGN  - the member ID card layout: blue/red diagonal header,
 *     organisation header, logo block, member photo, name/designation/state,
 *     ID number, validity, QR code, signature, supporting band and footer.
 *     Reproduced from the organisation's member ID card artwork and measured
 *     off the rectified reference (see reference-analysis/).
 *
 *  2. THE ORGANISATION CONTENT - the name, registration number, founder,
 *     phone, addresses and objective. These are DATA, not design, and live in
 *     organization.default.js / the Settings page.
 *
 * The design is LOCKED: no colour picker, no template chooser, no layout
 * editing anywhere in the app. Only member data varies per card.
 */

/* ---- physical card ----------------------------------------------------- */
export const CARD = {
  widthMM: 85.6,
  heightMM: 53.98,
  /** Design canvas: 10 px per mm. */
  width: 856,
  height: 540,
  borderRadius: 0,
};

/** 856 x 2.5 = 2140 px wide, comfortably above 300 DPI for CR80. */
export const EXPORT_SCALE = 2.5;

/* ---- palette (sampled from the reference, white-balanced) --------------- */
export const COLORS = {
  blue: '#171F73',
  blueDark: '#121A5F',
  blueMid: '#2B348F',
  red: '#E53C48',
  redDark: '#C22C38',
  gold: '#F5A623',
  white: '#FFFFFF',
  offWhite: '#F7F8FB',
};

/**
 * Vertical bands as a fraction of card height.
 *
 * The body band is 3px taller than the reference artwork: the original card
 * carries no QR code, and the white area directly beneath the photo is the
 * only place a scannable one can sit without covering the member's face or
 * moving the signature. Everything else is unmodified.
 */
export const BANDS = {
  header: { from: 0.0, to: 0.2463 },
  subHeader: { from: 0.2463, to: 0.3037 },
  body: { from: 0.3037, to: 0.8 },
  support: { from: 0.8, to: 0.9 },
  footer: { from: 0.9, to: 1.0 },
};

/** Diagonal split geometry for the header and footer bands. */
export const HEADER_DIAGONAL = { left: 60, right: 100 };
export const FOOTER_DIAGONAL = { left: 82, right: 100 };

/* ---- typography --------------------------------------------------------- */
export const TYPE = {
  orgName: 46,
  orgNameHi: 38,
  subHeader: 17,
  memberName: 44,
  designation: 30,
  state: 30,
  validity: 28,
  scope: 17,
  memberId: 19,
  signatory: 15,
  signatoryRole: 10,
  support: 24,
  footer: 15,
  qrLabel: 6.5,
};

/* ---- fixed element boxes, px on the 856 x 540 canvas -------------------- */
export const BOXES = {
  logo: { left: 34, top: 12, width: 180, height: 180 },
  photo: { left: 636, top: 24, width: 186, height: 156 },
  /** Directly beneath the photo; shares that row with the signatory. */
  qr: { left: 636, top: 188, width: 66, height: 66 },
  /** Overlaps the lower-left corner of the photo, as on the reference. */
  seal: { left: 600, top: 110, width: 84, height: 84 },
  signatory: { left: 712, top: 186, width: 120 },
};

/** Member photo is cover-cropped, never stretched. */
export const PHOTO_FIT = 'cover';
export const PHOTO_POSITION = 'center 22%';

export default CARD;