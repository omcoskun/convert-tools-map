// Tests the symbol gallery's pure rules: the sections of each tab, the codes
// its symbols are listed by, and the favourites kept per standard.

import assert from "node:assert/strict";
import test from "node:test";
import { readJson } from "./support/files.mjs";
import { symbolStandard } from "../src/map/symbols.js";
import {
  GALLERY,
  GALLERY_TABS,
  MAX_FAVORITES,
  cleanFavorites,
  favoriteIcons,
  galleryKey,
  gallerySections,
  symbolCode,
  toggleFavorite,
} from "../src/map/symbol-gallery.js";

const catalogue = (name) => readJson(`public/symbols/${name}.json`).icons;
const shape = (sections) => sections.map((section) => [section.id, section.icons.length, section.icons[0].id]);

test("the gallery has favourites, units, equipment, search and properties tabs; units and equipment have sections", () => {
  assert.deepEqual(GALLERY_TABS, ["favorites", "units", "equipment", "search", "properties"]);
  assert.deepEqual(Object.keys(GALLERY), ["units", "equipment"]);
  assert.deepEqual(GALLERY.units.map((section) => section.id), ["frames", "command", "manoeuvre", "fires", "aviation", "protection", "sustainment", "special"]);
  assert.deepEqual(GALLERY.equipment.map((section) => section.id), ["installations", "weapons", "vehicles", "aircraft", "drones", "ships", "subsurface"]);
  for (const section of [...GALLERY.units, ...GALLERY.equipment]) assert.deepEqual(Object.keys(section), ["id", "number", "letter"]);
});

test("a symbol's gallery key is its symbol set and entity code, or its scheme, dimension and function ID", () => {
  assert.equal(galleryKey({ id: "10-121100", symbolSet: "10", code: "121100" }), "10:121100");
  assert.equal(galleryKey({ id: "S-G-UCI---", codingScheme: "S", battleDimension: "G", code: "UCI---" }), "SG:UCI---");
  assert.equal(galleryKey({ id: "S-F-------", codingScheme: "S", battleDimension: "F", code: "------" }), "SF:------");
});

test("every gallery code is in a catalogue of its family, once per tab", () => {
  const families = { number: ["app6d", "2525d", "2525e"], letter: ["app6a", "app6b", "2525c"] };
  for (const [family, names] of Object.entries(families)) {
    const keys = new Set(names.flatMap((name) => catalogue(name).map(galleryKey)));
    for (const [tab, sections] of Object.entries(GALLERY)) {
      const codes = sections.flatMap((section) => section[family]);
      assert.equal(new Set(codes).size, codes.length, `${tab} ${family}: a code is listed twice`);
      for (const section of sections) for (const key of section[family]) assert.ok(keys.has(key), `${tab}/${section.id}: ${key}`);
    }
  }
});

test("APP-6D's units come in eight sections, each led by its main symbol", () => {
  assert.deepEqual(shape(gallerySections(catalogue("app6d"), "units", symbolStandard("app6d"))), [
    ["frames", 4, "10-000000"],
    ["command", 7, "10-110000"],
    ["manoeuvre", 9, "10-121100"],
    ["fires", 5, "10-130300"],
    ["aviation", 4, "10-120600"],
    ["protection", 6, "10-140700"],
    ["sustainment", 7, "10-160000"],
    ["special", 3, "10-121700"],
  ]);
});

test("APP-6D's equipment and installations come in seven sections", () => {
  assert.deepEqual(shape(gallerySections(catalogue("app6d"), "equipment", symbolStandard("app6d"))), [
    ["installations", 7, "20-110000"],
    ["weapons", 9, "15-110100"],
    ["vehicles", 9, "15-120200"],
    ["aircraft", 8, "01-110100"],
    ["drones", 3, "01-110300"],
    ["ships", 8, "30-120100"],
    ["subsurface", 4, "35-110100"],
  ]);
});

test("a section the catalogue has nothing of is left out: 2525E has no bare frames", () => {
  for (const id of ["2525e", "app6e"]) {
    const sections = gallerySections(catalogue("2525e"), "units", symbolStandard(id));
    assert.deepEqual(sections.map((section) => section.id), ["command", "manoeuvre", "fires", "aviation", "protection", "sustainment", "special"], id);
  }
});

test("the letter standards use their own codes", () => {
  const units = gallerySections(catalogue("2525c"), "units", symbolStandard("2525c"));
  assert.deepEqual(units.map((section) => section.icons.length), [6, 6, 8, 6, 4, 4, 6, 5]);
  assert.equal(units.at(-1).icons[0].id, "S-F-------");
  assert.equal(units[2].icons[0].id, "S-G-UCI---");
  const equipment = gallerySections(catalogue("2525c"), "equipment", symbolStandard("2525c"));
  assert.deepEqual(equipment.map((section) => section.icons.length), [7, 9, 9, 9, 2, 9, 7]);
  const app6a = gallerySections(catalogue("app6a"), "units", symbolStandard("app6a"));
  assert.equal(app6a[0].icons[0].id, "S-G-U-----");
});

test("a code held twice resolves to its first symbol; tabs without sections have none", () => {
  const icons = [
    { id: "S-G-IXH---", codingScheme: "S", battleDimension: "G", code: "IXH---", name: "HOSPITAL" },
    { id: "S-G-IXH---#2", codingScheme: "S", battleDimension: "G", code: "IXH---", name: "HOSPITAL" },
  ];
  const sections = gallerySections(icons, "equipment", symbolStandard("2525c"));
  assert.deepEqual(shape(sections), [["installations", 1, "S-G-IXH---"]]);
  assert.deepEqual(gallerySections(icons, "units", symbolStandard("2525c")), []);
  for (const tab of ["favorites", "search", "properties", "nope"]) assert.deepEqual(gallerySections(icons, tab, symbolStandard("2525c")), [], tab);
});

test("the code shown for a symbol is its id without the duplicate mark", () => {
  assert.equal(symbolCode({ id: "S-G-IXH---#2" }), "S-G-IXH---");
  assert.equal(symbolCode({ id: "10-121100" }), "10-121100");
});

test("favourites are kept per standard, newest first, at most sixty, without changing the old value", () => {
  assert.equal(MAX_FAVORITES, 60);
  const once = toggleFavorite({}, "app6d", "10-121100");
  assert.deepEqual(once, { app6d: ["10-121100"] });
  const twice = toggleFavorite(once, "app6d", "10-120500");
  assert.deepEqual(twice, { app6d: ["10-120500", "10-121100"] });
  assert.deepEqual(once, { app6d: ["10-121100"] });
  assert.deepEqual(toggleFavorite(twice, "app6d", "10-121100"), { app6d: ["10-120500"] });
  assert.deepEqual(toggleFavorite({ app6d: ["x"] }, "app6d", "x"), {});
  assert.deepEqual(Object.keys(toggleFavorite(twice, "2525c", "S-G-UCI---")), ["app6d", "2525c"]);
  let many = {};
  for (let index = 0; index < 65; index += 1) many = toggleFavorite(many, "2525c", `id${index}`);
  assert.equal(many["2525c"].length, 60);
  assert.equal(many["2525c"][0], "id64");
  assert.equal(many["2525c"][59], "id5");
});

test("stored favourites are cleaned: unknown standards, empty lists, non-texts and repeats go", () => {
  assert.deepEqual(cleanFavorites(null), {});
  assert.deepEqual(cleanFavorites([1, 2]), {});
  assert.deepEqual(cleanFavorites("x"), {});
  assert.deepEqual(cleanFavorites({ app6d: ["a", 3, "", "a", "b"], nope: ["c"], "2525c": "d", app6b: [] }), { app6d: ["a", "b"] });
  const long = Array.from({ length: 70 }, (_, index) => `i${index}`);
  assert.deepEqual(cleanFavorites({ app6a: long }).app6a, long.slice(0, 60));
});

test("favourite symbols come in the stored order, without the ones the catalogue lacks", () => {
  const icons = [{ id: "a" }, { id: "b" }, { id: "c" }];
  assert.deepEqual(favoriteIcons(icons, ["c", "x", "a"]).map((icon) => icon.id), ["c", "a"]);
  assert.deepEqual(favoriteIcons(icons, undefined), []);
});
