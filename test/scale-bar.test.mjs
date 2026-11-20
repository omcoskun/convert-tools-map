// The scale bar's colours: the plate under the bar keeps its ink readable
// over any ground, dark or light, in each of the map's tones.

import assert from "node:assert/strict";
import test from "node:test";
import { SCALE_INKS, scaleInks } from "../src/map/scale.js";

/** [r, g, b, a] of "#rrggbb" or "rgba(r, g, b, a)". */
function rgba(color) {
  const hex = /^#([0-9a-f]{6})$/i.exec(color);
  if (hex) return [0, 2, 4].map((at) => parseInt(hex[1].slice(at, at + 2), 16)).concat(1);
  const match = /^rgba\((\d+), (\d+), (\d+), ([\d.]+)\)$/.exec(color);
  assert.ok(match, color);
  return match.slice(1).map(Number);
}

/** A colour with alpha laid over an opaque one. */
function over([r, g, b, a], [R, G, B]) {
  return [r * a + R * (1 - a), g * a + G * (1 - a), b * a + B * (1 - a)];
}

// WCAG 2.x relative luminance and contrast ratio.
function luminance(rgb) {
  const [r, g, b] = rgb.map((value) => {
    const c = value / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a, b) {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}

const BLACK = [0, 0, 0];
const WHITE = [255, 255, 255];

test("the scale bar's ink stays readable on its plate over black and over white ground", () => {
  for (const [tone, inks] of Object.entries(SCALE_INKS)) {
    const ink = rgba(inks.ink).slice(0, 3);
    for (const ground of [BLACK, WHITE]) {
      const plate = over(rgba(inks.plate), ground);
      assert.ok(contrast(ink, plate) >= 4.5, `${tone} over ${ground.join(",")}: ${contrast(ink, plate).toFixed(2)}`);
    }
  }
});

test("the scale bar's two segments differ clearly from each other", () => {
  for (const [tone, inks] of Object.entries(SCALE_INKS)) {
    assert.ok(contrast(rgba(inks.ink).slice(0, 3), rgba(inks.paper).slice(0, 3)) >= 7, tone);
  }
});

test("the light map gets dark ink; the dark map and the imagery get light ink", () => {
  assert.deepEqual(Object.keys(SCALE_INKS), ["light", "dark"]);
  assert.equal(scaleInks("light"), SCALE_INKS.light);
  assert.equal(scaleInks("dark"), SCALE_INKS.dark);
  assert.equal(scaleInks("imagery"), SCALE_INKS.dark);
  assert.equal(scaleInks(undefined), SCALE_INKS.light);
  for (const inks of Object.values(SCALE_INKS)) assert.deepEqual(Object.keys(inks), ["ink", "paper", "plate", "edge"]);
});
