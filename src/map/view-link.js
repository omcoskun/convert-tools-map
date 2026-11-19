// The map view in the page address, beside the tool's #hash:
// ?map=zoom/latitude/longitude[/bearing[/pitch]], as on OpenStreetMap. A link
// copied from the map opens it where it was; the tool links (#measure, ...)
// keep it because they change only the hash.

const NUMBER = /^-?\d+(?:\.\d+)?$/;
const LIMITS = Object.freeze({ zoom: [0, 20], lat: [-90, 90], lng: [-180, 180], bearing: [-360, 360], pitch: [0, 60] });

/** Decimals of latitude and longitude that still move the view by about a pixel at this zoom. */
function decimalsAt(zoom) {
  if (zoom < 3) return 2;
  if (zoom < 6) return 3;
  if (zoom < 10) return 4;
  return 5;
}

/** value with `digits` decimals, without "-0". */
function fixed(value, digits) {
  const written = value.toFixed(digits);
  return /^-0(?:\.0+)?$/.test(written) ? written.slice(1) : written;
}

/** value with at most `digits` decimals and no trailing zeros. */
function trimmed(value, digits) {
  return fixed(value, digits).replace(/(?:\.0+|(\.\d*?)0+)$/, "$1");
}

/**
 * "12.35/39.93337/32.85974", with "/bearing" when the map is turned and
 * "/bearing/pitch" when it is tilted.
 * @param {{ zoom: number, lat: number, lng: number, bearing?: number, pitch?: number }} view
 */
export function formatViewParam({ zoom, lat, lng, bearing = 0, pitch = 0 }) {
  const digits = decimalsAt(zoom);
  const parts = [trimmed(zoom, 2), fixed(lat, digits), fixed(lng, digits)];
  const tilted = Math.round(pitch) > 0;
  if (tilted || Math.abs(bearing) >= 0.05) parts.push(trimmed(bearing, 1));
  if (tilted) parts.push(String(Math.round(pitch)));
  return parts.join("/");
}

/**
 * The view a map= value names, or null when it is not one.
 * @param {string | null | undefined} value
 * @returns {{ zoom: number, lat: number, lng: number, bearing: number, pitch: number } | null}
 */
export function parseViewParam(value) {
  if (typeof value !== "string") return null;
  const parts = value.split("/");
  if (parts.length < 3 || parts.length > 5 || !parts.every((part) => NUMBER.test(part))) return null;
  const [zoom, lat, lng, bearing = 0, pitch = 0] = parts.map(Number);
  const view = { zoom, lat, lng, bearing, pitch };
  for (const [key, [low, high]] of Object.entries(LIMITS)) {
    if (!(view[key] >= low && view[key] <= high)) return null;
  }
  return view;
}

/** The view of a page's query string (location.search), or null. */
export function viewFromSearch(search) {
  return parseViewParam(new URLSearchParams(search).get("map"));
}

/** The query string with map= set to `param` (or removed for null), other parameters kept. */
export function searchWithView(search, param) {
  const params = new URLSearchParams(search);
  if (param == null) params.delete("map");
  else params.set("map", param);
  const query = params.toString().replace(/%2F/gi, "/");
  return query ? `?${query}` : "";
}
