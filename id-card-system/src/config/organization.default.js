import logoUrl from '../assets/org/logo.png';
import sealUrl from '../assets/org/stamp-client.png';
import { validateOrganization } from '../../shared/organization.js';

/** Organisation copy and assets from the supplied membership-card reference. */
export const organizationDefaults = {
  isDemo: false,
  name: 'पूनम कबीरा सर्व धर्म सहायता ट्रस्ट',
  nameHi: '',
  registrationMark: '',
  registrationText: 'पंजीकरण सं०',
  registrationValue: '29/2024',
  trustNameEn: 'PUNAM KABIRA SARV DHARAM SAHAYATA TRUST',
  authorityText: 'GOVERNMENT OF UTTAR PRADESH',
  isoText: '',
  logoUrl,
  sealUrl,
  signatureUrl: null,
  signatoryName: 'मनोज कुमार कबीरा',
  signatoryDesignation: 'संस्थापक/अध्यक्ष',
  scopeText: 'अखिल भारतीय',
  supportText: '',
  footerText: 'मुख्य कार्यालय :- मेरठ बागपत रोड बालैनी बागपत उत्तर प्रदेश 250626\n'
    + 'संपर्क सूत्र : 9458447100, 9557502151, 9457396300',
  idPrefix: 'PKSDST',
  idStart: 1,
  idPadding: 4,
  defaultValidityMonths: 12,
  qrEnabled: false,
  verifyBaseUrl: '',
};

/** Keep uploaded assets; resolve bundled asset URLs again after each deployment. */
export function normalizeOrganization(data) {
  const next = { ...organizationDefaults };
  if (!data || typeof data !== 'object' || Array.isArray(data)) return next;
  Object.assign(next, validateOrganization(data).values);
  if (data.name === 'पूर्ण कबीरा सब धर्म सहायता समिति') {
    next.name = organizationDefaults.name;
    if (data.scopeText === 'All India') next.scopeText = organizationDefaults.scopeText;
    next.qrEnabled = false;
  }
  for (const key of ['logoUrl', 'sealUrl', 'signatureUrl']) {
    if (typeof next[key] === 'string' && /^\/(?:src\/)?assets\/.*\.(png|jpe?g|webp)$/i.test(next[key])) {
      next[key] = organizationDefaults[key];
    }
  }
  next.isDemo = false;
  return next;
}

export default organizationDefaults;
