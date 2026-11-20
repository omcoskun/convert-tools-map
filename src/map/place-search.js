// The place search's pure logic: a typed query, the Nominatim request URL,
// the answer read into places with their names, details, points and bounds,
// a coordinate pair understood without a request, and the search queue that
// keeps requests a second apart, one at a time, and caches their answers.

import { readCoordinatePair } from "../lib/coordinate-paste.js";

/** The longest query sent to the search. */
export const MAX_QUERY = 200;

/**
 * @typedef {{
 *   id: string,
 *   name: string,
 *   detail: string,
 *   lat: number,
 *   lng: number,
 *   bounds: [[number, number], [number, number]] | null,
 * }} Place
 *   bounds: [[west, south], [east, north]], or null when the answer has no
 *   usable box.
 */

/**
 * The query as it is sent: trimmed, every run of whitespace one space, cut to
 * MAX_QUERY; "" for anything that is not a string.
 * @param {unknown} value
 * @returns {string}
 */
export function cleanQuery(value) {
  if (typeof value !== "string") return "";
  return value.trim().replace(/\s+/g, " ").slice(0, MAX_QUERY);
}

/**
 * Nominatim's search URL for a query: JSON v2, in the page's language, as
 * many results as the config asks for.
 * @param {{ url: string, limit?: number }} search
 * @param {string} query
 * @param {string} language
 * @returns {string}
 */
export function searchUrl(search, query, language) {
  const params = new URLSearchParams({
    q: query,
    format: "jsonv2",
    limit: String(search.limit ?? 8),
    "accept-language": language,
  });
  return `${search.url}?${params}`;
}

/**
 * The bounds of a Nominatim result: [[west, south], [east, north]] from its
 * boundingbox ([south, north, west, east]), or null when the box is unusable.
 * A box across the antimeridian has west > east; the point is enough then.
 * @param {unknown} box
 * @returns {[[number, number], [number, number]] | null}
 */
function boundsOf(box) {
  if (!Array.isArray(box) || box.length !== 4) return null;
  const [south, north, west, east] = box.map(Number);
  if (![south, north, west, east].every(Number.isFinite) || south > north || west > east) return null;
  return [[west, south], [east, north]];
}

/**
 * Nominatim's answer as places. An entry needs a valid point and a name; the
 * name is its own or the start of its display name, the detail the rest of
 * the display name. At most `limit` places.
 * @param {unknown} json
 * @param {number} [limit]
 * @returns {Place[]}
 */
export function parsePlaces(json, limit = 8) {
  if (!Array.isArray(json)) return [];
  const places = [];
  for (const entry of json) {
    if (places.length >= limit) break;
    if (entry == null || typeof entry !== "object") continue;
    const lat = Number(entry.lat);
    const lng = Number(entry.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) continue;
    const display = String(entry.display_name ?? "").trim();
    const given = String(entry.name ?? "").trim();
    const name = given || display.split(", ")[0];
    if (name === "") continue;
    let detail = display;
    if (display.startsWith(`${name}, `)) detail = display.slice(name.length + 2);
    else if (display === name) detail = "";
    places.push({
      id: entry.place_id != null ? String(entry.place_id) : `${entry.osm_type}${entry.osm_id}`,
      name,
      detail,
      lat,
      lng,
      bounds: boundsOf(entry.boundingbox),
    });
  }
  return places;
}

/**
 * A typed coordinate pair as a place of its own, found without a request;
 * null when the text is not one pair.
 * @param {string} query
 * @returns {Place | null}
 */
export function coordinatePlace(query) {
  const pair = readCoordinatePair(query);
  if (pair == null) return null;
  return {
    id: "coordinate",
    name: cleanQuery(query),
    detail: "",
    lat: Number(pair.latitude),
    lng: Number(pair.longitude),
    bounds: null,
  };
}

/**
 * The shared search queue: requests go out one at a time, at least
 * minIntervalMs apart, and answers are cached (the newest cacheSize searches).
 * @param {{
 *   fetchJson: (url: string) => Promise<unknown>,
 *   now?: () => number,
 *   wait?: (ms: number) => Promise<void>,
 *   minIntervalMs?: number,
 *   cacheSize?: number,
 * }} options
 * @returns {{ search: (url: string) => Promise<unknown> }}
 */
export function createPlaceSearch({
  fetchJson,
  now = () => Date.now(),
  wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  minIntervalMs = 1000,
  cacheSize = 50,
}) {
  const cache = new Map();
  let last = -Infinity;
  let chain = Promise.resolve();

  async function run(url) {
    if (cache.has(url)) {
      const answer = cache.get(url);
      cache.delete(url);
      cache.set(url, answer);
      return answer;
    }
    const gap = last + minIntervalMs - now();
    if (gap > 0) await wait(gap);
    last = now();
    const answer = await fetchJson(url);
    cache.set(url, answer);
    while (cache.size > cacheSize) cache.delete(cache.keys().next().value);
    return answer;
  }

  function search(url) {
    const task = chain.then(() => run(url));
    chain = task.catch(() => {});
    return task;
  }

  return { search };
}
