// "What is here" for the point menu: the names the basemap draws at a point,
// read from its rendered vector features (OpenMapTiles schema, as served by
// OpenFreeMap). No request is made; a name shows only where the tiles have
// one. One name per kind, in this order: a place of interest, a street, water
// or a park, and the smallest settlement among those drawn there.

const KINDS = Object.freeze({
  poi: "poi",
  aerodrome_label: "poi",
  mountain_peak: "poi",
  transportation_name: "road",
  water_name: "nature",
  waterway: "nature",
  park: "nature",
  place: "place",
});
const ORDER = Object.freeze(["poi", "road", "nature", "place"]);

// Smaller settlements first.
const PLACE_CLASSES = Object.freeze([
  "isolated_dwelling",
  "neighbourhood",
  "quarter",
  "hamlet",
  "suburb",
  "village",
  "town",
  "city",
  "province",
  "state",
  "country",
  "continent",
]);

function placeRank(properties) {
  const index = PLACE_CLASSES.indexOf(properties.class);
  return index < 0 ? PLACE_CLASSES.length : index;
}

function nameOf(properties, language) {
  for (const key of [`name:${language}`, `name_${language}`, "name"]) {
    const value = properties[key];
    if (typeof value === "string" && value.trim() !== "") return value.trim();
  }
  return null;
}

/**
 * @param {{ sourceLayer?: string, properties?: Record<string, unknown> }[]} features
 *   map.queryRenderedFeatures around the point; features of the map's own
 *   GeoJSON layers have no sourceLayer and are left out.
 * @param {string} language
 * @returns {string[]} at most one name per kind
 */
export function placesAt(features, language) {
  const best = new Map();
  for (const feature of features) {
    const kind = KINDS[feature.sourceLayer];
    const properties = feature.properties ?? {};
    if (!kind) continue;
    const name = nameOf(properties, language);
    if (!name) continue;
    const current = best.get(kind);
    if (!current || (kind === "place" && placeRank(properties) < current.rank)) {
      best.set(kind, { name, rank: kind === "place" ? placeRank(properties) : 0 });
    }
  }
  return ORDER.filter((kind) => best.has(kind)).map((kind) => best.get(kind).name);
}
