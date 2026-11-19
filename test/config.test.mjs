// public/config.json: every value the demo starts with or offers as an
// example must run through the core without an error.

import assert from "node:assert/strict";
import test from "node:test";
import { convertLength, coordinateResults, transformCrs } from "@omcoskun/convert-tools";
import { validateRuntime } from "../src/runtime.js";
import { readPointText } from "../src/lib/point-text.js";
import { checkModel, modelOptions, runDirect, runInverse, runRoute } from "../src/tools/measure/measure.js";
import { INPUT_FORMATS, readPoint } from "../src/tools/positions/positions.js";
import { readJson } from "./support/files.mjs";

const config = readJson("public/config.json");
const lang = readJson("public/lang.json");

test("config.json and lang.json pass the start-up validation", () => {
  assert.doesNotThrow(() => validateRuntime(config, lang));
});

test("length precisions are 24 by default and at most 60; examples convert at both precisions", () => {
  const { defaultPrecision, maxPrecision, examplePrecision, examples } = config.length;
  assert.equal(defaultPrecision, 24);
  assert.equal(maxPrecision, 60);
  assert.ok(examplePrecision >= 0 && examplePrecision <= maxPrecision);
  assert.ok(examples.length > 0);
  for (const example of examples) {
    for (const digits of [defaultPrecision, examplePrecision]) {
      const result = convertLength(example.value, example.from, example.to, digits);
      assert.equal(typeof result.value, "string", `${example.value} ${example.from} -> ${example.to}`);
    }
  }
});

test("the initial position values parse in every input format", () => {
  const { initial } = config.position;
  assert.ok(INPUT_FORMATS.some((format) => format.id === initial.format));
  for (const format of INPUT_FORMATS) {
    const point = readPoint(format.id, initial.values);
    assert.ok(Number.isFinite(point.latitude) && Number.isFinite(point.longitude), format.id);
  }
});

test("MGRS precisions are 0..5 and each label names the MGRS cell size", () => {
  const { precisions, initial } = config.position;
  assert.deepEqual(
    precisions.map((item) => item.digits).sort((a, b) => a - b),
    [0, 1, 2, 3, 4, 5],
  );
  assert.ok(precisions.some((item) => item.digits === initial.precision));
  const point = readPoint(initial.format, initial.values);
  for (const { digits, label } of precisions) {
    // MGRS with d digits per axis has 10^(5 - d) metre cells.
    const cellMetres = 10 ** (5 - digits);
    const expected = cellMetres >= 1000 ? `${cellMetres / 1000} km` : `${cellMetres} m`;
    assert.equal(label, expected, `digits ${digits}`);
    assert.equal(coordinateResults(point, digits).resolution.mgrs.cellMetres, cellMetres);
  }
});

test("position examples parse and produce every output at every precision", () => {
  const { initial, examples, precisions } = config.position;
  for (const example of examples) {
    const point = readPoint(example.format, { ...initial.values, ...example.values });
    for (const { digits } of precisions) {
      const results = coordinateResults(point, digits);
      for (const key of ["dd", "dms", "ddm", "mgrs", "utmUps", "gars", "georef"]) {
        assert.equal(typeof results[key], "string", `${example.id} ${key} p${digits}`);
      }
    }
  }
});

test("CRS initial request and examples transform", () => {
  for (const request of [config.crs.initial, ...config.crs.examples]) {
    const result = transformCrs(request.source, request.target, request.x, request.y);
    assert.ok(Number.isFinite(result.x) && Number.isFinite(result.y), `${request.source} -> ${request.target}`);
  }
});

test("measure examples run in their mode within the configured sampling limits", () => {
  const { path: pathOptions, examples, route } = config.measure;
  const modes = new Set();
  for (const example of examples) {
    modes.add(example.mode);
    const points = example.points.map((text) => {
      const reading = readPointText(text);
      assert.equal(reading.status, "valid", `${example.id}: ${text}`);
      return { latitude: reading.latitude, longitude: reading.longitude };
    });
    let result;
    if (example.mode === "inverse") {
      assert.equal(points.length, 2, example.id);
      result = runInverse(points, {}, pathOptions);
      // At most three decimals (millimetres); the core drops trailing zeros.
      assert.match(result.value.lengths.metre, /^\d+(\.\d{1,3})?$/, example.id);
    } else if (example.mode === "direct") {
      assert.equal(points.length, 1, example.id);
      const { azimuth, distance, unit } = example;
      result = runDirect({ start: points[0], azimuth, distance, unit }, {}, pathOptions);
    } else {
      assert.equal(example.mode, "route", example.id);
      assert.ok(points.length >= 2 && points.length <= route.maxPoints, example.id);
      result = runRoute(points, {}, pathOptions);
    }
    assert.equal(result.ok, true, example.id);
    for (const line of result.value.lines) {
      assert.ok(line.points.length >= 2 && line.points.length <= pathOptions.maxPoints, example.id);
    }
  }
  assert.deepEqual([...modes].sort(), ["direct", "inverse", "route"], "every mode has an example");
});

test("the measure models are WGS 84, GRS 80, the sphere and a custom one; the route cap is 50", () => {
  const { models, route } = config.measure;
  assert.deepEqual(
    models.map((model) => model.id),
    ["wgs84", "grs80", "sphere", "custom"],
  );
  for (const model of models.filter(({ id }) => id !== "custom")) {
    assert.deepEqual(checkModel(modelOptions(model)), { ok: true }, model.id);
  }
  assert.equal(route.maxPoints, 50);
});

test("the comparison sphere has a plausible Earth radius in metres", () => {
  const radius = config.measure.comparisonSphereRadiusMetres;
  assert.equal(typeof radius, "number");
  // Between the polar and equatorial semi-axes of WGS 84, both included
  // (some web maps use the equatorial radius 6378137 m).
  assert.ok(radius >= 6356752.314245 && radius <= 6378137, String(radius));
});

test("the basemaps are https styles with structured attributions; the satellite is EOX 2025 imagery with a night side", () => {
  assert.deepEqual(Object.keys(config.map).sort(), ["basemaps", "defaultBasemap", "earthquakes", "terrain"]);
  const ids = config.map.basemaps.map((basemap) => basemap.id);
  assert.deepEqual(ids, ["standard", "detailed", "satellite"]);
  assert.ok(ids.includes(config.map.defaultBasemap));
  for (const basemap of config.map.basemaps) {
    for (const key of ["style", "darkStyle"]) {
      if (basemap[key] === undefined) continue;
      assert.equal(new URL(basemap[key]).protocol, "https:", `${basemap.id}.${key}`);
    }
    assert.ok(basemap.attribution.length > 0, basemap.id);
    // The credits are keyed by their link (Attribution.jsx).
    const links = basemap.attribution.map(({ href }) => href);
    assert.equal(new Set(links).size, links.length, `${basemap.id}: one credit per link`);
    for (const { text, href } of basemap.attribution) {
      assert.equal(typeof text, "string");
      assert.equal(new URL(href).protocol, "https:", text);
    }
    // OpenStreetMap data needs its credit wherever its tiles are drawn.
    assert.ok(basemap.attribution.some(({ href }) => href === "https://www.openstreetmap.org/copyright"), basemap.id);
  }
  const satellite = config.map.basemaps.find((basemap) => basemap.id === "satellite");
  // The 2025 layer covers every land tile (the 2017 one is white off Europe);
  // it is CC BY-NC-SA 4.0, which this non-commercial site may use.
  assert.match(satellite.raster.tiles, /^https:\/\/tiles\.maps\.eox\.at\/.*s2cloudless-2025_3857\/.*\{z\}\/\{y\}\/\{x\}/);
  assert.ok(satellite.attribution.some(({ text }) => /EOX/.test(text) && /2025/.test(text) && /CC BY-NC-SA 4\.0/.test(text)));
  // The coarse fallback under it is NASA GIBS Blue Marble (public domain), credited.
  assert.match(satellite.raster.fallback.tiles, /^https:\/\/gibs\.earthdata\.nasa\.gov\/.*BlueMarble.*\{z\}\/\{y\}\/\{x\}/);
  assert.equal(satellite.raster.fallback.maxzoom, 8);
  assert.ok(satellite.attribution.some(({ text }) => /NASA/.test(text)));
  // The night side's lights: NASA GIBS Black Marble (public domain), credited.
  assert.match(satellite.night.lights, /^https:\/\/gibs\.earthdata\.nasa\.gov\/.*VIIRS_Black_Marble.*\{z\}\/\{y\}\/\{x\}/);
  assert.ok(Number.isInteger(satellite.night.zoom) && satellite.night.zoom >= 2 && satellite.night.zoom <= 4);
  assert.ok(satellite.attribution.some(({ text }) => /Black Marble/.test(text)));
  // Continent names sit on these points (names in lang.json).
  assert.deepEqual(satellite.continents.map(({ id }) => id), ["northAmerica", "southAmerica", "europe", "africa", "asia", "oceania", "antarctica"]);
  for (const { latitude, longitude } of satellite.continents) {
    assert.ok(Math.abs(latitude) <= 85 && Math.abs(longitude) <= 180);
  }
  // Esri imagery needs a licence.
  assert.doesNotMatch(JSON.stringify(config), /arcgis/i);
});

test("the satellite's close-up imagery is MapTiler's, its key added at build time, with logo and credit", () => {
  const satellite = config.map.basemaps.find((basemap) => basemap.id === "satellite");
  const { detail } = satellite.raster;
  // The Tiles API's TileJSON (free plan, no card); {key} is filled in from MAPTILER_KEY.
  // satellite-v2 is the tileset the site's key serves (satellite-v4 answers 404);
  // its tiles are 512 px JPEGs up to zoom 22 (checked on the live site).
  assert.equal(detail.url, "https://api.maptiler.com/tiles/satellite-v2/tiles.json?key={key}");
  assert.equal(detail.tileSize, 512);
  // Above EOX only where EOX runs out of detail.
  assert.equal(detail.minzoom, 13);
  assert.ok(detail.minzoom <= satellite.raster.maxzoom);
  // The free plan asks for the logo, linking to MapTiler, and the text credit.
  assert.deepEqual(detail.logo, { src: "https://api.maptiler.com/resources/logo.svg", href: "https://www.maptiler.com" });
  assert.deepEqual(detail.attribution, [{ text: "© MapTiler", href: "https://www.maptiler.com/copyright/" }]);
  // No key is ever written into the repository.
  assert.doesNotMatch(JSON.stringify(config), /key=(?!\{key\})/);
});

test("credits carry the zooms their sources are drawn at: Natural Earth below 7, NASA below 8", () => {
  const credit = (id, pattern) => config.map.basemaps.find((basemap) => basemap.id === id).attribution.find(({ text }) => pattern.test(text));
  // OpenFreeMap's Liberty style draws its Natural Earth relief up to zoom 7.
  assert.equal(credit("detailed", /Natural Earth/).maxzoom, 7);
  // Blue Marble's own tiles end at 8 (above it is only the stretched fallback);
  // the night side's Black Marble is gone by zoom 6.
  assert.equal(credit("satellite", /NASA/).maxzoom, 8);
  for (const basemap of config.map.basemaps) {
    for (const { text, minzoom, maxzoom } of basemap.attribution) {
      if (minzoom !== undefined) assert.ok(Number.isFinite(minzoom), text);
      if (maxzoom !== undefined) assert.ok(Number.isFinite(maxzoom), text);
    }
    // OpenStreetMap and the imagery are credited at every zoom.
    for (const pattern of [/OpenStreetMap/, /EOX/]) {
      const always = basemap.attribution.find(({ text }) => pattern.test(text));
      if (always) assert.equal(always.minzoom ?? always.maxzoom, undefined, `${basemap.id}: ${always.text}`);
    }
  }
});

test("the terrain is the free Terrarium elevation tiles from their own bucket, with their credit", () => {
  const { terrain } = config.map;
  // AWS Open Data: no key, no account, no card. The bucket's own host keeps
  // the CSP to this one bucket rather than all of s3.amazonaws.com.
  assert.equal(terrain.tiles, "https://elevation-tiles-prod.s3.amazonaws.com/terrarium/{z}/{x}/{y}.png");
  assert.equal(terrain.encoding, "terrarium");
  assert.equal(terrain.tileSize, 256);
  assert.equal(terrain.maxzoom, 15);
  assert.ok(terrain.attribution.length > 0);
  for (const { text, href } of terrain.attribution) {
    assert.equal(typeof text, "string");
    assert.equal(new URL(href).protocol, "https:", text);
  }
  // The tiles' required attribution lists many sources; the credit names the
  // main ones and links to the whole list.
  const credit = terrain.attribution.find(({ href }) => href === "https://github.com/tilezen/joerd/blob/master/docs/attribution.md");
  assert.ok(credit);
  assert.match(credit.text, /Mapzen/);
  assert.match(credit.text, /USGS/);
  assert.match(credit.text, /EU-DEM/);
  // Short enough for the credits strip; the full list is behind the link.
  assert.ok(credit.text.length <= 50, credit.text);
});

test("the earthquakes are the USGS feed of the past week's M2.5+ events, with its credit", () => {
  const { earthquakes } = config.map;
  // USGS data is public domain; the feed needs no key and allows any origin.
  assert.equal(earthquakes.data, "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_week.geojson");
  assert.deepEqual(Object.keys(earthquakes).sort(), ["attribution", "data"]);
  assert.ok(earthquakes.attribution.length > 0);
  for (const { text, href } of earthquakes.attribution) {
    assert.equal(typeof text, "string");
    assert.equal(new URL(href).protocol, "https:", text);
  }
  assert.ok(earthquakes.attribution.some(({ text }) => /USGS/.test(text)));
});
