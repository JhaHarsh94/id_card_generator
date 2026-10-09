/**
 * Client-side image preparation.
 *
 * Member photos are currently held in the browser as base64 data URLs. Storing a
 * phone photo untouched consumes ~1.4 MB per member (base64 adds ~33%), and
 * localStorage only holds ~5 MB - so a handful of members would exhaust the
 * quota and every further save would throw.
 *
 * These helpers downscale to roughly the card's print requirement and re-encode
 * as JPEG, which cuts the stored size by an order of magnitude while staying
 * visually lossless at card size (the card frame is 186 x 156 px; at 300 DPI
 * that is ~740 x 620 px, so 900 px is comfortably sufficient).
 */

/** Longest edge, in pixels, after downscaling. */
export const MAX_PHOTO_EDGE = 900;

const JPEG_QUALITY = 0.82;

/** Rough byte size of a data URL without decoding it. */
export function dataUrlBytes(dataUrl) {
  if (typeof dataUrl !== 'string') return 0;
  const comma = dataUrl.indexOf(',');
  if (comma < 0) return 0;
  const b64 = dataUrl.length - comma - 1;
  return Math.floor((b64 * 3) / 4);
}

/** Human-readable size for error messages. */
export function formatBytes(bytes) {
  if (!bytes) return '0 KB';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Downscale and re-encode an image data URL.
 *
 * @param {string} dataUrl  original image as a data URL
 * @param {{ maxEdge?: number, quality?: number }} [options]
 * @returns {Promise<{ dataUrl: string, width: number, height: number, bytes: number }>}
 */
export async function compressImage(dataUrl, options = {}) {
  const { maxEdge = MAX_PHOTO_EDGE, quality = JPEG_QUALITY } = options;

  const image = await loadImage(dataUrl);

  const scale = Math.min(1, maxEdge / Math.max(image.naturalWidth, image.naturalHeight));
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas-unavailable');

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(image, 0, 0, width, height);

  // JPEG is universally supported and far smaller than PNG for photographs.
  const out = canvas.toDataURL('image/jpeg', quality);

  return { dataUrl: out, width, height, bytes: dataUrlBytes(out) };
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('decode-failed'));
    img.src = src;
  });
}

/** Read a File into a data URL. */
export function readAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('read-failed'));
    reader.readAsDataURL(file);
  });
}

/** Read a data URL's natural pixel dimensions. */
export function readSize(dataUrl) {
  return loadImage(dataUrl).then((i) => ({
    width: i.naturalWidth,
    height: i.naturalHeight,
  }));
}