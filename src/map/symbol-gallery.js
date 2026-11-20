// The symbol gallery's pure rules: the tabs, the named sections of the common
// symbols, each symbol listed by its code (not its name, which differs between
// standards), and the favourites kept per standard. A code a catalogue lacks is
// skipped and a section left empty is not shown. Task 05's interface builds on
// this; pure, no DOM, no React.

import { SYMBOL_STANDARDS } from "./symbols.js";

/**
 * @typedef {import("./symbols.js").CatalogIcon} CatalogIcon
 * @typedef {import("./symbols.js").SymbolStandard} SymbolStandard
 * @typedef {{ id: string, number: readonly string[], letter: readonly string[] }} GallerySection
 * @typedef {{ id: string, icons: CatalogIcon[] }} ResolvedSection
 */

/** The gallery's tabs, in their order. */
export const GALLERY_TABS = Object.freeze(["favorites", "units", "equipment", "search", "properties"]);

// The codes below are keys of galleryKey: the first list for the number
// standards (symbol set and entity code), the second for the letter standards
// (coding scheme, battle dimension and function ID). A code a catalogue lacks is
// skipped.
const section = (id, number, letter) => Object.freeze({ id, number: Object.freeze(number), letter: Object.freeze(letter) });

/** The gallery's sections: units and equipment, each code list in display order. */
export const GALLERY = Object.freeze({
  units: Object.freeze([
    section("frames",
      ["10:000000", "15:000000", "20:000000", "01:000000", "30:000000", "35:000000"],
      ["SG:U-----", "SG:E-----", "SG:I-----", "SA:------", "SS:------", "SU:------"]),
    section("command",
      ["10:110000", "10:111000", "10:110700", "10:111100", "10:150500", "10:151000", "10:150000"],
      ["SG:UH----", "SG:UUS---", "SG:UUSR--", "SG:UUI---", "SG:UUMSE-", "SG:UUM---"]),
    section("manoeuvre",
      ["10:121100", "10:121102", "10:121104", "10:120500", "10:121000", "10:120400", "10:121300", "10:121200", "10:121500"],
      ["SG:UCI---", "SG:UCIZ--", "SG:UCIM--", "SG:UCA---", "SG:UCAT--", "SG:UCAA--", "SG:UCR---", "SG:UCRV--"]),
    section("fires",
      ["10:130300", "10:130800", "10:130700", "10:130100", "10:130400"],
      ["SG:UCF---", "SG:UCFM--", "SG:UCFR--", "SG:UCM---", "SG:UCD---", "SG:UCDM--"]),
    section("aviation",
      ["10:120600", "10:120800", "10:121900", "10:120100"],
      ["SG:UCV---", "SG:UCVR--", "SG:UCVF--", "SG:UCVU--"]),
    section("protection",
      ["10:140700", "10:140800", "10:141300", "10:140100", "10:141200", "10:141700"],
      ["SG:UCE---", "SG:UUE---", "SG:UUA---", "SG:UUL---"]),
    section("sustainment",
      ["10:160000", "10:161300", "10:161400", "10:161100", "10:163600", "10:160400", "10:162500"],
      ["SG:USS---", "SG:USM---", "SG:USX---", "SG:UST---", "SG:USS5--", "SG:USA---"]),
    section("special",
      ["10:121700", "10:121800", "10:122000", "10:121400"],
      ["SF:------", "SF:G-----", "SF:GS----", "SF:GR----", "SF:A-----"]),
  ]),
  equipment: Object.freeze([
    section("installations",
      ["20:110000", "20:120800", "20:121300", "20:120700", "20:120500", "20:121200", "20:110300"],
      ["SG:IB----", "SG:IBA---", "SG:IBN---", "SG:IXH---", "SG:IRP---", "SG:IUT---", "SG:IUE---"]),
    section("weapons",
      ["15:110100", "15:110200", "15:111400", "15:110900", "15:111600", "15:110500", "15:111100", "15:111200", "15:111300"],
      ["SG:EWRR--", "SG:EWRH--", "SG:EWOM--", "SG:EWHM--", "SG:EWXM--", "SG:EWAM--", "SG:EWMA--", "SG:EWMT--", "SG:EWMS--"]),
    section("vehicles",
      ["15:120200", "15:120101", "15:120103", "15:120110", "15:140800", "15:140300", "15:130100", "15:131100", "15:130900"],
      ["SG:EVAT--", "SG:EVAI--", "SG:EVAA--", "SG:EVAL--", "SG:EVUX--", "SG:EVUA--", "SG:EVEB--", "SG:EVED--", "SG:EVEA--"]),
    section("aircraft",
      ["01:110100", "01:110104", "01:110103", "01:110102", "01:110107", "01:110200", "01:120100", "01:120200"],
      ["SA:MF----", "SA:MFF---", "SA:MFB---", "SA:MFA---", "SA:MFC---", "SA:MH----", "SA:MHA---", "SA:CF----", "SA:CH----"]),
    section("drones",
      ["01:110300", "01:110400", "01:120300"],
      ["SA:MFQ---", "SA:MHQ---"]),
    section("ships",
      ["30:120100", "30:120200", "30:120300", "30:120400", "30:120500", "30:120700", "30:140100", "30:140200"],
      ["SS:CLCV--", "SS:CLDD--", "SS:CLFF--", "SS:CA----", "SS:CM----", "SS:CP----", "SS:CU----", "SS:XM----", "SS:XF----"]),
    section("subsurface",
      ["35:110100", "35:110400", "35:110500", "35:130100"],
      ["SU:S-----", "SU:SN----", "SU:SC----", "SU:SU----", "SU:WT----", "SU:WM----", "SU:ND----"]),
  ]),
});

/**
 * The code a symbol is listed by in the gallery: its symbol set and entity code
 * for the number standards ("10:121100"), its scheme, battle dimension and
 * function ID for the letter standards ("SG:UCI---").
 * @param {CatalogIcon} icon
 * @returns {string}
 */
export function galleryKey(icon) {
  return icon.symbolSet ? `${icon.symbolSet}:${icon.code}` : `${icon.codingScheme}${icon.battleDimension}:${icon.code}`;
}

/**
 * The gallery's sections for a tab, resolved against a catalogue: only sections
 * with at least one symbol the catalogue holds, each symbol once (the first with
 * its code). Tabs without sections return an empty list.
 * @param {CatalogIcon[]} icons
 * @param {string} tab
 * @param {SymbolStandard} standard
 * @returns {ResolvedSection[]}
 */
export function gallerySections(icons, tab, standard) {
  if (!Object.hasOwn(GALLERY, tab)) return [];
  const byKey = new Map();
  for (const icon of icons) {
    const key = galleryKey(icon);
    if (!byKey.has(key)) byKey.set(key, icon);
  }
  const sections = [];
  for (const section of GALLERY[tab]) {
    const found = section[standard.family].map((key) => byKey.get(key)).filter(Boolean);
    if (found.length > 0) sections.push({ id: section.id, icons: found });
  }
  return sections;
}

/**
 * The code shown for a symbol: its id without the trailing duplicate mark
 * ("S-G-IXH---#2" becomes "S-G-IXH---").
 * @param {{ id: string }} icon
 * @returns {string}
 */
export function symbolCode(icon) {
  return icon.id.replace(/#\d+$/, "");
}

/** How many favourites one standard keeps. */
export const MAX_FAVORITES = 60;

/**
 * The favourites with one symbol added or removed: added symbols go first, a
 * standard's list is cut to MAX_FAVORITES and a list left empty is dropped. The
 * argument is not changed.
 * @param {Record<string, string[]>} favorites
 * @param {string} standardId
 * @param {string} iconId
 * @returns {Record<string, string[]>}
 */
export function toggleFavorite(favorites, standardId, iconId) {
  const next = {};
  for (const [key, ids] of Object.entries(favorites ?? {})) {
    if (key !== standardId) next[key] = [...ids];
  }
  const list = favorites?.[standardId] ?? [];
  const remaining = list.filter((id) => id !== iconId);
  const updated = remaining.length === list.length ? [iconId, ...remaining].slice(0, MAX_FAVORITES) : remaining;
  if (updated.length > 0) next[standardId] = updated;
  return next;
}

const STANDARD_IDS = new Set(SYMBOL_STANDARDS.map(({ id }) => id));

/**
 * Stored favourites (prefs "map-symbols-favorites") made safe: only known
 * standards, only non-empty strings, each id once, at most MAX_FAVORITES, and a
 * standard with nothing left is left out.
 * @param {unknown} raw
 * @returns {Record<string, string[]>}
 */
export function cleanFavorites(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const favorites = {};
  for (const [standardId, value] of Object.entries(raw)) {
    if (!STANDARD_IDS.has(standardId) || !Array.isArray(value)) continue;
    const kept = [...new Set(value.filter((id) => typeof id === "string" && id !== ""))].slice(0, MAX_FAVORITES);
    if (kept.length > 0) favorites[standardId] = kept;
  }
  return favorites;
}

/**
 * The catalogue symbols of a favourite list, in the stored order, without the
 * ones the catalogue lacks.
 * @param {CatalogIcon[]} icons
 * @param {string[] | undefined} ids
 * @returns {CatalogIcon[]}
 */
export function favoriteIcons(icons, ids) {
  if (!Array.isArray(ids)) return [];
  const byId = new Map();
  for (const icon of icons) if (!byId.has(icon.id)) byId.set(icon.id, icon);
  return ids.map((id) => byId.get(id)).filter(Boolean);
}
