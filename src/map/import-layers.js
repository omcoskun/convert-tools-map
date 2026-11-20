// The MapLibre layers and hover expressions of an imported data file, which
// features the pointer can hit, and the summary its card shows. Pure: tested
// in test/import-layers.test.mjs and checked against MapLibre's style spec.
// useImports.js adds the layers and wires the pointer to them.

/** The id prefix of an imported file's source and layers. */
export const IMPORT_PREFIX = "convert-import-";

const isAny = (types) => ["in", ["geometry-type"], ["literal", types]];
const AREA = isAny(["Polygon", "MultiPolygon"]);
const LINE = isAny(["LineString", "MultiLineString"]);
const POINT = isAny(["Point", "MultiPoint"]);

/** The layers of one file, in drawing order. */
export const LAYER_SUFFIXES = Object.freeze(["fill", "outline", "casing", "line", "point", "label"]);

// The layers a pointer picks a feature from, topmost first; outlines, casings and labels only decorate.
export const HIT_SUFFIXES = Object.freeze(["point", "line", "fill"]);

const HOVER = ["boolean", ["feature-state", "hover"], false];

/**
 * The layers that draw a file: its areas as a fill and an outline, its lines
 * with a white casing, its points as circles, and a label per named point
 * when the map has a font. Each grows while its feature is hovered.
 * @param {{ id: string, color: string }} file
 * @param {string[] | null} font
 * @returns {object[]}
 */
export function fileLayers({ id, color }, font) {
  const round = { "line-cap": "round", "line-join": "round" };
  const layers = [
    { id: `${id}-fill`, type: "fill", source: id, filter: AREA, paint: { "fill-color": color, "fill-opacity": ["case", HOVER, 0.38, 0.2] } },
    { id: `${id}-outline`, type: "line", source: id, filter: AREA, layout: round, paint: { "line-color": color, "line-width": ["case", HOVER, 3, 1.6] } },
    {
      id: `${id}-casing`,
      type: "line",
      source: id,
      filter: LINE,
      layout: round,
      paint: { "line-color": "#ffffff", "line-opacity": 0.85, "line-width": ["case", HOVER, 8, 5] },
    },
    { id: `${id}-line`, type: "line", source: id, filter: LINE, layout: round, paint: { "line-color": color, "line-width": ["case", HOVER, 4.2, 2.6] } },
    {
      id: `${id}-point`,
      type: "circle",
      source: id,
      filter: POINT,
      paint: {
        "circle-color": color,
        "circle-radius": ["case", HOVER, 8, 5.5],
        "circle-stroke-color": "#ffffff",
        "circle-stroke-width": ["case", HOVER, 2.6, 1.8],
      },
    },
  ];
  if (font) {
    layers.push({
      id: `${id}-label`,
      type: "symbol",
      source: id,
      filter: ["all", POINT, ["has", "name"]],
      layout: { "text-field": ["get", "name"], "text-font": font, "text-size": 12, "text-offset": [0, 0.9], "text-anchor": "top", "text-max-width": 10, "text-optional": true },
      paint: { "text-color": "#16191c", "text-halo-color": "#ffffff", "text-halo-width": 1.6 },
    });
  }
  return layers;
}

/**
 * The GeoJSON source of a file; its features are numbered, so the pointer
 * can highlight one with its feature state.
 * @param {object} data A GeoJSON FeatureCollection.
 * @returns {object}
 */
export function fileSource(data) {
  return { type: "geojson", data, generateId: true };
}

/**
 * The ids of the layers a pointer may pick a feature from: the points, lines
 * and areas of the visible files, in file order, whose layer exists.
 * @param {{ id: string, visible: boolean }[]} files
 * @param {(id: string) => boolean} hasLayer
 * @returns {string[]}
 */
export function hitLayerIds(files, hasLayer) {
  return (files ?? [])
    .filter((file) => file.visible)
    .flatMap((file) => HIT_SUFFIXES.map((suffix) => `${file.id}-${suffix}`))
    .filter((id) => hasLayer(id));
}

const TITLE_KEYS = ["name", "title", "label"];
const KINDS = Object.freeze({
  Point: "point",
  MultiPoint: "point",
  LineString: "line",
  MultiLineString: "line",
  Polygon: "area",
  MultiPolygon: "area",
});
const MAX_TITLE = 120;
const MAX_VALUE = 200;
const MAX_KEY = 60;

const cut = (value, max, ellipsis = "…") => (value.length > max ? `${value.slice(0, max)}${ellipsis}` : value);

const isPlainObject = (value) => typeof value === "object" && value !== null && !Array.isArray(value);

// MapLibre hands a nested property back as JSON text; such a value is no row.
function isNestedJson(raw) {
  if (!raw.startsWith("{") && !raw.startsWith("[")) return false;
  try {
    const parsed = JSON.parse(raw);
    return Boolean(parsed) && typeof parsed === "object";
  } catch {
    return false;
  }
}

// A property's card value: finite numbers, booleans and plain texts.
function cardValue(value) {
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : null;
  if (typeof value === "boolean") return String(value);
  if (typeof value !== "string") return null;
  const plain = value.trim();
  if (!plain || isNestedJson(plain)) return null;
  return cut(plain, MAX_VALUE);
}

/**
 * What the card of a feature shows: its title (its name, title or label, else
 * null), its kind (point, line, area or null) and at most `maxRows` other
 * plain properties as key/value pairs.
 * @param {{ geometry?: { type?: string }, properties?: object | null }} feature
 * @param {number} maxRows
 * @returns {{ title: string | null, kind: string | null, rows: [string, string][] }}
 */
export function featureSummary(feature, maxRows = 8) {
  const properties = isPlainObject(feature.properties) ? feature.properties : {};
  let title = null;
  let titleKey = null;
  for (const key of TITLE_KEYS) {
    const value = properties[key];
    if (typeof value === "string" && value.trim()) {
      title = cut(value.trim(), MAX_TITLE);
      titleKey = key;
      break;
    }
  }
  const kind = KINDS[feature.geometry?.type] ?? null;
  const rows = [];
  for (const [key, value] of Object.entries(properties)) {
    if (rows.length >= maxRows) break;
    if (key === titleKey) continue;
    const text = cardValue(value);
    if (text !== null) rows.push([cut(key, MAX_KEY, ""), text]);
  }
  return { title, kind, rows };
}
