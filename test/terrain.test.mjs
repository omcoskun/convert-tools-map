// src/map/terrain.js: the elevation source, the hillshade layer and where it
// goes, the 3D terrain, the credits, and Terrarium tile arithmetic.

import assert from "node:assert/strict";
import test from "node:test";
import {
  EXAGGERATIONS,
  HILLSHADE_LAYER,
  HILLSHADE_SOURCE,
  TERRAIN_SOURCE,
  demPixel,
  demSource,
  hillshadeBeforeId,
  hillshadeLayer,
  isDemSource,
  terrainCredits,
  terrainSpec,
  terrariumElevation,
} from "../src/map/terrain.js";

const TERRAIN = Object.freeze({
  tiles: "https://dem.example/terrarium/{z}/{x}/{y}.png",
  encoding: "terrarium",
  tileSize: 256,
  maxzoom: 15,
  attribution: [{ text: "Terrain Tiles", href: "https://dem.example/credits" }],
});

test("the elevation source is a raster-dem source of the configured tiles, without the credits", () => {
  assert.deepEqual(demSource(TERRAIN), {
    type: "raster-dem",
    tiles: ["https://dem.example/terrarium/{z}/{x}/{y}.png"],
    tileSize: 256,
    maxzoom: 15,
    encoding: "terrarium",
  });
});

test("only the two elevation sources count as elevation sources", () => {
  assert.equal(isDemSource(TERRAIN_SOURCE), true);
  assert.equal(isDemSource(HILLSHADE_SOURCE), true);
  assert.equal(isDemSource("openmaptiles"), false);
  assert.equal(isDemSource(undefined), false);
});

test("the 3D terrain uses its own source and one of the offered exaggerations, else 1", () => {
  assert.deepEqual(EXAGGERATIONS, [1, 1.5, 2]);
  assert.deepEqual(terrainSpec(1.5), { source: TERRAIN_SOURCE, exaggeration: 1.5 });
  assert.deepEqual(terrainSpec(7), { source: TERRAIN_SOURCE, exaggeration: 1 });
  assert.deepEqual(terrainSpec(undefined), { source: TERRAIN_SOURCE, exaggeration: 1 });
});

test("the hillshade layer reads its own source and shades photographs more lightly than drawn maps", () => {
  for (const tone of ["light", "dark", "imagery"]) {
    const layer = hillshadeLayer(tone);
    assert.equal(layer.id, HILLSHADE_LAYER);
    assert.equal(layer.type, "hillshade");
    assert.equal(layer.source, HILLSHADE_SOURCE);
    const strength = layer.paint["hillshade-exaggeration"];
    assert.ok(strength > 0 && strength <= 1, `${tone}: ${strength}`);
    for (const key of ["hillshade-shadow-color", "hillshade-highlight-color", "hillshade-accent-color"]) {
      assert.equal(typeof layer.paint[key], "string", `${tone} ${key}`);
    }
  }
  assert.ok(hillshadeLayer("imagery").paint["hillshade-exaggeration"] < hillshadeLayer("light").paint["hillshade-exaggeration"]);
  assert.deepEqual(hillshadeLayer("unknown"), hillshadeLayer("light"));
});

test("the hillshade goes over land, water and imagery but under roads, buildings, boundaries, names and the app's lines", () => {
  const vector = [
    { id: "background", type: "background" },
    { id: "water", type: "fill", "source-layer": "water" },
    { id: "landcover_wood", type: "fill", "source-layer": "landcover" },
    { id: "waterway", type: "line", "source-layer": "waterway" },
    { id: "highway_minor", type: "line", "source-layer": "transportation" },
    { id: "building", type: "fill", "source-layer": "building" },
    { id: "place_city", type: "symbol", "source-layer": "place" },
  ];
  assert.equal(hillshadeBeforeId(vector), "highway_minor");
  const satellite = [
    { id: "background", type: "background" },
    { id: "convert-satellite", type: "raster", source: "convert-satellite" },
    { id: "convert-night", type: "raster", source: "convert-night" },
    { id: "boundary_2", type: "line", "source-layer": "boundary" },
    { id: "place_city", type: "symbol", "source-layer": "place" },
  ];
  assert.equal(hillshadeBeforeId(satellite), "boundary_2");
  const onlyApp = [
    { id: "background", type: "background" },
    { id: "convert-line-casing", type: "line", source: "convert-lines" },
  ];
  assert.equal(hillshadeBeforeId(onlyApp), "convert-line-casing");
  assert.equal(hillshadeBeforeId([{ id: "background", type: "background" }]), undefined);
  assert.equal(hillshadeBeforeId(undefined), undefined);
});

test("the elevation credits join the basemap's while relief or 3D terrain is shown, once per link", () => {
  const basemap = [{ text: "© OpenStreetMap", href: "https://www.openstreetmap.org/copyright" }];
  assert.deepEqual(terrainCredits(basemap, TERRAIN, false), basemap);
  assert.deepEqual(terrainCredits(basemap, null, true), basemap);
  assert.deepEqual(terrainCredits(basemap, TERRAIN, true), [...basemap, TERRAIN.attribution[0]]);
  assert.deepEqual(terrainCredits(TERRAIN.attribution, TERRAIN, true), TERRAIN.attribution);
});

test("a Terrarium pixel is (red × 256 + green + blue / 256) − 32768 metres", () => {
  assert.equal(terrariumElevation(128, 0, 0), 0);
  assert.equal(terrariumElevation(0, 0, 0), -32768);
  assert.equal(terrariumElevation(131, 82, 128), 850.5);
});

test("a point falls in the Web Mercator tile and pixel that cover it", () => {
  assert.deepEqual(demPixel(0, 0, 0), { x: 0, y: 0, column: 128, row: 128 });
  assert.deepEqual(demPixel(0, 90, 1), { x: 1, y: 1, column: 128, row: 0 });
  // The top-left corner of the world, and latitudes past the Mercator edge.
  assert.deepEqual(demPixel(85.0511287798066, -180, 3), { x: 0, y: 0, column: 0, row: 0 });
  assert.deepEqual(demPixel(89.9, -180, 3), { x: 0, y: 0, column: 0, row: 0 });
  assert.deepEqual(demPixel(-89.9, 179.999999, 1), { x: 1, y: 1, column: 255, row: 255 });
  // 180° is the same meridian as −180°.
  assert.deepEqual(demPixel(0, 180, 2), demPixel(0, -180, 2));
  // Another tile size.
  assert.deepEqual(demPixel(0, 0, 0, 512), { x: 0, y: 0, column: 256, row: 256 });
});
