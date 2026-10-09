/**
 * Form validation and image-upload rules.
 *
 * All user-facing messages are written to be shown directly to an
 * administrator - they never expose raw technical detail.
 */

import { isValidYMD, toYMD, toISODate } from './date';

/* ==========================================================================
   Text
   ========================================================================== */

export function required(value, label) {
  if (!String(value ?? '').trim()) return `${label} is required.`;
  return null;
}

export function maxLength(value, limit, label) {
  const v = String(value ?? '');
  if (v.length > limit) {
    return `${label} must be ${limit} characters or fewer.`;
  }
  return null;
}

/**
 * Names on Indian ID cards are often long ("Chaudhary", "Kumari", initials).
 * Generous limits, but bounded so nothing can overflow the fixed card.
 */
export const NAME_MAX = 80;
export const DESIGNATION_MAX = 60;
export const STATE_MAX = 60;
export const DISTRICT_MAX = 60;

/* ==========================================================================
   Dates
   ========================================================================== */

/**
 * Validate a validity window.
 * @returns {{ from: string|null, error: string|null }}
 */
export function validateValidity(validFrom, validUntil) {
  if (!validUntil) return { from: null, error: 'Valid up to date is required.' };

  const until = toYMD(validUntil);
  if (!isValidYMD(until)) return { from: null, error: 'Enter a valid valid-up-to date.' };

  if (validFrom) {
    const from = toYMD(validFrom);
    if (!isValidYMD(from)) return { from: null, error: 'Enter a valid valid-from date.' };
    if (from.y > until.y || (from.y === until.y && from.m > until.m)
      || (from.y === until.y && from.m === until.m && from.d > until.d)) {
      return { from: null, error: 'Valid-from date cannot be after the valid-up-to date.' };
    }
  }

  return { from: toISODate(validFrom), error: null };
}

/* ==========================================================================
   Image upload
   ========================================================================== */

export const IMAGE_RULES = {
  maxBytes: 5 * 1024 * 1024, // 5 MB
  accepted: ['image/jpeg', 'image/png', 'image/webp'],
  /** Portrait-ish ratio hint for the 186x156 card frame. */
  minSide: 200,
};

const EXTENSION_FALLBACK = {
  'image/jpeg': ['jpg', 'jpeg'],
  'image/png': ['png'],
  'image/webp': ['webp'],
};

/**
 * Validate a chosen photo.
 * @returns {{ ok: true } | { ok: false, message: string }}
 */
export function validateImageFile(file) {
  if (!file) return { ok: false, message: 'Choose a photo to upload.' };

  const byType = IMAGE_RULES.accepted.includes(file.type);
  const ext = (file.name.split('.').pop() ?? '').toLowerCase();
  const byExtension = Object.values(EXTENSION_FALLBACK).some((list) => list.includes(ext));

  // Some browsers report an empty type for pasted/odd files, so accept a
  // valid extension as a fallback but never accept an unknown type outright.
  if (!byType && !(file.type === '' && byExtension)) {
    return {
      ok: false,
      message: 'Photo must be a JPG, PNG or WebP image.',
    };
  }

  if (file.size > IMAGE_RULES.maxBytes) {
    const mb = Math.round(file.size / (1024 * 1024));
    return { ok: false, message: `Photo is ${mb} MB. The maximum is 5 MB.` };
  }

  if (file.size === 0) {
    return { ok: false, message: 'That file is empty. Choose another photo.' };
  }

  return { ok: true };
}

/**
 * Check pixel dimensions once the browser has decoded the image.
 * Very small images look broken once scaled into the card frame.
 */
export function checkImageDimensions(width, height) {
  const shortest = Math.min(width, height);
  if (shortest < IMAGE_RULES.minSide) {
    return {
      ok: false,
      message: `Photo is too small (${width}×${height}). Use at least ${IMAGE_RULES.minSide}px on the shorter side.`,
    };
  }
  return { ok: true };
}

/**
 * Reading, resizing and re-encoding images lives in utils/imageProcessing.js -
 * this module only owns the validation rules.
 */

/* ==========================================================================
   Whole-form validation
   ========================================================================== */

/**
 * Validate the member form.
 * @param {object} form
 * @param {string[]} existingIds  IDs already assigned to other members
 * @returns {{ ok: boolean, errors: Record<string,string>, firstField: string|null }}
 */
export function validateMemberForm(form, existingIds = [], currentId = null) {
  const errors = {};
  const add = (field, msg) => {
    if (msg && !errors[field]) errors[field] = msg;
  };

  add('fullName', required(form.fullName, 'Full name'));
  add('fullName', maxLength(form.fullName, NAME_MAX, 'Full name'));

  add('designation', required(form.designation, 'Designation'));
  add('designation', maxLength(form.designation, DESIGNATION_MAX, 'Designation'));

  add('state', required(form.state, 'State'));
  add('state', maxLength(form.state, STATE_MAX, 'State'));

  add('district', maxLength(form.district, DISTRICT_MAX, 'District'));

  const memberId = String(form.memberId ?? '').trim();
  if (!memberId) {
    add('memberId', 'ID number is required.');
  } else if (memberId.length < 3) {
    add('memberId', 'ID number is too short.');
  } else if (!/^[A-Za-z0-9-]+$/.test(memberId)) {
    add('memberId', 'Use letters, numbers and hyphens only.');
  } else if (existingIds.includes(memberId) && memberId !== currentId) {
    add('memberId', `ID number ${memberId} is already assigned.`);
  }

  const { error: dateError } = validateValidity(form.validFrom, form.validUntil);
  add('validUntil', dateError);

  if (form.status === 'revoked' && !String(form.revocationReason ?? '').trim()) {
    add('revocationReason', 'Give a reason for revoking this ID.');
  }

  const firstField = Object.keys(errors)[0] ?? null;
  return { ok: firstField === null, errors, firstField };
}