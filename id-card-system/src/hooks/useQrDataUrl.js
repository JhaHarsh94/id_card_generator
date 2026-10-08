import { useEffect, useState } from 'react';
import QRCode from 'qrcode';

/**
 * Generate a QR code as a data URL.
 *
 * The QR encodes ONLY the public verification URL. No member data, no admin
 * data, no tokens - scanning the card must not disclose anything beyond what
 * the public verification page already shows.
 *
 * @param {string} value      text to encode
 * @param {object} [options]
 * @param {number} [options.size=512]      pixel size of the square output
 * @param {number} [options.margin=1]      quiet-zone modules (spec minimum is 4
 *                                        for print; 1 is used here because the
 *                                        card draws its own white border)
 * @param {ErrorCorrectionLevel} [options.errorCorrection='M']
 */
export function useQrDataUrl(value, options = {}) {
  const {
    size = 512,
    margin = 1,
    errorCorrection = 'M',
  } = options;

  const [state, setState] = useState({ url: null, error: null });

  // Clear the previous result during render (React's sanctioned
  // render-phase-adjustment pattern) rather than synchronously inside the
  // effect, which would cause an extra cascading render.
  if (!value && state.url !== null) {
    setState({ url: null, error: null });
  }

  useEffect(() => {
    if (!value) return undefined;

    let cancelled = false;

    QRCode.toDataURL(value, {
      width: size,
      margin,
      errorCorrectionLevel: errorCorrection,
      // Solid single colour keeps the modules crisp and avoids anti-aliasing
      // artefacts when the small card-sized QR is scanned.
      color: { dark: '#000000ff', light: '#ffffffff' },
      type: 'image/png',
    })
      .then((url) => {
        if (!cancelled) setState({ url, error: null });
      })
      .catch((err) => {
        if (!cancelled) setState({ url: null, error: err });
      });

    return () => {
      cancelled = true;
    };
  }, [value, size, margin, errorCorrection]);

  return state;
}

export default useQrDataUrl;