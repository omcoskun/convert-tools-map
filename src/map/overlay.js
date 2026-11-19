// An image laid over the map by its four corners (MapLibre's canvas source):
// where a new one is first put, and the size it is drawn at.

export const MAX_IMAGE_SIDE = 4096;
const SHARE = 0.6;

/**
 * The screen rectangle (px) a new image first covers: SHARE of the part of
 * the map the widgets leave free, in the image's proportions, centred there.
 * @param {{ width: number, height: number, padding: { top: number, right: number, bottom: number, left: number } }} view
 * @param {{ width: number, height: number }} image
 */
export function overlayRect({ width, height, padding }, image) {
  const freeWidth = Math.max(1, width - padding.left - padding.right);
  const freeHeight = Math.max(1, height - padding.top - padding.bottom);
  const aspect = image.width / image.height;
  let boxWidth = freeWidth * SHARE;
  let boxHeight = boxWidth / aspect;
  if (boxHeight > freeHeight * SHARE) {
    boxHeight = freeHeight * SHARE;
    boxWidth = boxHeight * aspect;
  }
  const centerX = padding.left + freeWidth / 2;
  const centerY = padding.top + freeHeight / 2;
  return { left: centerX - boxWidth / 2, top: centerY - boxHeight / 2, right: centerX + boxWidth / 2, bottom: centerY + boxHeight / 2 };
}

/** The image's size in px, its longer side at most MAX_IMAGE_SIDE. */
export function downscaledSize(width, height) {
  const scale = Math.min(1, MAX_IMAGE_SIDE / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}
