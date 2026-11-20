// The layers of an imported data file, the features a pointer can hit and
// the summary its card shows.

import assert from "node:assert/strict";
import test from "node:test";
import { HIT_SUFFIXES, IMPORT_PREFIX, LAYER_SUFFIXES, featureSummary, fileLayers, fileSource, hitLayerIds } from "../src/map/import-layers.js";

const HOVER = ["boolean", ["feature-state", "hover"], false];
const FILE = { id: `${IMPORT_PREFIX}3`, color: "#0891b2" };
const FONT = ["Noto Sans Regular"];

test("each file draws its areas, lines and points in its colour, wider while hovered", () => {
  assert.equal(IMPORT_PREFIX, "convert-import-");
  assert.deepEqual(LAYER_SUFFIXES, ["fill", "outline", "casing", "line", "point", "label"]);
  const layers = fileLayers(FILE, FONT);
  assert.deepEqual(layers.map((layer) => layer.id), LAYER_SUFFIXES.map((suffix) => `${FILE.id}-${suffix}`));
  for (const layer of layers) assert.equal(layer.source, FILE.id);
  const [fill, outline, casing, line, point, label] = layers;
  assert.equal(fill.paint["fill-color"], FILE.color);
  assert.deepEqual(fill.paint["fill-opacity"], ["case", HOVER, 0.38, 0.2]);
  assert.deepEqual(outline.paint["line-width"], ["case", HOVER, 3, 1.6]);
  assert.deepEqual(casing.paint["line-width"], ["case", HOVER, 8, 5]);
  assert.equal(line.paint["line-color"], FILE.color);
  assert.deepEqual(line.paint["line-width"], ["case", HOVER, 4.2, 2.6]);
  assert.deepEqual(point.paint["circle-radius"], ["case", HOVER, 8, 5.5]);
  assert.deepEqual(point.paint["circle-stroke-width"], ["case", HOVER, 2.6, 1.8]);
  assert.deepEqual(label.layout["text-font"], FONT);
});

test("a file has no label layer when the map has no font", () => {
  assert.deepEqual(fileLayers(FILE, null).map((layer) => layer.id.slice(FILE.id.length + 1)), ["fill", "outline", "casing", "line", "point"]);
});

test("a file's source numbers its features, so one of them can be highlighted", () => {
  const data = { type: "FeatureCollection", features: [] };
  assert.deepEqual(fileSource(data), { type: "geojson", data, generateId: true });
});

test("the pointer hits the points, lines and areas of the visible files whose layers exist", () => {
  assert.deepEqual(HIT_SUFFIXES, ["point", "line", "fill"]);
  const files = [
    { id: "convert-import-1", visible: true },
    { id: "convert-import-2", visible: false },
    { id: "convert-import-3", visible: true },
  ];
  const all = hitLayerIds(files, () => true);
  assert.deepEqual(all, [
    "convert-import-1-point", "convert-import-1-line", "convert-import-1-fill",
    "convert-import-3-point", "convert-import-3-line", "convert-import-3-fill",
  ]);
  assert.deepEqual(hitLayerIds(files, (id) => id.startsWith("convert-import-3")), ["convert-import-3-point", "convert-import-3-line", "convert-import-3-fill"]);
  assert.deepEqual(hitLayerIds([], () => true), []);
});

test("a feature's card has its name, its kind and its other plain properties", () => {
  const summary = featureSummary({
    geometry: { type: "Point", coordinates: [32.86, 39.93] },
    properties: { name: "  Kızılay  ", ele: 938, open: true, note: "Meydan" },
  });
  assert.deepEqual(summary, { title: "Kızılay", kind: "point", rows: [["ele", "938"], ["open", "true"], ["note", "Meydan"]] });
  assert.equal(featureSummary({ geometry: { type: "MultiLineString", coordinates: [] }, properties: {} }).kind, "line");
  assert.equal(featureSummary({ geometry: { type: "Polygon", coordinates: [] }, properties: {} }).kind, "area");
  assert.equal(featureSummary({ geometry: { type: "MultiPoint", coordinates: [] }, properties: {} }).kind, "point");
});

test("a card without a name takes the first of title or label, else none", () => {
  assert.equal(featureSummary({ geometry: { type: "Point" }, properties: { title: "Başlık", label: "Etiket" } }).title, "Başlık");
  assert.equal(featureSummary({ geometry: { type: "Point" }, properties: { name: " ", label: "Etiket" } }).title, "Etiket");
  const none = featureSummary({ geometry: { type: "Point" }, properties: null });
  assert.equal(none.title, null);
  assert.deepEqual(none.rows, []);
});

test("nested values, empty texts and the title itself stay off the card; long texts are cut; eight rows at most", () => {
  const properties = { name: "A", nested: { a: 1 }, list: [1, 2], json: '{"a":1}', blank: "  ", missing: null, nan: Number.NaN, long: "x".repeat(300) };
  for (let index = 0; index < 12; index += 1) properties[`p${index}`] = index;
  const { rows } = featureSummary({ geometry: { type: "Point" }, properties });
  assert.equal(rows.length, 8);
  assert.deepEqual(rows[0], ["long", `${"x".repeat(200)}…`]);
  assert.deepEqual(rows.slice(1).map(([key]) => key), ["p0", "p1", "p2", "p3", "p4", "p5", "p6"]);
});
