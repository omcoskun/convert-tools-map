// The approximate elevation of a point: one pixel of the Terrarium tile that
// covers it (terrain.js). The context menu shows it; it is not used in any
// computation. Tested in test/elevation.test.mjs with an injected loader.

import { demPixel, terrariumElevation } from "./terrain.js";

/**
 * The zoom elevations are read at: about 10 m per pixel at the equator,
 * finer than the source data in most places (SRTM is about 30 m).
 */
export const ELEVATION_ZOOM = 14;

/**
 * A reader of point elevations from `terrain`'s tiles. Tiles are loaded once
 * and kept; a tile that fails is forgotten, so the next read tries again.
 * @param {import("./terrain.js").Terrain} terrain
 * @param {{ load: (url: string) => Promise<{ width: number, height: number, data: Uint8ClampedArray }> }} options
 * @returns {(latitude: number, longitude: number) => Promise<number | null>} metres, or null
 */
export function createElevationReader(terrain, { load }) {
  const tiles = new Map();
  const size = terrain.tileSize ?? 256;
  const zoom = Math.min(ELEVATION_ZOOM, terrain.maxzoom ?? ELEVATION_ZOOM);
  return async function read(latitude, longitude) {
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
    const { x, y, column, row } = demPixel(latitude, longitude, zoom, size);
    const url = terrain.tiles.replace("{z}", String(zoom)).replace("{x}", String(x)).replace("{y}", String(y));
    if (!tiles.has(url)) tiles.set(url, load(url));
    try {
      const image = await tiles.get(url);
      if (image.width !== size || image.height !== size) return null;
      const at = (row * size + column) * 4;
      return terrariumElevation(image.data[at], image.data[at + 1], image.data[at + 2]);
    } catch {
      tiles.delete(url);
      return null;
    }
  };
}

/**
 * Loads a tile's pixels in the browser: fetched (the CSP allows the tiles'
 * origin in connect-src), decoded without colour conversion, which would
 * change the encoded heights.
 * @param {string} url
 */
export async function loadImageData(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Elevation tile ${response.status}`);
  const bitmap = await createImageBitmap(await response.blob(), { colorSpaceConversion: "none", premultiplyAlpha: "none" });
  const canvas = typeof OffscreenCanvas === "function" ? new OffscreenCanvas(bitmap.width, bitmap.height) : Object.assign(document.createElement("canvas"), { width: bitmap.width, height: bitmap.height });
  const context = canvas.getContext("2d", { willReadFrequently: true });
  context.drawImage(bitmap, 0, 0);
  bitmap.close?.();
  return context.getImageData(0, 0, canvas.width, canvas.height);
}
