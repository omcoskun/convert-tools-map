// Files dropped on the map or opened from the data panel, read in the
// browser and never sent anywhere: GeoJSON, GPX (waypoints, routes, tracks)
// and KML (placemarks with points, lines, polygons, multi-geometries and
// gx:Track). Every file becomes one GeoJSON FeatureCollection whose features
// keep only a name. Coordinates must be on the globe; a geometry with one
// that is not is left out. Altitudes are dropped: the map draws on the ground.

import { childrenOf, descendantsOf, firstChild, parseXml, textOf } from "./xml.js";

export const MAX_FEATURES = 50000;
const NAME_MAX = 200;

/** A file that cannot be shown. code: unreadable, notGeodata, unsupported, kmz, empty, tooMany. */
export class GeodataError extends Error {
  constructor(code) {
    super(code);
    this.name = "GeodataError";
    this.code = code;
  }
}

const isPosition = (value) =>
  Array.isArray(value) &&
  value.length >= 2 &&
  typeof value[0] === "number" &&
  typeof value[1] === "number" &&
  value[0] >= -180 &&
  value[0] <= 180 &&
  value[1] >= -90 &&
  value[1] <= 90;

/** [longitude, latitude] of a valid position, or null. */
const position = (value) => (isPosition(value) ? [value[0], value[1]] : null);

/** The positions of a line or ring, or null when one is invalid or there are fewer than `least`. */
function positions(values, least) {
  if (!Array.isArray(values) || values.length < least) return null;
  const out = [];
  for (const value of values) {
    const point = position(value);
    if (!point) return null;
    out.push(point);
  }
  return out;
}

function polygon(rings) {
  if (!Array.isArray(rings) || rings.length === 0) return null;
  const out = [];
  for (const ring of rings) {
    const cleaned = positions(ring, 4);
    if (!cleaned) return null;
    out.push(cleaned);
  }
  return out;
}

function every(values, clean) {
  if (!Array.isArray(values) || values.length === 0) return null;
  const out = [];
  for (const value of values) {
    const cleaned = clean(value);
    if (!cleaned) return null;
    out.push(cleaned);
  }
  return out;
}

/** The geometries a GeoJSON geometry stands for (a collection gives its members), cleaned. */
function cleanGeometry(geometry, depth = 0) {
  if (!geometry || typeof geometry !== "object") return [];
  const { type, coordinates } = geometry;
  let cleaned = null;
  switch (type) {
    case "Point":
      cleaned = position(coordinates);
      break;
    case "MultiPoint":
      cleaned = every(coordinates, position);
      break;
    case "LineString":
      cleaned = positions(coordinates, 2);
      break;
    case "MultiLineString":
      cleaned = every(coordinates, (line) => positions(line, 2));
      break;
    case "Polygon":
      cleaned = polygon(coordinates);
      break;
    case "MultiPolygon":
      cleaned = every(coordinates, polygon);
      break;
    case "GeometryCollection":
      return depth > 4 || !Array.isArray(geometry.geometries) ? [] : geometry.geometries.flatMap((member) => cleanGeometry(member, depth + 1));
    default:
      return [];
  }
  return cleaned ? [{ type, coordinates: cleaned }] : [];
}

function nameProperties(name) {
  if (typeof name !== "string") return {};
  const trimmed = name.trim();
  return trimmed ? { name: trimmed.slice(0, NAME_MAX) } : {};
}

const feature = (geometry, name, extra = {}) => ({ type: "Feature", properties: { ...nameProperties(name), ...extra }, geometry });

const NAME_KEYS = ["name", "title", "Name"];
const PROPERTY_MAX = 12;
const KEY_MAX = 60;
const VALUE_MAX = 200;

/**
 * A GeoJSON feature's plain properties besides its name, for its card: at most
 * PROPERTY_MAX finite numbers, booleans and non-empty texts (trimmed, cut to
 * VALUE_MAX), in their order. Nested values and over-long keys are left out.
 */
function plainProperties(properties, nameKey) {
  const kept = {};
  let count = 0;
  for (const [key, value] of Object.entries(properties)) {
    if (count >= PROPERTY_MAX) break;
    if (key === nameKey || key === "name" || key === "__proto__" || key.length > KEY_MAX) continue;
    let plain;
    if (typeof value === "number") plain = Number.isFinite(value) ? value : undefined;
    else if (typeof value === "boolean") plain = value;
    else if (typeof value === "string") plain = value.trim().slice(0, VALUE_MAX) || undefined;
    if (plain === undefined) continue;
    kept[key] = plain;
    count += 1;
  }
  return kept;
}

function readGeoJson(content) {
  let data;
  try {
    data = JSON.parse(content);
  } catch {
    throw new GeodataError("unreadable");
  }
  let entries;
  if (data?.type === "FeatureCollection" && Array.isArray(data.features)) entries = data.features;
  else if (data?.type === "Feature") entries = [data];
  else if (typeof data?.type === "string" && (data.coordinates || data.geometries)) entries = [{ type: "Feature", geometry: data }];
  else throw new GeodataError("notGeodata");
  if (entries.length > MAX_FEATURES) throw new GeodataError("tooMany");
  const features = [];
  for (const entry of entries) {
    const given = entry?.properties;
    const properties = given && typeof given === "object" && !Array.isArray(given) ? given : {};
    const nameKey = NAME_KEYS.find((key) => properties[key] != null);
    const name = nameKey ? properties[nameKey] : undefined;
    const extra = plainProperties(properties, nameKey);
    for (const geometry of cleanGeometry(entry?.geometry)) features.push(feature(geometry, name, extra));
  }
  return features;
}

const number = (value) => (typeof value === "string" && value.trim() !== "" ? Number(value) : Number.NaN);

/** A GPX point element's [lon, lat], or null. */
function gpxPoint(element) {
  return position([number(element.attrs.lon), number(element.attrs.lat)]);
}

function gpxLine(points) {
  const line = points.map(gpxPoint);
  return line.length >= 2 && line.every(Boolean) ? line : null;
}

function readGpx(root) {
  const features = [];
  const nameOf = (element) => textOf(firstChild(element, "name"));
  for (const point of childrenOf(root, "wpt")) {
    const at = gpxPoint(point);
    if (at) features.push(feature({ type: "Point", coordinates: at }, nameOf(point)));
  }
  for (const route of childrenOf(root, "rte")) {
    const line = gpxLine(childrenOf(route, "rtept"));
    if (line) features.push(feature({ type: "LineString", coordinates: line }, nameOf(route)));
  }
  for (const track of childrenOf(root, "trk")) {
    const segments = childrenOf(track, "trkseg").map((segment) => gpxLine(childrenOf(segment, "trkpt"))).filter(Boolean);
    if (segments.length === 1) features.push(feature({ type: "LineString", coordinates: segments[0] }, nameOf(track)));
    else if (segments.length > 1) features.push(feature({ type: "MultiLineString", coordinates: segments }, nameOf(track)));
  }
  return features;
}

/** The positions of a KML <coordinates> text: "lon,lat[,alt]" separated by white space. */
function kmlPositions(element) {
  const content = textOf(element).trim();
  if (!content) return [];
  return content.split(/\s+/).map((tuple) => position(tuple.split(",").map(number)));
}

function kmlLine(element, least) {
  const line = kmlPositions(firstChild(element, "coordinates"));
  return line.length >= least && line.every(Boolean) ? line : null;
}

function kmlGeometries(element, depth = 0) {
  const out = [];
  for (const child of element.children) {
    switch (child.local) {
      case "Point": {
        const [at] = kmlPositions(firstChild(child, "coordinates"));
        if (at) out.push({ type: "Point", coordinates: at });
        break;
      }
      case "LineString":
      case "LinearRing": {
        const line = kmlLine(child, 2);
        if (line) out.push({ type: "LineString", coordinates: line });
        break;
      }
      case "Polygon": {
        const outer = kmlLine(firstChild(firstChild(child, "outerBoundaryIs"), "LinearRing"), 4);
        if (!outer) break;
        const holes = childrenOf(child, "innerBoundaryIs").map((inner) => kmlLine(firstChild(inner, "LinearRing"), 4));
        out.push({ type: "Polygon", coordinates: [outer, ...holes.filter(Boolean)] });
        break;
      }
      case "Track": {
        const line = childrenOf(child, "coord").map((coord) => position(textOf(coord).trim().split(/\s+/).map(number)));
        if (line.length >= 2 && line.every(Boolean)) out.push({ type: "LineString", coordinates: line });
        break;
      }
      case "MultiGeometry":
      case "MultiTrack":
        if (depth < 4) out.push(...kmlGeometries(child, depth + 1));
        break;
      default:
        break;
    }
  }
  return out;
}

function readKml(root) {
  const features = [];
  for (const placemark of descendantsOf(root, "Placemark")) {
    const name = textOf(firstChild(placemark, "name"));
    for (const geometry of kmlGeometries(placemark)) features.push(feature(geometry, name));
  }
  return features;
}

const KINDS = Object.freeze({ geojson: "geojson", json: "geojson", gpx: "gpx", kml: "kml" });

function countsOf(features) {
  const counts = { points: 0, lines: 0, areas: 0 };
  for (const { geometry } of features) {
    if (geometry.type.endsWith("Point")) counts.points += 1;
    else if (geometry.type.endsWith("LineString")) counts.lines += 1;
    else counts.areas += 1;
  }
  return counts;
}

/**
 * A file's features, told GeoJSON, GPX or KML by its extension or, without
 * a known one, by its content.
 * @param {string} fileName
 * @param {string} content
 * @returns {{ type: "FeatureCollection", features: object[], counts: { points: number, lines: number, areas: number } }}
 * @throws {GeodataError}
 */
export function readGeodata(fileName, content) {
  const extension = /\.([A-Za-z0-9]+)$/.exec(fileName)?.[1]?.toLowerCase();
  if (extension === "kmz") throw new GeodataError("kmz");
  let kind = KINDS[extension];
  if (!kind) {
    const start = content.trimStart();
    if (start.startsWith("{")) kind = "geojson";
    else if (start.startsWith("<")) kind = "xml";
    else throw new GeodataError("unsupported");
  }
  let features;
  if (kind === "geojson") {
    features = readGeoJson(content);
  } else {
    let root;
    try {
      root = parseXml(content);
    } catch {
      throw new GeodataError("unreadable");
    }
    if (root.local === "gpx") features = readGpx(root);
    else if (root.local === "kml") features = readKml(root);
    else throw new GeodataError(kind === "xml" ? "unsupported" : "notGeodata");
  }
  if (features.length > MAX_FEATURES) throw new GeodataError("tooMany");
  if (features.length === 0) throw new GeodataError("empty");
  return { type: "FeatureCollection", features, counts: countsOf(features) };
}

/** [[west, south], [east, north]] of every coordinate of the features. */
export function geodataBounds(features) {
  let west = Infinity;
  let south = Infinity;
  let east = -Infinity;
  let north = -Infinity;
  const visit = (value) => {
    if (typeof value[0] === "number") {
      west = Math.min(west, value[0]);
      east = Math.max(east, value[0]);
      south = Math.min(south, value[1]);
      north = Math.max(north, value[1]);
    } else {
      for (const inner of value) visit(inner);
    }
  };
  for (const { geometry } of features) visit(geometry.coordinates);
  return Number.isFinite(west) ? [[west, south], [east, north]] : null;
}

/** The bounds that hold every one of these bounds (null ones left out), or null. */
export function unionBounds(list) {
  const present = list.filter(Boolean);
  if (present.length === 0) return null;
  return [
    [Math.min(...present.map(([[west]]) => west)), Math.min(...present.map(([[, south]]) => south))],
    [Math.max(...present.map(([, [east]]) => east)), Math.max(...present.map(([, [, north]]) => north))],
  ];
}
