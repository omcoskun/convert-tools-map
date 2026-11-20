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
    tab: "units",
    favorites: [],
    canRevert: false,
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
    chooseTab: noop,
    toggleFavorite: noop,
    placeWith: noop,
    dropSymbol: noop,
    revertSelected: noop,
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

/** The opening tag of the button whose text is the given label. */
function buttonNamed(html, label) {
  const match = [...markup(html).matchAll(/<button\b[^>]*>([\s\S]*?)<\/button>/g)].find((button) => visibleText(button[1]) === label);
  assert.ok(match, label);
  return match[0].slice(0, match[0].indexOf(">") + 1);
}

test("the palette offers all seven standards and previews the chosen symbol with its SIDC", () => {
  const html = render(palette(INFANTRY, { tab: "properties" }));
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

test("identity is chosen right under the preview, on the properties tab", () => {
  const html = render(palette(INFANTRY, { tab: "properties" }));
  const preview = html.indexOf("10031000001211000000");
  const identity = html.indexOf(`aria-label="${words.symbolIdentity}"`);
  assert.ok(preview > 0 && identity > preview, `${preview} ${identity}`);
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
  const preview = render(palette(INFANTRY, { tab: "properties" }));
  assert.match(element(preview, 'data-palette="preview"'), new RegExp(`title="${words.symbolDragTitle}"`));
  const html = render(palette(INFANTRY));
  assert.match(element(html, `aria-label="${INFANTRY.name}"`), new RegExp(`title="${INFANTRY.name} — ${words.symbolDragTitle}"`));
});

test("a unit offers identity, context, status, echelon, the three indicators, sector modifiers, size and the text fields", () => {
  const html = render(palette(INFANTRY, { tab: "properties", settings: { identity: "hostile" } }));
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
  const html = render(palette(TANK, { tab: "properties" }));
  assert.ok(element(html, 'id="symbol-mobility"').includes(words.symbolTracked));
  assert.equal(element(html, 'id="symbol-echelon"'), null);
  const text = visibleText(html);
  assert.ok(!text.includes(words.symbolHq));
  assert.ok(text.includes(words.symbolFeintDummy));
});

test("a placed symbol is edited in its own standard, and can be copied, deleted or left", () => {
  const html = render(palette(INFANTRY, { editing: true, count: 3, tab: "properties" }));
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
        createElement(SymbolPalette, { palette: palette(INFANTRY, { editing: true, count: 1, tab: "properties" }), open: true, onClose() {} }),
      ),
    ),
  );
  assert.doesNotMatch(visibleText(html), /undefined|NaN|\[object Object\]/);
  assert.ok(visibleText(html).includes(lang.en.text.mapSymbols));
});

test("the palette's tabs are favourites, units, equipment, search and properties, the chosen one selected", () => {
  const html = render(palette(INFANTRY));
  const tablist = element(html, `aria-label="${words.symbolTabs}"`);
  assert.deepEqual([...tablist.matchAll(/id="symbol-tab-([a-z]+)"/g)].map((match) => match[1]), ["favorites", "units", "equipment", "search", "properties"]);
  assert.match(element(html, 'id="symbol-tab-units"'), /aria-selected="true"/);
  assert.match(element(html, 'id="symbol-tab-search"'), /aria-selected="false"/);
  assert.equal(visibleText(tablist), `${words.symbolTabFavorites} ${words.symbolTabUnits} ${words.symbolTabEquipment} ${words.symbolTabSearch} ${words.symbolTabProperties}`);
  assert.match(element(html, 'role="tabpanel"'), /aria-labelledby="symbol-tab-units"/);
});

test("the units tab shows APP-6D's eight sections, drawn in the quick switch's identity", () => {
  const html = render(palette(INFANTRY));
  assert.deepEqual([...html.matchAll(/data-gallery-section="([a-z]+)"/g)].map((match) => match[1]), ["frames", "command", "manoeuvre", "fires", "aviation", "protection", "sustainment", "special"]);
  assert.ok(visibleText(html).includes(`${words.symbolGroupManoeuvre} (9)`));
  const hostile = render(palette(INFANTRY, { settings: { identity: "hostile" } }));
  assert.notEqual(element(html, `aria-label="${INFANTRY.name}"`), element(hostile, `aria-label="${INFANTRY.name}"`));
});

test("the equipment tab shows the seven sections of equipment and installations", () => {
  const html = render(palette(TANK, { tab: "equipment" }));
  assert.deepEqual([...html.matchAll(/data-gallery-section="([a-z]+)"/g)].map((match) => match[1]), ["installations", "weapons", "vehicles", "aircraft", "drones", "ships", "subsurface"]);
  assert.ok(visibleText(html).includes(`${words.symbolGroupWeapons} (9)`));
});

test("the quick switch sets identity and present or planned on the gallery tabs, not on the properties", () => {
  const html = render(palette(INFANTRY));
  assert.equal([...element(html, 'id="symbol-quick-identity"').matchAll(/<option /g)].length, 7);
  assert.deepEqual([...element(html, 'id="symbol-quick-status"').matchAll(/<option value="([a-zA-Z]+)"/g)].map((match) => match[1]), ["present", "planned"]);
  const damaged = render(palette(INFANTRY, { settings: { status: "damaged" } }));
  assert.deepEqual([...element(damaged, 'id="symbol-quick-status"').matchAll(/<option value="([a-zA-Z]+)"/g)].map((match) => match[1]), ["present", "planned", "damaged"]);
  assert.equal(element(render(palette(INFANTRY, { tab: "properties" })), 'id="symbol-quick-identity"'), null);
});

test("the search tab lists symbols as rows with their name, path and code, sixty at a time", () => {
  const html = render(palette(INFANTRY, { tab: "search" }));
  const list = element(html, `aria-label="${words.symbolCatalogue}"`);
  assert.ok(list.startsWith("<ul"));
  assert.equal([...list.matchAll(/<li/g)].length, 60);
  assert.ok(visibleText(html).includes(words.symbolShowMore));
  assert.ok(element(html, `aria-label="${words.symbolSearch}"`));
  assert.ok(element(html, `aria-label="${words.symbolCategory}"`));
  const row = visibleText(list.match(/<li[\s\S]*?<\/li>/)[0]);
  assert.match(row, /\d\d-\d{6}/, "a numeric code");
});

test("favourites: an empty tab says how to add one; starred symbols are its tiles", () => {
  assert.ok(visibleText(render(palette(INFANTRY, { tab: "favorites" }))).includes(words.symbolFavoritesEmpty));
  const html = render(palette(INFANTRY, { tab: "favorites", favorites: [TANK.id, INFANTRY.id] }));
  // The favourites tab button is named by a hidden span, so the first element with this aria-label is the grid.
  const grid = element(html, `aria-label="${words.symbolTabFavorites}"`);
  assert.deepEqual([...grid.matchAll(/<button[^>]*aria-label="([^"]+)"/g)].map((match) => match[1]), [TANK.name, INFANTRY.name]);
});

test("the footer shows the chosen symbol with its code and a star to keep it", () => {
  const footer = element(render(palette(INFANTRY)), 'data-palette="actions"');
  assert.ok(visibleText(footer).includes(`${INFANTRY.name} 10-121100`));
  assert.match(footer, new RegExp(`aria-pressed="false"[^>]*aria-label="${words.symbolFavoriteAdd}"|aria-label="${words.symbolFavoriteAdd}"[^>]*aria-pressed="false"`));
  const starred = element(render(palette(INFANTRY, { favorites: [INFANTRY.id] })), 'data-palette="actions"');
  assert.match(starred, new RegExp(`aria-pressed="true"[^>]*aria-label="${words.symbolFavoriteRemove}"|aria-label="${words.symbolFavoriteRemove}"[^>]*aria-pressed="true"`));
});

test("the properties come in four sections chosen one at a time, the others hidden but kept", () => {
  const html = render(palette(INFANTRY, { tab: "properties" }));
  assert.equal(visibleText(element(html, `aria-label="${words.symbolSections}"`)), `${words.symbolIdentity} ${words.symbolStatus} ${words.symbolSectionModifiers} ${words.symbolTexts}`);
  const sections = [...html.matchAll(/<div[^>]*data-symbol-section="([a-z]+)"[^>]*>/g)];
  assert.deepEqual(sections.map((match) => match[1]), ["identity", "status", "modifiers", "texts"]);
  assert.deepEqual(sections.map((match) => /\shidden=""/.test(match[0])), [false, true, true, true]);
  assert.ok(element(html, 'data-symbol-section="status"').includes('id="symbol-status"'));
  assert.equal([...element(html, 'data-symbol-section="texts"').matchAll(/id="symbol-text-/g)].length, 12);
});

test("a placed symbol offers a new base symbol and an undo that waits for a change", () => {
  const unchanged = render(palette(INFANTRY, { tab: "properties", editing: true, count: 1 }));
  assert.ok(visibleText(unchanged).includes(words.symbolChangeBase));
  assert.match(buttonNamed(unchanged, words.symbolRevert), /disabled=""/);
  const changed = render(palette(INFANTRY, { tab: "properties", editing: true, count: 1, canRevert: true }));
  assert.doesNotMatch(buttonNamed(changed, words.symbolRevert), /disabled=""/);
});

test("a symbol not yet placed has neither a base-symbol button nor an undo", () => {
  const text = visibleText(render(palette(INFANTRY, { tab: "properties" })));
  assert.ok(!text.includes(words.symbolChangeBase));
  assert.ok(!text.includes(words.symbolRevert));
});
