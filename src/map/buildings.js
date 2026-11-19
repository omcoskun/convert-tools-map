// 3D buildings from the basemap's vector tiles: the OpenMapTiles building
// layer of OpenFreeMap carries render_height and render_min_height in
// metres. Pure: tested in test/buildings.test.mjs. useMapStage adds the
// layer after every style load, in the 3D view only.
//
// The app owns the extrusion on every basemap: the style's own extrusions
// (the detailed map has one) are removed and its flat footprints run to
// zoom 24, so a switch alone decides whether buildings rise.

/** The id of the app's 3D buildings layer. */
export const BUILDINGS_LAYER = "convert-buildings-3d";

/** The zoom the buildings rise from: from there the tiles carry their heights. */
export const BUILDINGS_MINZOOM = 14;

// Building colour per basemap tone: warm grey on the light map, deep on the
// dark one, and the pale stone of the photographs.
const BUILDING_COLORS = Object.freeze({
  light: "#dcd7cf",
  dark: "#2b2f36",
  imagery: "#e6e1d8",
});

/**
 * The source the buildings come from: the source of the style's first
 * building layer, else its openmaptiles vector source; undefined when the
 * style has neither.
 * @param {{ sources?: object, layers?: { source?: string, "source-layer"?: string }[] } | undefined} style
 */
export function buildingSource(style) {
  const layer = (style?.layers ?? []).find((entry) => entry["source-layer"] === "building");
  if (layer) return layer.source;
  return style?.sources?.openmaptiles?.type === "vector" ? "openmaptiles" : undefined;
}

/**
 * The 3D buildings layer for a basemap tone, over the OpenMapTiles building
 * layer of `source`: boxes from the tiles' render heights, fading in past
 * zoom 14.
 * @param {string} tone
 * @param {string} source
 */
export function buildingsLayer(tone, source) {
  return {
    id: BUILDINGS_LAYER,
    type: "fill-extrusion",
    source,
    "source-layer": "building",
    minzoom: BUILDINGS_MINZOOM,
    filter: ["!", ["has", "hide_3d"]],
    paint: {
      "fill-extrusion-color": BUILDING_COLORS[tone] ?? BUILDING_COLORS.light,
      "fill-extrusion-height": ["get", "render_height"],
      "fill-extrusion-base": ["get", "render_min_height"],
      "fill-extrusion-opacity": ["interpolate", ["linear"], ["zoom"], 14, 0, 15, 0.85],
    },
  };
}

/**
 * The ids of the style's own building extrusions (the app's layer aside):
 * they give way to the app's.
 * @param {{ id: string, type: string, "source-layer"?: string }[] | undefined} layers
 */
export function styleBuildingExtrusions(layers) {
  return (layers ?? [])
    .filter((layer) => layer.type === "fill-extrusion" && layer["source-layer"] === "building" && layer.id !== BUILDINGS_LAYER)
    .map((layer) => layer.id);
}

/**
 * The style's flat building footprints that stop before zoom 24, with the
 * range the app widens them to: { id, minzoom }, the layer's own or 0.
 * @param {{ id: string, type: string, "source-layer"?: string, minzoom?: number, maxzoom?: number }[] | undefined} layers
 */
export function flatBuildingLayers(layers) {
  return (layers ?? [])
    .filter((layer) => layer.type === "fill" && layer["source-layer"] === "building" && typeof layer.maxzoom === "number" && layer.maxzoom < 24)
    .map((layer) => ({ id: layer.id, minzoom: layer.minzoom ?? 0 }));
}

/**
 * The id of the layer the buildings go under: the first label, or the first
 * of the app's own GeoJSON lines (a line without a source layer); undefined
 * puts them on top.
 * @param {{ id: string, type: string, "source-layer"?: string }[] | undefined} layers
 */
export function buildingsBeforeId(layers) {
  return (layers ?? []).find((layer) => layer.type === "symbol" || (layer.type === "line" && !layer["source-layer"]))?.id;
}
