// src/map/elevation.js: the approximate elevation of a point, read from one
// pixel of a Terrarium tile. Tiles are loaded through an injected loader.

import assert from "node:assert/strict";
import test from "node:test";
import { ELEVATION_ZOOM, createElevationReader } from "../src/map/elevation.js";
import { demPixel } from "../src/map/terrain.js";

const TERRAIN = Object.freeze({
  tiles: "https://dem.example/terrarium/{z}/{x}/{y}.png",
  encoding: "terrarium",
  tileSize: 256,
  maxzoom: 15,
});

/** A tile whose every pixel is (128, 0, 0), 0 m, except one pixel. */
function tileWith(column, row, [red, green, blue], size = 256) {
  const data = new Uint8ClampedArray(size * size * 4);
  for (let index = 0; index < data.length; index += 4) {
    data[index] = 128;
    data[index + 3] = 255;
  }
  const at = (row * size + column) * 4;
  data[at] = red;
  data[at + 1] = green;
  data[at + 2] = blue;
  return { width: size, height: size, data };
}

const ANKARA = Object.freeze({ latitude: 39.933365, longitude: 32.859742 });

test("the reader loads the tile under the point at the reading zoom and decodes its pixel", async () => {
  const zoom = Math.min(ELEVATION_ZOOM, TERRAIN.maxzoom);
  const { x, y, column, row } = demPixel(ANKARA.latitude, ANKARA.longitude, zoom);
  const urls = [];
  const read = createElevationReader(TERRAIN, {
    load: async (url) => {
      urls.push(url);
      return tileWith(column, row, [131, 82, 128]);
    },
  });
  assert.equal(await read(ANKARA.latitude, ANKARA.longitude), 850.5);
  assert.deepEqual(urls, [`https://dem.example/terrarium/${zoom}/${x}/${y}.png`]);
});

test("the reading zoom never passes the tiles' maxzoom", async () => {
  const urls = [];
  const read = createElevationReader({ ...TERRAIN, maxzoom: 9 }, {
    load: async (url) => {
      urls.push(url);
      return tileWith(0, 0, [128, 0, 0]);
    },
  });
  await read(0, 0);
  assert.match(urls[0], /\/terrarium\/9\//);
});

test("points on one tile load it once", async () => {
  let loads = 0;
  const read = createElevationReader(TERRAIN, {
    load: async () => {
      loads += 1;
      return tileWith(0, 0, [128, 0, 0]);
    },
  });
  await Promise.all([read(ANKARA.latitude, ANKARA.longitude), read(ANKARA.latitude + 0.0001, ANKARA.longitude)]);
  assert.equal(loads, 1);
});

test("a tile that fails gives no elevation and is tried again next time", async () => {
  let loads = 0;
  const read = createElevationReader(TERRAIN, {
    load: async () => {
      loads += 1;
      if (loads === 1) throw new Error("offline");
      return tileWith(0, 0, [128, 0, 0]);
    },
  });
  assert.equal(await read(0, 0), null);
  assert.equal(typeof (await read(0, 0)), "number");
  assert.equal(loads, 2);
});

test("a tile of the wrong size or a point that is not a number gives no elevation", async () => {
  const read = createElevationReader(TERRAIN, { load: async () => tileWith(0, 0, [128, 0, 0], 16) });
  assert.equal(await read(0, 0), null);
  const fine = createElevationReader(TERRAIN, { load: async () => tileWith(0, 0, [128, 0, 0]) });
  assert.equal(await fine(Number.NaN, 0), null);
});
