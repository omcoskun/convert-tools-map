// src/map/symbols.js: the military symbol palette's rules (SIDCs per standard,
// what a symbol offers, search, the remembered symbols).

import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_SETTINGS,
  SYMBOL_STANDARDS,
  TEXT_FIELDS,
  cleanSymbols,
  composeSidc,
  drawingSidc,
  identityChoices,
  placedSymbol,
  searchSymbols,
  settingsForStandard,
  symbolOffers,
  symbolOptions,
  symbolStandard,
} from "../src/map/symbols.js";

const INFANTRY_LETTER = Object.freeze({ id: "S-G-UCI---", codingScheme: "S", battleDimension: "G", code: "UCI---", name: "INFANTRY", path: ["GROUND UNIT", "INFANTRY"], category: "GROUND UNIT" });
const TANK_LETTER = Object.freeze({ id: "S-G-EVAT--", codingScheme: "S", battleDimension: "G", code: "EVAT--", name: "TANK", path: ["GROUND EQUIPMENT", "TANK"], category: "GROUND EQUIPMENT" });
const BASE_LETTER = Object.freeze({ id: "S-G-IB----", codingScheme: "S", battleDimension: "G", code: "IB----", defaultModifier: "H-", name: "MILITARY BASE", path: ["GROUND INSTALLATION", "MILITARY BASE"], category: "GROUND INSTALLATION" });
const FIGHTER_LETTER = Object.freeze({ id: "S-A-MFF---", codingScheme: "S", battleDimension: "A", code: "MFF---", name: "FIGHTER", path: ["AIR TRACK", "FIGHTER"], category: "AIR" });
const INFANTRY = Object.freeze({ id: "10-121100", symbolSet: "10", code: "121100", name: "Infantry", path: ["Movement and Maneuver", "Infantry"], category: "Land unit" });
const TANK = Object.freeze({ id: "15-120100", symbolSet: "15", code: "120100", name: "Tank", path: ["Armoured Vehicles", "Tank"], category: "Land equipment" });
const FIGHTER = Object.freeze({ id: "01-110101", symbolSet: "01", code: "110101", name: "Fighter", path: ["Military", "Fixed Wing", "Fighter"], category: "Air" });

const settings = (changes) => ({ ...DEFAULT_SETTINGS, ...changes });

test("seven standards: three with letter SIDCs, four numeric with their version codes", () => {
  assert.deepEqual(
    SYMBOL_STANDARDS.map(({ id, family, version, catalog, render }) => [id, family, version, catalog, render]),
    [
      ["app6a", "letter", "", "app6a", "APP6A"],
      ["app6b", "letter", "", "app6b", "APP6"],
      ["app6d", "number", "10", "app6d", "APP6"],
      ["app6e", "number", "16", "2525e", "APP6"],
      ["2525c", "letter", "", "2525c", "2525"],
      ["2525d", "number", "10", "2525d", "2525"],
      ["2525e", "number", "13", "2525e", "2525"],
    ],
  );
  assert.equal(symbolStandard("2525c").id, "2525c");
  // An unknown id falls back to APP-6D.
  assert.equal(symbolStandard("nope").id, "app6d");
});

test("letter SIDCs: identity, status, headquarters, task force, feint and echelon in positions 2, 4, 11 and 12", () => {
  const c = symbolStandard("2525c");
  assert.equal(composeSidc(INFANTRY_LETTER, DEFAULT_SETTINGS, c), "SFGPUCI--------");
  assert.equal(composeSidc(INFANTRY_LETTER, settings({ echelon: "platoon", hq: true }), c), "SFGPUCI---AD---");
  assert.equal(composeSidc(INFANTRY_LETTER, settings({ echelon: "battalion", taskForce: true, feintDummy: true }), c), "SFGPUCI---GF---");
  assert.equal(composeSidc(INFANTRY_LETTER, settings({ hq: true, taskForce: true, feintDummy: true }), c), "SFGPUCI---D----");
  assert.equal(composeSidc(INFANTRY_LETTER, settings({ identity: "hostile", status: "planned" }), c), "SHGAUCI--------");
  // Exercise writes the exercise letter (hostile: faker K).
  assert.equal(composeSidc(INFANTRY_LETTER, settings({ identity: "hostile", context: "1" }), symbolStandard("app6b")), "SKGPUCI--------");
  // Equipment takes mobility, not an echelon; installations keep their H.
  assert.equal(composeSidc(TANK_LETTER, settings({ echelon: "platoon", mobility: "tracked", hq: true }), c), "SFGPEVAT--MQ---");
  assert.equal(composeSidc(BASE_LETTER, settings({ echelon: "platoon" }), c), "SFGPIB----H----");
  assert.equal(composeSidc(BASE_LETTER, settings({ feintDummy: true }), c), "SFGPIB----HB---");
  // Air tracks take none of the land amplifiers.
  assert.equal(composeSidc(FIGHTER_LETTER, settings({ echelon: "platoon", hq: true, feintDummy: true }), c), "SFAPMFF--------");
});

test("numeric SIDCs: version, context, identity, set, status, flags, echelon or mobility, entity and sector modifiers", () => {
  const d = symbolStandard("app6d");
  assert.equal(composeSidc(INFANTRY, DEFAULT_SETTINGS, d), "10031000001211000000");
  assert.equal(composeSidc(INFANTRY, settings({ echelon: "company", hq: true, taskForce: true }), d), "10031006151211000000");
  assert.equal(composeSidc(INFANTRY, settings({ identity: "hostile", context: "2", status: "planned", feintDummy: true }), d), "10261011001211000000");
  assert.equal(composeSidc(INFANTRY, settings({ modifier1: "01", modifier2: "27" }), d), "10031000001211000127");
  assert.equal(composeSidc(TANK, settings({ mobility: "tracked", echelon: "company", hq: true }), d), "10031500331201000000");
  assert.equal(composeSidc(FIGHTER, settings({ echelon: "company", hq: true, mobility: "tracked" }), d), "10030100001101010000");
  assert.equal(composeSidc(INFANTRY, DEFAULT_SETTINGS, symbolStandard("2525e")).slice(0, 2), "13");
  assert.equal(composeSidc(INFANTRY, DEFAULT_SETTINGS, symbolStandard("app6e")).slice(0, 2), "16");
});

test("APP-6E codes are drawn as milsymbol's edition E code; others are drawn as written", () => {
  assert.equal(drawingSidc("16031000001211000000"), "14031000001211000000");
  assert.equal(drawingSidc("13031000001211000000"), "13031000001211000000");
  assert.equal(drawingSidc("10031000001211000000"), "10031000001211000000");
  assert.equal(drawingSidc("SFGPUCI---AD---"), "SFGPUCI---AD---");
});

test("a symbol offers the amplifiers of its kind and the statuses of its standard", () => {
  const c = symbolStandard("2525c");
  assert.deepEqual(symbolOffers(INFANTRY_LETTER, c), { echelon: true, mobility: false, hq: true, taskForce: true, feintDummy: true, modifiers: false, contexts: ["0", "1"], statuses: ["present", "planned", "fullyCapable", "damaged", "destroyed", "fullToCapacity"] });
  assert.deepEqual(symbolOffers(TANK_LETTER, c).mobility, true);
  assert.deepEqual(symbolOffers(TANK_LETTER, c).echelon, false);
  assert.deepEqual(symbolOffers(BASE_LETTER, c).hq, false);
  assert.deepEqual(symbolOffers(BASE_LETTER, c).feintDummy, true);
  assert.deepEqual(symbolOffers(FIGHTER_LETTER, c).feintDummy, false);
  const a = symbolStandard("app6a");
  assert.deepEqual(symbolOffers(INFANTRY_LETTER, a).statuses, ["present", "planned"]);
  assert.deepEqual(symbolOffers(INFANTRY_LETTER, a).contexts, ["0"]);
  const d = symbolStandard("2525d");
  assert.deepEqual(symbolOffers(INFANTRY, d).contexts, ["0", "1", "2"]);
  assert.equal(symbolOffers(INFANTRY, d).modifiers, true);
  assert.equal(symbolOffers(TANK, d).mobility, true);
  assert.equal(symbolOffers(FIGHTER, d).echelon, false);
});

test("identities: seven per standard, APP-6A's nine with joker and faker; switching standards keeps what it can", () => {
  assert.deepEqual(identityChoices(symbolStandard("app6d")).map(({ value }) => value), ["friend", "hostile", "neutral", "unknown", "pending", "assumed", "suspect"]);
  assert.deepEqual(identityChoices(symbolStandard("app6a")).map(({ value }) => value), ["friend", "hostile", "neutral", "unknown", "pending", "assumed", "suspect", "joker", "faker"]);
  // A joker is an exercise suspect elsewhere; contexts and statuses a standard lacks go back to reality and present.
  assert.deepEqual(settingsForStandard(settings({ identity: "joker" }), symbolStandard("app6d")), settings({ identity: "suspect", context: "1" }));
  assert.deepEqual(settingsForStandard(settings({ context: "2", status: "damaged" }), symbolStandard("app6a")), DEFAULT_SETTINGS);
  assert.deepEqual(settingsForStandard(settings({ context: "2" }), symbolStandard("app6b")), DEFAULT_SETTINGS);
  assert.deepEqual(settingsForStandard(settings({ identity: "suspect", context: "1" }), symbolStandard("app6a")), settings({ identity: "joker" }));
});

test("search finds names and paths, accent- and case-blind, best matches first, and SIDC-like ids", () => {
  const icons = [
    { id: "10-121100", name: "Infantry", path: ["Movement and Maneuver", "Infantry"] },
    { id: "10-121102", name: "Infantry Mechanized", path: ["Movement and Maneuver", "Infantry", "Mechanized"] },
    { id: "10-121300", name: "Reconnaissance", path: ["Movement and Maneuver", "Reconnaissance"] },
    { id: "15-120100", name: "Tank", path: ["Armoured Vehicles", "Tank"] },
    { id: "10-130000", name: "Air Defense", path: ["Fires", "Air Defense"] },
  ];
  assert.deepEqual(searchSymbols(icons, "infantry").map(({ id }) => id), ["10-121100", "10-121102"]);
  assert.deepEqual(searchSymbols(icons, "  RECON ").map(({ id }) => id), ["10-121300"]);
  assert.deepEqual(searchSymbols(icons, "mech inf").map(({ id }) => id), ["10-121102"]);
  assert.deepEqual(searchSymbols(icons, "maneuver").map(({ id }) => id), ["10-121100", "10-121102", "10-121300"]);
  assert.deepEqual(searchSymbols(icons, "120100").map(({ id }) => id), ["15-120100"]);
  assert.equal(searchSymbols(icons, "").length, 5);
  assert.deepEqual(searchSymbols(icons, "", { category: undefined, limit: 2 }).map(({ id }) => id), ["10-121100", "10-121102"]);
  assert.deepEqual(searchSymbols(icons, "zzz"), []);
});

test("the text fields are milsymbol options with their letter codes", () => {
  assert.deepEqual(TEXT_FIELDS.map(({ key, code }) => `${code}:${key}`), [
    "T:uniqueDesignation",
    "M:higherFormation",
    "H:additionalInformation",
    "G:staffComments",
    "C:quantity",
    "F:reinforcedReduced",
    "W:dtg",
    "V:type",
    "K:combatEffectiveness",
    "Z:speed",
    "X:altitudeDepth",
    "Q:direction",
  ]);
});

test("remembered symbols are kept only when whole and on the map", () => {
  const good = { id: "s1", standard: "app6d", icon: "10-121100", name: "Infantry", sidc: "10031000001211000000", settings: DEFAULT_SETTINGS, texts: { uniqueDesignation: "1/A" }, size: "medium", lng: 32.85, lat: 39.93 };
  assert.deepEqual(cleanSymbols([good]), [good]);
  assert.deepEqual(cleanSymbols("nope"), []);
  assert.deepEqual(cleanSymbols(null), []);
  const cleaned = cleanSymbols([
    good,
    { ...good, id: "s2", lat: 95 },
    { ...good, id: "s3", sidc: "<svg>" },
    { ...good, id: "s4", standard: "x" },
    { ...good, id: "s5", size: "huge", name: 7, texts: { uniqueDesignation: 5, nope: "x", higherFormation: "B".repeat(200) } },
    { ...good, id: "s6", name: "N".repeat(300) },
    { ...good, id: "s1" },
  ]);
  assert.deepEqual(cleaned.map(({ id }) => id), ["s1", "s5", "s6"]);
  assert.equal(cleaned[1].size, "medium");
  assert.equal(cleaned[1].name, "");
  assert.equal(cleaned[2].name, "N".repeat(120));
  assert.deepEqual(cleaned[1].texts, { higherFormation: "B".repeat(60) });
});

test("a symbol placed from the palette carries the draft at the point, wrapped onto the map", () => {
  const draft = { iconId: INFANTRY.id, settings: settings({ identity: "hostile", echelon: "battalion" }), texts: { uniqueDesignation: "2/14" }, size: "large" };
  const symbol = placedSymbol({ id: "s9", standardId: "app6d", icon: INFANTRY, draft }, { lng: 392.5, lat: 39.9 });
  assert.deepEqual(symbol, {
    id: "s9",
    standard: "app6d",
    icon: INFANTRY.id,
    name: "Infantry",
    sidc: "10061000161211000000",
    settings: draft.settings,
    texts: draft.texts,
    size: "large",
    lng: 32.5,
    lat: 39.9,
  });
  assert.deepEqual(cleanSymbols([symbol]), [symbol], "kept by the rules of the remembered list");
  assert.equal(placedSymbol({ id: "s9", standardId: "app6d", icon: null, draft }, { lng: 0, lat: 0 }), null, "nothing chosen yet");
  assert.equal(placedSymbol({ id: "s9", standardId: "app6d", icon: INFANTRY, draft }, { lng: 10, lat: 91 }), null, "off the map");
});

test("on the map a symbol and its texts get a white outline, so they read on dark and satellite maps", () => {
  const plain = symbolOptions({ standard: "app6d", texts: { uniqueDesignation: "2/14", direction: "45" }, size: "large" });
  assert.deepEqual(plain, { size: 48, standard: "APP6", uniqueDesignation: "2/14", direction: 45 });
  const onMap = symbolOptions({ standard: "2525c", size: "small" }, { onMap: true });
  assert.deepEqual(onMap, { size: 24, standard: "2525", outlineWidth: 2, outlineColor: "#ffffff", infoOutlineWidth: 3, infoOutlineColor: "#ffffff" });
});
