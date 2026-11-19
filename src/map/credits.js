// Which credits the map's (i) list shows. A credit may carry the zooms its
// source is drawn at (minzoom inclusive, maxzoom exclusive, as on a MapLibre
// layer), so the list names only what the map shows at the current zoom.

/**
 * @typedef {{ text: string, href: string, minzoom?: number, maxzoom?: number }} Credit
 */

/**
 * The credits whose sources are drawn at `zoom`.
 * @param {Credit[]} credits
 * @param {number} zoom
 * @returns {Credit[]}
 */
export function creditsAt(credits, zoom) {
  return credits.filter(({ minzoom, maxzoom }) => (minzoom === undefined || zoom >= minzoom) && (maxzoom === undefined || zoom < maxzoom));
}

/**
 * A basemap's credits, with its close-up imagery's (raster.detail) from that
 * imagery's first zoom while it is used.
 * @param {{ attribution?: Credit[], raster?: { detail?: { minzoom?: number, attribution?: Credit[] } } } | undefined} basemap
 * @param {{ detail: boolean }} use
 * @returns {Credit[]}
 */
export function basemapCredits(basemap, { detail }) {
  const own = basemap?.attribution ?? [];
  const close = detail ? basemap?.raster?.detail : undefined;
  if (!close?.attribution) return own;
  return [...own, ...close.attribution.map((credit) => ({ ...credit, minzoom: close.minzoom }))];
}
