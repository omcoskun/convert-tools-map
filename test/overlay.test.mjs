// Where an image laid over the map first goes, and the size it is drawn at.

import assert from "node:assert/strict";
import test from "node:test";
import { downscaledSize, overlayRect } from "../src/map/overlay.js";

const NO_PADDING = { top: 0, right: 0, bottom: 0, left: 0 };

test("a new image fills 60 % of the free view, in its own proportions, centred", () => {
  assert.deepEqual(overlayRect({ width: 1000, height: 600, padding: NO_PADDING }, { width: 2000, height: 1000 }), { left: 200, top: 150, right: 800, bottom: 450 });
  assert.deepEqual(overlayRect({ width: 1000, height: 600, padding: NO_PADDING }, { width: 500, height: 1000 }), { left: 410, top: 120, right: 590, bottom: 480 });
});

test("the free view is what the widgets leave of the map", () => {
  const rect = overlayRect({ width: 1400, height: 800, padding: { top: 100, right: 0, bottom: 100, left: 400 } }, { width: 1000, height: 1000 });
  assert.deepEqual(rect, { left: 720, top: 220, right: 1080, bottom: 580 });
});

test("an image is drawn at most 4096 px on its longer side", () => {
  assert.deepEqual(downscaledSize(8000, 4000), { width: 4096, height: 2048 });
  assert.deepEqual(downscaledSize(4096, 8192), { width: 2048, height: 4096 });
  assert.deepEqual(downscaledSize(1000, 500), { width: 1000, height: 500 });
  assert.deepEqual(downscaledSize(3, 9001), { width: 1, height: 4096 });
});
