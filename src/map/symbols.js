// The military symbol palette's rules: the seven standards of the owner's
// milsymbol fork (github.com/omcoskun/milsymbol), the SIDC each choice writes,
// what a catalogue symbol offers, search, and the symbols kept on the map.
// The identity, status, echelon, mobility and flag tables follow the fork's
// editor (studio/identities.js, app/src/editor/constants.js, editor-helpers.js).
// Pure: no DOM, no milsymbol (src/map/milsymbol.js draws).

/**
 * @typedef {{ id: string, label: string, family: "letter" | "number", version: string, catalog: string, render: "APP6A" | "APP6" | "2525" }} SymbolStandard
 * @typedef {{ id: string, name: string, path: string[], category: string, codingScheme?: string, battleDimension?: string, code: string, defaultModifier?: string, symbolSet?: string }} CatalogIcon
 * @typedef {{ identity: string, context: string, status: string, echelon: string, mobility: string, hq: boolean, taskForce: boolean, feintDummy: boolean, modifier1: string, modifier2: string }} SymbolSettings
 */

// version: SIDC positions 1-2 (MIL-STD-2525E Table A-1: 10 D, 13 2525E,
// 16 APP-06(E)(2)). catalog: the file in public/symbols/ (APP-6E has no
// catalogue of its own and uses 2525E's). render: milsymbol's standard option.
export const SYMBOL_STANDARDS = Object.freeze([
  Object.freeze({ id: "app6a", label: "APP-6A", family: "letter", version: "", catalog: "app6a", render: "APP6A" }),
  Object.freeze({ id: "app6b", label: "APP-6B", family: "letter", version: "", catalog: "app6b", render: "APP6" }),
  Object.freeze({ id: "app6d", label: "APP-6D", family: "number", version: "10", catalog: "app6d", render: "APP6" }),
  Object.freeze({ id: "app6e", label: "APP-6E", family: "number", version: "16", catalog: "2525e", render: "APP6" }),
  Object.freeze({ id: "2525c", label: "MIL-STD-2525C", family: "letter", version: "", catalog: "2525c", render: "2525" }),
  Object.freeze({ id: "2525d", label: "MIL-STD-2525D", family: "number", version: "10", catalog: "2525d", render: "2525" }),
  Object.freeze({ id: "2525e", label: "MIL-STD-2525E", family: "number", version: "13", catalog: "2525e", render: "2525" }),
]);

export const DEFAULT_STANDARD = "app6d";

/** @returns {SymbolStandard} */
export function symbolStandard(id) {
  return SYMBOL_STANDARDS.find((standard) => standard.id === id) ?? SYMBOL_STANDARDS.find((standard) => standard.id === DEFAULT_STANDARD);
}

/** @type {SymbolSettings} */
export const DEFAULT_SETTINGS = Object.freeze({
  identity: "friend",
  context: "0",
  status: "present",
  echelon: "",
  mobility: "",
  hq: false,
  taskForce: false,
  feintDummy: false,
  modifier1: "00",
  modifier2: "00",
});

// numeric: position 4 of a numeric SIDC; legacy and exercise: position 2 of a
// letter SIDC in reality and in an exercise.
const IDENTITIES = Object.freeze([
  { value: "friend", numeric: "3", legacy: "F", exercise: "D" },
  { value: "hostile", numeric: "6", legacy: "H", exercise: "K" },
  { value: "neutral", numeric: "4", legacy: "N", exercise: "L" },
  { value: "unknown", numeric: "1", legacy: "U", exercise: "W" },
  { value: "pending", numeric: "0", legacy: "P", exercise: "G" },
  { value: "assumed", numeric: "2", legacy: "A", exercise: "M" },
  { value: "suspect", numeric: "5", legacy: "S", exercise: "J" },
]);

// APP-6A Annex B: nine identities, joker and faker among them, no exercise letters.
const APP6A_IDENTITIES = Object.freeze([
  ...IDENTITIES.map(({ value, legacy }) => ({ value, legacy })),
  { value: "joker", legacy: "J" },
  { value: "faker", legacy: "K" },
]);

/** The identities a standard offers, in the palette's order. */
export function identityChoices(standard) {
  return standard.id === "app6a" ? APP6A_IDENTITIES : IDENTITIES;
}

export const STATUSES = Object.freeze([
  { value: "present", numeric: "0", legacy: "P" },
  { value: "planned", numeric: "1", legacy: "A" },
  { value: "fullyCapable", numeric: "2", legacy: "C" },
  { value: "damaged", numeric: "3", legacy: "D" },
  { value: "destroyed", numeric: "4", legacy: "X" },
  { value: "fullToCapacity", numeric: "5", legacy: "F" },
]);

// [value, numeric positions 9-10, letter position 12]
export const ECHELONS = Object.freeze([
  ["team", "11", "A"],
  ["squad", "12", "B"],
  ["section", "13", "C"],
  ["platoon", "14", "D"],
  ["company", "15", "E"],
  ["battalion", "16", "F"],
  ["regiment", "17", "G"],
  ["brigade", "18", "H"],
  ["division", "21", "I"],
  ["corps", "22", "J"],
  ["army", "23", "K"],
  ["armyGroup", "24", "L"],
  ["region", "25", "M"],
  ["command", "26", "N"],
]);

// [value, numeric positions 9-10, letter positions 11-12]
export const MOBILITIES = Object.freeze([
  ["wheeledLimited", "31", "MO"],
  ["wheeled", "32", "MP"],
  ["tracked", "33", "MQ"],
  ["combined", "34", "MR"],
  ["towed", "35", "MS"],
  ["rail", "36", "MT"],
  ["snow", "41", "MU"],
  ["sled", "42", "MV"],
  ["pack", "37", "MW"],
  ["barge", "51", "MX"],
  ["amphibious", "52", "MY"],
]);

// Position 11 of a letter SIDC by the flag code: feint/dummy 1, headquarters 2, task force 4.
const LEGACY_FLAG_LETTERS = Object.freeze(["-", "F", "A", "C", "E", "G", "B", "D"]);

// Milsymbol's text amplifiers, with the letter the standards give each field.
export const TEXT_FIELDS = Object.freeze([
  { key: "uniqueDesignation", code: "T" },
  { key: "higherFormation", code: "M" },
  { key: "additionalInformation", code: "H" },
  { key: "staffComments", code: "G" },
  { key: "quantity", code: "C" },
  { key: "reinforcedReduced", code: "F" },
  { key: "dtg", code: "W" },
  { key: "type", code: "V" },
  { key: "combatEffectiveness", code: "K" },
  { key: "speed", code: "Z" },
  { key: "altitudeDepth", code: "X" },
  { key: "direction", code: "Q" },
]);
const TEXT_KEYS = new Set(TEXT_FIELDS.map(({ key }) => key));
export const TEXT_MAX = 60;

export const SYMBOL_SIZES = Object.freeze({ small: 24, medium: 34, large: 48 });

/** "unit", "equipment", "installation" or "other". */
function symbolKind(icon, standard) {
  if (standard.family === "number") {
    return { 10: "unit", 15: "equipment", 20: "installation" }[icon.symbolSet] ?? "other";
  }
  if (icon.defaultModifier?.startsWith("H")) return "installation";
  if (icon.codingScheme !== "S") return "other";
  if (icon.battleDimension === "F") return "unit";
  if (icon.battleDimension !== "G") return "other";
  if (icon.code?.startsWith("U")) return "unit";
  if (icon.code?.startsWith("E")) return "equipment";
  if (icon.code?.startsWith("I")) return "installation";
  return "other";
}

/** What a catalogue symbol may carry in a standard. */
export function symbolOffers(icon, standard) {
  const kind = symbolKind(icon, standard);
  const contexts = standard.id === "app6a" ? ["0"] : standard.family === "number" ? ["0", "1", "2"] : ["0", "1"];
  const statuses = standard.id === "app6a" ? ["present", "planned"] : STATUSES.map(({ value }) => value);
  return {
    echelon: kind === "unit",
    mobility: kind === "equipment",
    hq: kind === "unit",
    taskForce: kind === "unit",
    feintDummy: kind !== "other",
    modifiers: standard.family === "number",
    contexts,
    statuses,
  };
}

/**
 * Settings carried over to another standard: identities it lacks become their
 * nearest one (APP-6A joker and faker are exercise suspect and hostile
 * elsewhere), contexts and statuses it lacks go back to reality and present,
 * and the sector modifiers (codes of one catalogue) are cleared.
 */
export function settingsForStandard(settings, standard) {
  let { identity, context } = settings;
  if (standard.id === "app6a") {
    if (context === "1" && identity === "suspect") identity = "joker";
    else if (context === "1" && identity === "hostile") identity = "faker";
    context = "0";
  } else if (identity === "joker" || identity === "faker") {
    identity = identity === "joker" ? "suspect" : "hostile";
    context = "1";
  }
  const offers = symbolOffers({ symbolSet: "10", codingScheme: "S", battleDimension: "G", code: "U" }, standard);
  if (!offers.contexts.includes(context)) context = "0";
  const status = offers.statuses.includes(settings.status) ? settings.status : "present";
  if (!identityChoices(standard).some(({ value }) => value === identity)) identity = "friend";
  return { ...settings, identity, context, status, modifier1: "00", modifier2: "00" };
}

/** The SIDC of a catalogue symbol with these settings, in the standard's form. */
export function composeSidc(icon, settings, standard) {
  const offers = symbolOffers(icon, standard);
  const identity = identityChoices(standard).find(({ value }) => value === settings.identity) ?? identityChoices(standard)[0];
  const context = offers.contexts.includes(settings.context) ? settings.context : "0";
  const status = STATUSES.find(({ value }) => value === settings.status && offers.statuses.includes(value)) ?? STATUSES[0];
  const flags = (offers.feintDummy && settings.feintDummy ? 1 : 0) + (offers.hq && settings.hq ? 2 : 0) + (offers.taskForce && settings.taskForce ? 4 : 0);
  const echelon = offers.echelon ? ECHELONS.find(([value]) => value === settings.echelon) : undefined;
  const mobility = offers.mobility ? MOBILITIES.find(([value]) => value === settings.mobility) : undefined;

  if (standard.family === "letter") {
    const letter = context === "1" && identity.exercise ? identity.exercise : identity.legacy;
    let amplifier = `${LEGACY_FLAG_LETTERS[flags]}${echelon?.[2] ?? "-"}`;
    if (mobility) amplifier = mobility[2];
    if (icon.defaultModifier?.startsWith("H")) amplifier = `H${offers.feintDummy && settings.feintDummy ? "B" : "-"}`;
    return `${icon.codingScheme ?? "S"}${letter}${icon.battleDimension ?? "G"}${status.legacy}${(icon.code ?? "------").padEnd(6, "-").slice(0, 6)}${amplifier}---`;
  }
  const modifier = (code) => (offers.modifiers && /^\d\d$/.test(code ?? "") ? code : "00");
  return [
    standard.version,
    context,
    identity.numeric,
    (icon.symbolSet ?? "10").padStart(2, "0"),
    status.numeric,
    String(flags),
    mobility?.[1] ?? echelon?.[1] ?? "00",
    (icon.code ?? "000000").padEnd(6, "0").slice(0, 6),
    modifier(settings.modifier1),
    modifier(settings.modifier2),
  ].join("");
}

/**
 * The symbol the palette puts on the map at a point: the chosen catalogue
 * symbol with the draft's settings, texts and size, its longitude wrapped
 * into ±180°. Null with nothing chosen yet or off the map.
 * @param {{ id: string, standardId: string, icon: CatalogIcon | null, draft: { settings: SymbolSettings, texts: object, size: string } }} source
 * @param {{ lng: number, lat: number }} point
 */
export function placedSymbol({ id, standardId, icon, draft }, { lng, lat }) {
  if (!icon || !Number.isFinite(lng) || !Number.isFinite(lat) || lat < -90 || lat > 90) return null;
  const standard = symbolStandard(standardId);
  return {
    id,
    standard: standard.id,
    icon: icon.id,
    name: icon.name,
    sidc: composeSidc(icon, draft.settings, standard),
    settings: draft.settings,
    texts: draft.texts,
    size: draft.size,
    lng: ((((lng + 180) % 360) + 360) % 360) - 180,
    lat,
  };
}

/**
 * The code milsymbol draws: it knows edition E as version 13 and 14, so
 * APP-6E's 16 (APP-06(E)(2)) is drawn as 14, as the fork's editor does.
 */
export function drawingSidc(sidc) {
  return /^16\d{18}/.test(sidc) ? `14${sidc.slice(2)}` : sidc;
}

/** Lower case, accents removed, anything but letters and digits as spaces. */
function normalize(text) {
  return String(text)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Catalogue symbols matching a search: every word of the query must start a
 * word of the name or the path, or the query (digits, letters and dashes of a
 * code) must be part of the id. A name equal to the query comes first, then
 * names starting with it, then names holding every word, then path matches.
 */
export function searchSymbols(icons, query, { category, limit = 120 } = {}) {
  const inCategory = category ? icons.filter((icon) => icon.category === category) : icons;
  const wanted = normalize(query);
  if (!wanted) return inCategory.slice(0, limit);
  const tokens = wanted.split(" ");
  const compact = String(query).trim().toUpperCase();
  const ranked = [];
  for (const icon of inCategory) {
    const name = normalize(icon.name);
    const words = new Set(`${name} ${normalize((icon.path ?? []).join(" "))}`.split(" "));
    const startsAll = (pool) => tokens.every((token) => [...pool].some((word) => word.startsWith(token)));
    let rank;
    if (name === wanted) rank = 0;
    else if (name.startsWith(wanted)) rank = 1;
    else if (startsAll(name.split(" "))) rank = 2;
    else if (startsAll(words)) rank = 3;
    else if (compact.length >= 3 && /^[A-Z0-9*-]+$/.test(compact) && icon.id.toUpperCase().includes(compact)) rank = 4;
    else continue;
    ranked.push({ icon, rank });
  }
  return ranked
    .sort((a, b) => a.rank - b.rank)
    .slice(0, limit)
    .map(({ icon }) => icon);
}

/** The catalogue's categories in their order, with how many symbols each holds. */
export function symbolCategories(icons) {
  const counts = new Map();
  for (const icon of icons) counts.set(icon.category, (counts.get(icon.category) ?? 0) + 1);
  return [...counts].map(([category, count]) => ({ category, count }));
}

const SIDC_PATTERN = /^(?:[A-Z][A-Z*-][A-Z*-][A-Z*-][A-Z0-9*-]{11}|\d{20})$/;
const MAX_SYMBOLS = 500;
const NAME_MAX = 120;

function cleanSettings(raw) {
  const settings = { ...DEFAULT_SETTINGS };
  if (!raw || typeof raw !== "object") return settings;
  for (const key of Object.keys(DEFAULT_SETTINGS)) {
    if (typeof raw[key] === typeof DEFAULT_SETTINGS[key]) settings[key] = raw[key];
  }
  return settings;
}

function cleanTexts(raw) {
  const texts = {};
  if (!raw || typeof raw !== "object") return texts;
  for (const [key, value] of Object.entries(raw)) {
    if (!TEXT_KEYS.has(key) || typeof value !== "string" || value.trim() === "") continue;
    texts[key] = value.slice(0, TEXT_MAX);
  }
  return texts;
}

/**
 * The remembered symbols (prefs "map-symbols"), keeping only whole entries on
 * the map with a well-formed SIDC, one per id, at most MAX_SYMBOLS.
 */
export function cleanSymbols(raw) {
  if (!Array.isArray(raw)) return [];
  const seen = new Set();
  const kept = [];
  for (const entry of raw) {
    if (kept.length >= MAX_SYMBOLS) break;
    if (!entry || typeof entry !== "object" || typeof entry.id !== "string" || seen.has(entry.id)) continue;
    if (!SYMBOL_STANDARDS.some(({ id }) => id === entry.standard)) continue;
    if (typeof entry.sidc !== "string" || !SIDC_PATTERN.test(entry.sidc) || typeof entry.icon !== "string") continue;
    if (!Number.isFinite(entry.lng) || !Number.isFinite(entry.lat) || entry.lat < -90 || entry.lat > 90 || entry.lng < -180 || entry.lng > 180) continue;
    seen.add(entry.id);
    kept.push({
      id: entry.id,
      standard: entry.standard,
      icon: entry.icon,
      name: typeof entry.name === "string" ? entry.name.slice(0, NAME_MAX) : "",
      sidc: entry.sidc,
      settings: cleanSettings(entry.settings),
      texts: cleanTexts(entry.texts),
      size: Object.hasOwn(SYMBOL_SIZES, entry.size) ? entry.size : "medium",
      lng: entry.lng,
      lat: entry.lat,
    });
  }
  return kept;
}

// A white edge round the symbol and its texts on the map, where the ground
// below may be dark (night style, satellite imagery).
const MAP_OUTLINE = Object.freeze({ outlineWidth: 2, outlineColor: "#ffffff", infoOutlineWidth: 3, infoOutlineColor: "#ffffff" });

/** Milsymbol's options for a symbol: on the map (onMap) or in the palette. */
export function symbolOptions({ standard, texts = {}, size = "medium" }, { onMap = false } = {}) {
  const options = { size: SYMBOL_SIZES[size] ?? SYMBOL_SIZES.medium, standard: symbolStandard(standard).render, ...(onMap ? MAP_OUTLINE : {}) };
  for (const [key, value] of Object.entries(texts)) {
    if (!TEXT_KEYS.has(key) || typeof value !== "string" || value.trim() === "") continue;
    if (key === "direction") {
      const degrees = Number(value.replace(",", "."));
      if (Number.isFinite(degrees)) options.direction = degrees;
      continue;
    }
    options[key] = value;
  }
  return options;
}
