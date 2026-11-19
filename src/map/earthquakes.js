// Earthquakes from config.json's map.earthquakes: the past week's events of
// magnitude 2.5 and above from the USGS GeoJSON feed (public domain, no key).
// Pure: tested in test/earthquakes.test.mjs. useMapStage adds them while the
// switch is on; zoomed out they are a heatmap weighted by magnitude, from
// zoom 7 circles sized and coloured by magnitude.

/**
 * @typedef {{
 *   data: string,
 *   attribution: { text: string, href: string }[],
 * }} Earthquakes
 */

export const EARTHQUAKE_SOURCE = "convert-earthquakes";
export const EARTHQUAKE_HEAT_LAYER = "convert-earthquakes-heat";
export const EARTHQUAKE_POINT_LAYER = "convert-earthquakes-points";

// Features without a magnitude count as 0.
const MAGNITUDE = ["coalesce", ["get", "mag"], 0];

// The circle's outline per basemap tone: white on the drawn and photographic
// maps, near-black on the dark one.
const STROKE = Object.freeze({ light: "#ffffff", dark: "#0b0d10", imagery: "#ffffff" });

/** The MapLibre GeoJSON source of `earthquakes`. */
export function earthquakeSource({ data }) {
  return { type: "geojson", data };
}

/** Whether a source id is one of the earthquake sources (their feed's failures are not the basemap's). */
export function isEarthquakeSource(id) {
  return typeof id === "string" && id.startsWith(EARTHQUAKE_SOURCE);
}

/** The radius of an earthquake's circle, from its magnitude. */
function magnitudeRadius() {
  return ["interpolate", ["linear"], MAGNITUDE, 2.5, 4, 7, 16];
}

/** The colour of an earthquake's circle, from its magnitude: pale to deep red. */
function magnitudeColor() {
  return ["interpolate", ["linear"], MAGNITUDE, 2.5, "#fdd49e", 4.5, "#fc8d59", 6, "#d7301f", 7, "#7f0000"];
}

/** The heatmap of the earthquakes, weighted by magnitude (no parameter: its colours read on every basemap). */
export function earthquakeHeatLayer() {
  return {
    id: EARTHQUAKE_HEAT_LAYER,
    type: "heatmap",
    source: EARTHQUAKE_SOURCE,
    maxzoom: 9,
    paint: {
      "heatmap-weight": ["interpolate", ["linear"], MAGNITUDE, 2.5, 0.15, 7, 1],
      "heatmap-intensity": ["interpolate", ["linear"], ["zoom"], 0, 1, 9, 3],
      "heatmap-radius": ["interpolate", ["linear"], ["zoom"], 0, 4, 9, 22],
      "heatmap-opacity": ["interpolate", ["linear"], ["zoom"], 7, 0.85, 9, 0],
      "heatmap-color": [
        "interpolate",
        ["linear"],
        ["heatmap-density"],
        0,
        "rgba(33, 102, 172, 0)",
        0.2,
        "rgb(103, 169, 207)",
        0.4,
        "rgb(209, 229, 240)",
        0.6,
        "rgb(253, 219, 199)",
        0.8,
        "rgb(239, 138, 98)",
        1,
        "rgb(178, 24, 43)",
      ],
    },
  };
}

/** The points of the earthquakes for a basemap tone, sized and coloured by magnitude; they fade in from zoom 7. */
export function earthquakePointLayer(tone) {
  return {
    id: EARTHQUAKE_POINT_LAYER,
    type: "circle",
    source: EARTHQUAKE_SOURCE,
    minzoom: 7,
    paint: {
      "circle-radius": magnitudeRadius(),
      "circle-color": magnitudeColor(),
      "circle-opacity": ["interpolate", ["linear"], ["zoom"], 7, 0, 8, 0.9],
      "circle-stroke-width": 1,
      "circle-stroke-color": STROKE[tone] ?? STROKE.light,
      "circle-stroke-opacity": ["interpolate", ["linear"], ["zoom"], 7, 0, 8, 1],
    },
  };
}

/**
 * The id of the layer the earthquakes go under: the first label layer, or the
 * first of the app's own GeoJSON lines (a line without a source layer);
 * undefined puts them on top.
 * @param {{ id: string, type: string, "source-layer"?: string }[] | undefined} layers
 */
export function earthquakesBeforeId(layers) {
  const above = (layers ?? []).find((layer) => layer.type === "symbol" || (layer.type === "line" && !layer["source-layer"]));
  return above?.id;
}
