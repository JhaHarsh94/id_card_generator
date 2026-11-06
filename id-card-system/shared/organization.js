const TEXT_LIMITS = {
  name: 120, nameHi: 120, registrationMark: 20, registrationText: 60,
  registrationValue: 40, trustNameEn: 150, authorityText: 100, isoText: 80,
  signatoryName: 80, signatoryDesignation: 80, scopeText: 80,
  supportText: 500, footerText: 1000, idPrefix: 12, verifyBaseUrl: 500,
};
const RANGES = { idStart: [1, 999999999999], idPadding: [1, 12], defaultValidityMonths: [1, 120] };
const ASSETS = ['logoUrl', 'sealUrl', 'signatureUrl'];

/** Same whitelist and types for saved settings and legacy browser data. */
export function validateOrganization(data) {
  const values = {};
  const errors = {};
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return { values, errors: { organization: 'Send an organisation settings object.' } };
  }
  for (const [key, limit] of Object.entries(TEXT_LIMITS)) {
    if (!Object.hasOwn(data, key)) continue;
    const value = data[key];
    if (typeof value !== 'string' || value.trim().length > limit) {
      errors[key] = `${key} must be text with at most ${limit} characters.`;
    } else values[key] = value.trim();
  }
  if (Object.hasOwn(values, 'name') && !values.name) errors.name = 'Organisation name is required.';
  if (values.footerText && (values.footerText.split('\n').length > 2
    || values.footerText.split('\n').some((line) => line.length > 140))) {
    errors.footerText = 'Use at most two footer lines, with up to 140 characters per line.';
  }
  if (values.idPrefix && !/^[a-zA-Z0-9-]+$/.test(values.idPrefix)) errors.idPrefix = 'ID prefix may contain only letters, numbers and hyphens.';
  if (values.verifyBaseUrl) {
    try {
      const url = new URL(values.verifyBaseUrl);
      if (!['http:', 'https:'].includes(url.protocol)) throw new Error();
      values.verifyBaseUrl = url.origin;
    } catch { errors.verifyBaseUrl = 'Enter an HTTP or HTTPS verification site URL.'; }
  }
  for (const [key, [min, max]] of Object.entries(RANGES)) {
    if (!Object.hasOwn(data, key)) continue;
    if (!Number.isSafeInteger(data[key]) || data[key] < min || data[key] > max) errors[key] = `${key} must be a whole number between ${min} and ${max}.`;
    else values[key] = data[key];
  }
  for (const key of ['isDemo', 'qrEnabled']) {
    if (!Object.hasOwn(data, key)) continue;
    if (typeof data[key] !== 'boolean') errors[key] = `${key} must be true or false.`;
    else values[key] = data[key];
  }
  for (const key of ASSETS) {
    if (!Object.hasOwn(data, key)) continue;
    const value = data[key];
    if (value === null || value === '') { values[key] = null; continue; }
    if (typeof value !== 'string' || value.length > 3000000
      || !/^(data:image\/(png|jpeg|webp);base64,[a-zA-Z0-9+/]+=*|\/(?:src\/)?assets\/[^\s]+|https:\/\/[^\s]+)$/.test(value)) {
      errors[key] = 'Choose a JPG, PNG or WebP asset smaller than 2 MB.';
    } else values[key] = value;
  }
  return { values, errors };
}
