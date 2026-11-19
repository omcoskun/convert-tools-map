// The data panel, server-rendered: what it offers before anything is open,
// the files it lists, why a file was not shown, and the image laid over the
// map.

import assert from "node:assert/strict";
import test from "node:test";
import "./support/jsx-loader.mjs";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { readJson } from "./support/files.mjs";
import { buttonLabels, element, markup, visibleText } from "./support/html.mjs";

const lang = readJson("public/lang.json");
const { default: ImportPanel } = await import("../src/map/ImportPanel.jsx");
const { LanguageContext } = await import("../src/context.js");

const tr = lang.tr.text;
const en = lang.en.text;

function data(overrides = {}) {
  const noop = () => {};
  return {
    open: true,
    busy: false,
    files: [],
    errors: [],
    overlay: null,
    ...overrides,
    togglePanel: noop,
    closePanel: noop,
    dismissError: noop,
    importFiles: noop,
    toggleFile: noop,
    removeFile: noop,
    zoomToFile: noop,
    setOverlayOpacity: noop,
    toggleOverlayEditing: noop,
    placeOverlayInView: noop,
    removeOverlay: noop,
  };
}

function render(value, { language = "tr", open = true } = {}) {
  return markup(
    renderToString(
      createElement(LanguageContext.Provider, { value: { language, ...lang[language] } }, createElement(ImportPanel, { data: value, open, onClose() {} })),
    ),
  );
}

const ROUTE = { id: "convert-import-1", name: "rota.gpx", color: "#c026d3", visible: true, counts: { points: 3, lines: 1, areas: 0 } };
const PARKS = { id: "convert-import-2", name: "parklar.geojson", color: "#0891b2", visible: false, counts: { points: 0, lines: 0, areas: 12 } };

test("a closed panel renders nothing", () => {
  assert.equal(render(data(), { open: false }), "");
});

test("an empty panel offers a file and an image, and says files stay in the browser", () => {
  const html = render(data());
  assert.ok(element(html, `aria-label="${tr.importTitle}"`), "a dialog named for the panel");
  const words = visibleText(html);
  for (const key of ["importTitle", "importOpenFile", "importOpenImage", "importHint"]) assert.ok(words.includes(tr[key]), key);
  assert.doesNotMatch(html, /<h3|<ul/, "no file list or image section yet");
  const inputs = [...html.matchAll(/<input[^>]*type="file"[^>]*>/g)].map((match) => match[0]);
  assert.equal(inputs.length, 2);
  assert.match(inputs[0], /multiple/);
  assert.match(inputs[0], /accept="[^"]*\.gpx[^"]*\.kml/);
  assert.match(inputs[1], /accept="image\//);
});

test("each file is listed with what it holds and can be shown, zoomed to or removed", () => {
  const html = render(data({ files: [ROUTE, PARKS] }));
  const words = visibleText(html);
  assert.ok(words.includes("rota.gpx 3 nokta · 1 çizgi"), "only the parts the file has");
  assert.ok(words.includes("parklar.geojson 12 alan"));
  const labels = buttonLabels(html);
  for (const name of ["rota.gpx", "parklar.geojson"]) {
    for (const key of ["importShow", "importZoom", "importRemove"]) assert.ok(labels.includes(`${tr[key]}: ${name}`), `${key} ${name}`);
  }
  assert.match(element(html, `aria-label="${tr.importShow}: rota.gpx"`), /aria-pressed="true"/);
  assert.match(element(html, `aria-label="${tr.importShow}: parklar.geojson"`), /aria-pressed="false"/);
});

test("a single point, line or area is counted in the singular in English", () => {
  const words = visibleText(render(data({ files: [{ ...ROUTE, counts: { points: 1, lines: 1, areas: 1 } }] }), { language: "en" }));
  assert.ok(words.includes("1 point · 1 line · 1 area"));
});

test("a file that could not be shown says why, with the limit where there is one", () => {
  const html = render(
    data({
      errors: [
        { id: 1, name: "harita.kmz", code: "kmz" },
        { id: 2, name: "dev.geojson", code: "tooLarge" },
        { id: 3, name: "çok.geojson", code: "tooMany" },
        { id: 4, name: "foto.png", code: "imageTooLarge" },
        { id: 5, name: "garip.bin", code: "something new" },
      ],
    }),
  );
  const alert = visibleText(element(html, 'role="alert"'));
  assert.ok(alert.includes(`harita.kmz: ${tr.importKmz}`));
  assert.ok(alert.includes(`dev.geojson: ${tr.importTooLarge.replace("{max}", "25")}`));
  assert.ok(alert.includes(`çok.geojson: ${tr.importTooMany.replace("{max}", "50.000")}`));
  assert.ok(alert.includes(`foto.png: ${tr.importTooLarge.replace("{max}", "40")}`));
  assert.ok(alert.includes(`garip.bin: ${tr.importUnreadable}`), "an unknown code reads as unreadable");
  assert.equal(buttonLabels(html).filter((label) => label === tr.importDismiss).length, 5);
});

test("the image laid over the map has its opacity, its corners to edit, a place-in-view and a remove", () => {
  const editing = render(data({ overlay: { name: "pafta.jpg", opacity: 0.7, editing: true } }));
  const words = visibleText(editing);
  assert.ok(words.includes(tr.importOverlay));
  assert.ok(words.includes("pafta.jpg"));
  assert.ok(words.includes(`${tr.importOpacity} %70`));
  const range = editing.match(/<input[^>]*type="range"[^>]*>/)[0];
  assert.match(range, /value="70"/);
  assert.match(range, new RegExp(`aria-label="${tr.importOpacity}"`));
  assert.match(range, /aria-valuetext="%70"/);
  assert.ok(words.includes(tr.importPlaceInView));
  assert.ok(words.includes(tr.importCornersHint), "the drag hint while the corners are edited");
  assert.match(editing, new RegExp(`aria-pressed="true"[^>]*>${tr.importEditCorners}<`));

  const placed = visibleText(render(data({ overlay: { name: "pafta.jpg", opacity: 0.45, editing: false } }), { language: "en" }));
  assert.ok(placed.includes(`${en.importOpacity} 45%`));
  assert.ok(!placed.includes(en.importCornersHint));
});
