// Writes public/symbols/<catalog>.json, the military symbol palette's
// catalogues, from the catalogue the milsymbol fork builds:
//
//   (in a clone of github.com/omcoskun/milsymbol at the commit package.json pins)
//   npm ci --ignore-scripts && node scripts/build-studio.mjs --data /tmp/ms-data
//   (here)
//   node scripts/symbol-catalog.mjs /tmp/ms-data
//
// Each entry keeps what the palette uses (id, name, path, category and the
// parts of its SIDC). Entries milsymbol cannot draw as a single point (lines
// and areas among the control measures) are left out. The fork's licence
// notices go beside the catalogues.

import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ms from "milsymbol";
import { DEFAULT_SETTINGS, SYMBOL_STANDARDS, composeSidc, drawingSidc } from "../src/map/symbols.js";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const source = process.argv[2];
if (!source) throw new Error("usage: node scripts/symbol-catalog.mjs <directory written by build-studio.mjs --data>");
const { standards } = JSON.parse(readFileSync(path.join(source, "catalog.json"), "utf8"));
const output = path.join(root, "public", "symbols");
mkdirSync(output, { recursive: true });

const KEPT = ["id", "name", "path", "category", "codingScheme", "battleDimension", "code", "defaultModifier", "symbolSet"];

for (const catalog of [...new Set(SYMBOL_STANDARDS.map((standard) => standard.catalog))]) {
  const standard = SYMBOL_STANDARDS.find((candidate) => candidate.id === catalog) ?? SYMBOL_STANDARDS.find((candidate) => candidate.catalog === catalog);
  const data = standards[catalog];
  const icons = [];
  let left = 0;
  for (const icon of data.icons) {
    if (icon.categoryOnly) continue;
    const sidc = drawingSidc(composeSidc(icon, DEFAULT_SETTINGS, standard));
    if (!new ms.Symbol(sidc, { standard: standard.render }).isValid()) {
      left += 1;
      continue;
    }
    const kept = {};
    for (const key of KEPT) if (icon[key] !== undefined && icon[key] !== "") kept[key] = icon[key];
    icons.push(kept);
  }
  // Sector modifiers 1 and 2 of the numeric symbol sets: [code, name], "00" left out.
  const modifiers = {};
  for (const [set, lists] of Object.entries(data.modifiers ?? {})) {
    const pick = (list) => (list ?? []).filter(({ code }) => code !== "00").map(({ code, name }) => [code, name]);
    modifiers[set] = { 1: pick(lists.modifier1), 2: pick(lists.modifier2) };
  }
  writeFileSync(path.join(output, `${catalog}.json`), JSON.stringify({ icons, modifiers }));
  console.log(`${catalog}: ${icons.length} symbols (${left} not drawable as a point left out)`);
}
copyFileSync(path.join(source, "THIRD_PARTY_LICENSES.txt"), path.join(output, "LICENSES.txt"));
