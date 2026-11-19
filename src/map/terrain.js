// Relief and 3D terrain from config.json's map.terrain: free Terrarium
// elevation tiles (AWS Open Data, no key). Pure: tested in
// test/terrain.test.mjs. useMapStage adds the sources, the hillshade layer
// and the terrain after every style load. The colour relief reads the
// hillshade's source, tinting the same tiles by height.
//
// Terrain and hillshade read the same tiles through two sources, as
// MapLibre's own 3D terrain example does: the terrain mesh and the shading
// are prepared differently from the same data.

import { transformCrs } from "@omcoskun/convert-tools";
import { MERCATOR_LATITUDE_LIMIT } from "./map-adapter.js";

/**
 * @typedef {{
 *   tiles: string,
 *   encoding: "terrarium" | "mapbox",
 *   tileSize: number,
 *   maxzoom: number,
 *   attribution: { text: string, href: string }[],
 * }} Terrain
 */

export const TERRAIN_SOURCE = "convert-terrain";
export const HILLSHADE_SOURCE = "convert-hillshade";
export const HILLSHADE_LAYER = "convert-hillshade";

/** The vertical exaggerations the layers panel offers; 1 is true scale. */
export const EXAGGERATIONS = Object.freeze([1, 1.5, 2]);

/** The MapLibre raster-dem source of `terrain`. */
export function demSource({ tiles, tileSize, maxzoom, encoding }) {
  return { type: "raster-dem", tiles: [tiles], tileSize, maxzoom, encoding };
}

/** Whether a source id is one of the elevation sources (their tile failures are not the basemap's). */
export function isDemSource(id) {
  return id === TERRAIN_SOURCE || id === HILLSHADE_SOURCE;
}

/** MapLibre's terrain option: the terrain source, at an offered exaggeration (else 1). */
export function terrainSpec(exaggeration) {
  return { source: TERRAIN_SOURCE, exaggeration: EXAGGERATIONS.includes(exaggeration) ? exaggeration : 1 };
}

// Shading per basemap tone: warm grey on the light map, deep shadows and
// faint highlights on the dark one, and only a touch on photographs, which
// carry their own shadows.
const HILLSHADE_PAINT = Object.freeze({
  light: Object.freeze({
    "hillshade-exaggeration": 0.35,
    "hillshade-shadow-color": "#5b5446",
    "hillshade-highlight-color": "#ffffff",
    "hillshade-accent-color": "#6f6757",
  }),
  dark: Object.freeze({
    "hillshade-exaggeration": 0.45,
    "hillshade-shadow-color": "#000000",
    "hillshade-highlight-color": "rgba(255, 255, 255, 0.18)",
    "hillshade-accent-color": "#05080c",
  }),
  imagery: Object.freeze({
    "hillshade-exaggeration": 0.2,
    "hillshade-shadow-color": "#000000",
    "hillshade-highlight-color": "rgba(255, 255, 255, 0.5)",
    "hillshade-accent-color": "#000000",
  }),
});

/** The hillshade layer for a basemap tone ("light", "dark" or "imagery"). */
export function hillshadeLayer(tone) {
  return { id: HILLSHADE_LAYER, type: "hillshade", source: HILLSHADE_SOURCE, paint: { ...(HILLSHADE_PAINT[tone] ?? HILLSHADE_PAINT.light) } };
}

// OpenMapTiles source layers drawn over the relief: roads, buildings,
// boundaries, airports and every name.
const ABOVE_RELIEF = new Set(["transportation", "transportation_name", "building", "boundary", "aeroway", "place", "water_name", "poi", "housenumber", "mountain_peak"]);

/**
 * The id of the layer the hillshade goes under: the first road, building,
 * boundary or label layer, or the first of the app's own GeoJSON lines (a
 * line without a source layer); undefined puts it on top.
 * @param {{ id: string, type: string, "source-layer"?: string }[] | undefined} layers
 */
export function hillshadeBeforeId(layers) {
  const above = (layers ?? []).find(
    (layer) => layer.type === "symbol" || ABOVE_RELIEF.has(layer["source-layer"]) || (layer.type === "line" && !layer["source-layer"]),
  );
  return above?.id;
}

export const COLOR_RELIEF_LAYER = "convert-color-relief";

/** The colour ramp of the relief, as [metres above sea level, colour]; the lowest stop is the transparent sea floor. */
export const COLOR_RELIEF_STOPS = Object.freeze([
  Object.freeze([-1, "rgba(0, 0, 0, 0)"]),
  Object.freeze([0, "#5f8f4e"]),
  Object.freeze([300, "#9bb86a"]),
  Object.freeze([800, "#d6cf8c"]),
  Object.freeze([1500, "#d2a86a"]),
  Object.freeze([2500, "#b07d57"]),
  Object.freeze([3500, "#9c8f86"]),
  Object.freeze([4500, "#e9e6e2"]),
  Object.freeze([6000, "#ffffff"]),
]);

// Strength per basemap tone: strong enough to read the shape on a drawn map,
// lighter on the dark one and on photographs, which carry their own colours.
const COLOR_RELIEF_OPACITY = Object.freeze({ light: 0.4, dark: 0.3, imagery: 0.25 });

/**
 * The colour relief layer for a basemap tone: the hillshade's elevation tiles
 * tinted by height, from lowland green to white peaks.
 */
export function colorReliefLayer(tone) {
  return {
    id: COLOR_RELIEF_LAYER,
    type: "color-relief",
    source: HILLSHADE_SOURCE,
    paint: {
      "color-relief-color": ["interpolate", ["linear"], ["elevation"], ...COLOR_RELIEF_STOPS.flat()],
      "color-relief-opacity": COLOR_RELIEF_OPACITY[tone] ?? COLOR_RELIEF_OPACITY.light,
    },
  };
}

/**
 * The id of the layer the colour relief goes under: the hillshade when it is
 * shown, else where the hillshade would go; undefined puts it on top.
 * @param {{ id: string, type: string, "source-layer"?: string }[] | undefined} layers
 */
export function colorReliefBeforeId(layers) {
  return (layers ?? []).some((layer) => layer.id === HILLSHADE_LAYER) ? HILLSHADE_LAYER : hillshadeBeforeId(layers);
}

/**
 * The credits to show: the basemap's, and the elevation tiles' while relief
 * or 3D terrain is shown, each link once.
 * @param {{ text: string, href: string }[]} basemapCredits
 * @param {Terrain | null | undefined} terrain
 * @param {boolean} shown
 */
export function terrainCredits(basemapCredits, terrain, shown) {
  if (!shown || !terrain) return basemapCredits;
  const links = new Set(basemapCredits.map(({ href }) => href));
  return [...basemapCredits, ...terrain.attribution.filter(({ href }) => !links.has(href))];
}

/** Metres of a Terrarium pixel. */
export function terrariumElevation(red, green, blue) {
  return red * 256 + green + blue / 256 - 32768;
}

// EPSG:3857 runs from −HALF to +HALF metres on both axes (π × 6378137).
const WEB_MERCATOR_HALF = 20037508.342789244;

/**
 * The Web Mercator tile (x, y) at `zoom` and the pixel (column, row) in it
 * that covers a point, from the library's EPSG:4326 → EPSG:3857 transform.
 * Latitudes past the Mercator edge take the edge; longitudes wrap, 180° being
 * −180°.
 */
export function demPixel(latitude, longitude, zoom, tileSize = 256) {
  const world = (1 << zoom) * tileSize;
  const wrapped = ((((longitude + 180) % 360) + 360) % 360) - 180;
  const edge = Math.max(-MERCATOR_LATITUDE_LIMIT, Math.min(MERCATOR_LATITUDE_LIMIT, latitude));
  const { x, y } = transformCrs("EPSG:4326", "EPSG:3857", wrapped, edge);
  const clamp = (value) => Math.max(0, Math.min(world - 1, Math.floor(value)));
  const pixelX = clamp(((x + WEB_MERCATOR_HALF) / (2 * WEB_MERCATOR_HALF)) * world);
  const pixelY = clamp(((WEB_MERCATOR_HALF - y) / (2 * WEB_MERCATOR_HALF)) * world);
  return { x: Math.floor(pixelX / tileSize), y: Math.floor(pixelY / tileSize), column: pixelX % tileSize, row: pixelY % tileSize };
}
