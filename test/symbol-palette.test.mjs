// The military symbol palette, server-rendered with the real APP-6D catalogue
// and milsymbol: what it offers for a unit and for equipment, the edit mode
// of a placed symbol and the bar it shrinks to while a symbol is placed.

import assert from "node:assert/strict";
import test from "node:test";
import "./support/jsx-loader.mjs";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { readJson } from "./support/files.mjs";
import { element, markup, visibleText } from "./support/html.mjs";

const lang = readJson("public/lang.json");
const catalog = readJson("public/symbols/app6d.json");
const { default: SymbolPalette } = await import("../src/map/SymbolPalette.jsx");
const { LanguageContext } = await import("../src/context.js");
const { DEFAULT_SETTINGS, SYMBOL_STANDARDS, composeSidc, symbolStandard } = await import("../src/map/symbols.js");
const milsymbol = await import("milsymbol");
const ms = milsymbol.default ?? milsymbol.ms;

const words = lang.tr.text;
const INFANTRY = catalog.icons.find((icon) => icon.name === "Infantry");
const TANK = catalog.icons.find((icon) => icon.symbolSet === "15" && /^Tank/.test(icon.name));

function palette(icon, overrides = {}) {
  const standard = symbolStandard("app6d");
  const settings = { ...DEFAULT_SETTINGS, ...overrides.settings };
  const noop = () => {};
  return {
    standard,
    catalog: { id: "app6d", status: "ready", icons: catalog.icons, modifiers: catalog.modifiers },
    ms,
    msFailed: false,
    draft: { iconId: icon.id, settings, texts: overrides.texts ?? {}, size: "medium" },
    icon,
    sidc: composeSidc(icon, settings, standard),
    editing: false,
    placing: false,
    count: 0,
    ...overrides,
    chooseStandard: noop,
    chooseIcon: noop,
    changeSettings: noop,
    changeText: noop,
    chooseSize: noop,
    startPlacing: noop,
    cancelPlacing: noop,
    newSymbol: noop,
    deleteSelected: noop,
    clearAll: noop,
    retry: noop,
  };
}

function render(value) {
  return markup(
    renderToString(
      createElement(
        LanguageContext.Provider,
        { value: { language: "tr", ...lang.tr } },
        createElement(SymbolPalette, { palette: value, open: true, onClose() {} }),
      ),
    ),
  );
}

test("the palette offers all seven standards and previews the chosen symbol with its SIDC", () => {
  const html = render(palette(INFANTRY));
  const select = element(html, 'id="symbol-standard"');
  assert.deepEqual(
    [...select.matchAll(/<option value="([^"]+)"/g)].map((match) => match[1]),
    SYMBOL_STANDARDS.map(({ id }) => id),
  );
  assert.doesNotMatch(select, /disabled/);
  const text = visibleText(html);
  assert.ok(text.includes("Infantry"));
  assert.ok(text.includes("10031000001211000000"), "friend, present, no echelon");
  assert.match(html, /<svg[^>]*xmlns="http:\/\/www.w3.org\/2000\/svg"/, "milsymbol drew the preview and the tiles");
  assert.ok(text.includes(words.symbolPlace));
});

test("identity is chosen right under the preview, before the catalogue", () => {
  const html = render(palette(INFANTRY));
  const preview = html.indexOf("10031000001211000000");
  const identity = html.indexOf(`aria-label="${words.symbolIdentity}"`);
  const catalogue = html.indexOf(`aria-label="${words.symbolCatalogue}"`);
  assert.ok(preview > 0 && identity > preview && catalogue > identity, `${preview} ${identity} ${catalogue}`);
});

test("place, delete and new stay in a footer under the scrolling body, with the drag hint", () => {
  const html = render(palette(INFANTRY, { editing: true, count: 1 }));
  const footer = visibleText(element(html, 'data-palette="actions"'));
  for (const key of ["symbolPlaceCopy", "symbolDelete", "symbolNew", "symbolDragHint"]) assert.ok(footer.includes(words[key]), key);
  assert.ok(!visibleText(element(html, 'data-palette="body"')).includes(words.symbolPlaceCopy));
  const fresh = visibleText(element(render(palette(INFANTRY)), 'data-palette="actions"'));
  assert.ok(fresh.includes(words.symbolPlace) && !fresh.includes(words.symbolDelete));
});

test("the preview and the tiles say they can be dragged onto the map", () => {
  const html = render(palette(INFANTRY));
  assert.match(element(html, 'data-palette="preview"'), new RegExp(`title="${words.symbolDragTitle}"`));
  assert.match(element(html, `aria-label="${INFANTRY.name}"`), new RegExp(`title="${INFANTRY.name} — ${words.symbolDragTitle}"`));
});

test("a unit offers identity, context, status, echelon, the three indicators, sector modifiers, size and the text fields", () => {
  const html = render(palette(INFANTRY, { settings: { identity: "hostile" } }));
  const identities = element(html, `aria-label="${words.symbolIdentity}"`);
  assert.equal([...identities.matchAll(/role="radio"/g)].length, 7);
  assert.match(identities, /aria-checked="true"[^>]*>Düşman</);
  assert.equal(visibleText(element(html, `aria-label="${words.symbolContext}"`)), `${words.symbolReality} ${words.symbolExercise} ${words.symbolSimulation}`);
  assert.ok(element(html, 'id="symbol-status"'));
  assert.ok(element(html, 'id="symbol-echelon"').includes(words.symbolBattalion));
  assert.equal(element(html, 'id="symbol-mobility"'), null);
  const text = visibleText(html);
  for (const key of ["symbolHq", "symbolTaskForce", "symbolFeintDummy", "symbolSmall", "symbolMedium", "symbolLarge", "symbolTexts"]) {
    assert.ok(text.includes(words[key]), key);
  }
  const modifier = element(html, 'id="symbol-modifier-1"');
  assert.ok(modifier.includes(catalog.modifiers["10"]["1"][0][1]), "the land unit's sector 1 modifiers");
  assert.equal([...html.matchAll(/id="symbol-text-/g)].length, 12);
});

test("equipment offers mobility instead of the echelon and the unit indicators", () => {
  const html = render(palette(TANK));
  assert.ok(element(html, 'id="symbol-mobility"').includes(words.symbolTracked));
  assert.equal(element(html, 'id="symbol-echelon"'), null);
  const text = visibleText(html);
  assert.ok(!text.includes(words.symbolHq));
  assert.ok(text.includes(words.symbolFeintDummy));
});

test("a placed symbol is edited in its own standard, and can be copied, deleted or left", () => {
  const html = render(palette(INFANTRY, { editing: true, count: 3 }));
  assert.match(element(html, 'id="symbol-standard"'), /disabled/);
  const text = visibleText(html);
  for (const key of ["symbolEditing", "symbolPlaceCopy", "symbolDelete", "symbolNew", "symbolClearAll"]) {
    assert.ok(text.includes(words[key]), key);
  }
  assert.ok(text.includes(words.symbolCount.replace("{count}", "3")));
});

test("while a symbol is placed the palette is a bar that says to click the map and offers cancel", () => {
  const text = visibleText(render(palette(INFANTRY, { placing: true })));
  assert.equal(text, `${words.symbolPlacing} ${words.mapCancel}`);
});

test("the palette renders in English with no missing text", () => {
  const html = markup(
    renderToString(
      createElement(
        LanguageContext.Provider,
        { value: { language: "en", ...lang.en } },
        createElement(SymbolPalette, { palette: palette(INFANTRY, { editing: true, count: 1 }), open: true, onClose() {} }),
      ),
    ),
  );
  assert.doesNotMatch(visibleText(html), /undefined|NaN|\[object Object\]/);
  assert.ok(visibleText(html).includes(lang.en.text.mapSymbols));
});
