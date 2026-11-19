// The owner's milsymbol fork (github.com/omcoskun/milsymbol, MIT), loaded on
// demand as its own chunk the first time the symbol palette opens or a
// remembered symbol is drawn, and the symbol catalogues of public/symbols/.

import { drawingSidc, symbolOptions } from "./symbols.js";

let loading = null;

/** Resolves to milsymbol's `ms`. A failed load is not cached, so a retry fetches again. */
export function loadMilsymbol() {
  if (loading == null) {
    loading = import("milsymbol").then((module) => module.default ?? module.ms);
    loading.catch(() => {
      loading = null;
    });
  }
  return loading;
}

const catalogs = new Map();

/**
 * The catalogue public/symbols/<id>.json: { icons, modifiers }. A failed
 * fetch is not cached.
 */
export function loadSymbolCatalog(id) {
  if (!catalogs.has(id)) {
    const request = fetch(new URL(`symbols/${id}.json`, document.baseURI)).then((response) => {
      if (!response.ok) throw new Error(`symbols/${id}.json: HTTP ${response.status}`);
      return response.json();
    });
    request.catch(() => catalogs.delete(id));
    catalogs.set(id, request);
  }
  return catalogs.get(id);
}

/**
 * A symbol drawn by milsymbol: its SVG markup (milsymbol escapes the texts),
 * the point of the SVG on the symbol's location, its size in CSS pixels and
 * whether milsymbol could draw the code. On the map (onMap) it has a white edge.
 * @param {object} ms
 * @param {{ sidc: string, standard: string, texts?: object, size?: string }} symbol
 * @param {{ onMap?: boolean }} [options]
 */
export function drawSymbol(ms, { sidc, standard, texts, size }, { onMap = false } = {}) {
  const drawn = new ms.Symbol(drawingSidc(sidc), symbolOptions({ standard, texts, size }, { onMap }));
  return { svg: drawn.asSVG(), anchor: drawn.getAnchor(), size: drawn.getSize(), valid: drawn.isValid() };
}
