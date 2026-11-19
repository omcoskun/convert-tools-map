// src/map/credits.js: which credits the (i) list shows at a zoom.

import assert from "node:assert/strict";
import test from "node:test";
import { basemapCredits, creditsAt } from "../src/map/credits.js";

const ALWAYS = Object.freeze({ text: "Always", href: "https://always.example/" });
const COARSE = Object.freeze({ text: "Coarse", href: "https://coarse.example/", maxzoom: 8 });
const CLOSE = Object.freeze({ text: "Close", href: "https://close.example/", minzoom: 13 });

test("a credit shows only at the zooms its source is drawn, like a layer's minzoom and maxzoom", () => {
  const credits = [ALWAYS, COARSE, CLOSE];
  assert.deepEqual(creditsAt(credits, 0), [ALWAYS, COARSE]);
  assert.deepEqual(creditsAt(credits, 7.99), [ALWAYS, COARSE]);
  // maxzoom is exclusive, minzoom inclusive.
  assert.deepEqual(creditsAt(credits, 8), [ALWAYS]);
  assert.deepEqual(creditsAt(credits, 12.99), [ALWAYS]);
  assert.deepEqual(creditsAt(credits, 13), [ALWAYS, CLOSE]);
  assert.deepEqual(creditsAt(credits, 22), [ALWAYS, CLOSE]);
  assert.deepEqual(creditsAt([], 5), []);
});

test("the close-up imagery's credits join the basemap's from its first zoom, only while it is used", () => {
  const maptiler = { text: "© MapTiler", href: "https://maptiler.example/copyright/" };
  const satellite = { attribution: [ALWAYS, COARSE], raster: { detail: { minzoom: 13, attribution: [maptiler] } } };
  assert.deepEqual(basemapCredits(satellite, { detail: false }), [ALWAYS, COARSE]);
  assert.deepEqual(basemapCredits(satellite, { detail: true }), [ALWAYS, COARSE, { ...maptiler, minzoom: 13 }]);
  assert.deepEqual(basemapCredits({ attribution: [ALWAYS] }, { detail: true }), [ALWAYS]);
  assert.deepEqual(basemapCredits(undefined, { detail: true }), []);
  assert.deepEqual(satellite.raster.detail.attribution, [maptiler], "the config is not changed");
});
