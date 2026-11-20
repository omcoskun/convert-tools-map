// The military symbol palette's state and the symbols on the map: the chosen
// standard and its catalogue, the palette's current symbol (the draft), the
// placed symbols (remembered in the browser) and their MapLibre markers. A
// symbol is placed with a click on the map after "place", or dragged out of
// the palette; the palette then stays on its draft, ready for the next one.
// A placed symbol is dragged to move it and clicked to edit it in the palette.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { readPref, writePref } from "../lib/prefs.js";
import { PHONE } from "../theme.js";
import { drawSymbol, loadMilsymbol, loadSymbolCatalog } from "./milsymbol.js";
import { GALLERY_TABS, cleanFavorites, tabAfterChoice, toggleFavorite as toggledFavorites } from "./symbol-gallery.js";
import {
  DEFAULT_SETTINGS,
  DEFAULT_STANDARD,
  SYMBOL_SIZES,
  SYMBOL_STANDARDS,
  TEXT_MAX,
  cleanSymbols,
  composeSidc,
  placedSymbol,
  sameSymbolLook,
  settingsForStandard,
  symbolStandard,
} from "./symbols.js";

const STANDARD_IDS = SYMBOL_STANDARDS.map(({ id }) => id);

function newSymbolId() {
  return `s${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

/** The catalogue's first infantry, else its first symbol. */
function defaultIcon(icons) {
  return icons.find((icon) => /^infantry$/i.test(icon.name)) ?? icons.find((icon) => /infantry/i.test(icon.name)) ?? icons[0] ?? null;
}

const PHONE_QUERY = PHONE.replace(/^@media\s*/, "");
const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";
const REVEAL_MARGIN = 40;

function matches(query) {
  return typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia(query).matches;
}

const SELECTED_FILTER = "drop-shadow(0 0 1.5px #ffffff) drop-shadow(0 0 4px #2563eb)";
// A press on a placed symbol that travels less than this is a click (edit), not a move.
const MARKER_CLICK_TOLERANCE = 6;

/**
 * @param {{ map: ReturnType<typeof import("./useMapStage.js").default>, markerLabel: (symbol: object) => string }} options
 */
export default function useSymbols({ map, markerLabel }) {
  const [open, setOpen] = useState(false);
  const [symbols, setSymbols] = useState(() => cleanSymbols(readPref("map-symbols", [])));
  const [standardId, setStandardId] = useState(() => readPref("map-symbol-standard", DEFAULT_STANDARD, STANDARD_IDS));
  const [favorites, setFavorites] = useState(() => cleanFavorites(readPref("map-symbol-favorites", {})));
  const [tab, setTab] = useState("units");
  const [catalog, setCatalog] = useState({ id: null, status: "idle", icons: [], modifiers: {} });
  const [catalogAttempt, setCatalogAttempt] = useState(0);
  const [ms, setMs] = useState(null);
  const [msFailed, setMsFailed] = useState(false);
  const [msAttempt, setMsAttempt] = useState(0);
  const [draft, setDraft] = useState({ iconId: null, settings: DEFAULT_SETTINGS, texts: {}, size: "medium" });
  const [selectedId, setSelectedId] = useState(null);
  const [placing, setPlacing] = useState(false);

  const standard = symbolStandard(standardId);
  const icon = useMemo(() => catalog.icons.find((entry) => entry.id === draft.iconId) ?? null, [catalog.icons, draft.iconId]);
  const sidc = icon && catalog.id === standard.catalog ? composeSidc(icon, draft.settings, standard) : "";

  // ---- Loading: milsymbol once anything is to be drawn, the catalogue while the palette is open
  const wantsLibrary = open || symbols.length > 0;
  useEffect(() => {
    if (!wantsLibrary || ms) return undefined;
    let cancelled = false;
    setMsFailed(false);
    loadMilsymbol()
      .then((library) => {
        if (!cancelled) setMs(() => library);
      })
      .catch((error) => {
        if (cancelled) return;
        console.warn("milsymbol could not be loaded.", error);
        setMsFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [wantsLibrary, ms, msAttempt]);

  useEffect(() => {
    if (!open) return undefined;
    let cancelled = false;
    const id = standard.catalog;
    setCatalog((current) => (current.id === id && current.status === "ready" ? current : { id, status: "loading", icons: [], modifiers: {} }));
    loadSymbolCatalog(id)
      .then((data) => {
        if (cancelled) return;
        setCatalog({ id, status: "ready", icons: data.icons ?? [], modifiers: data.modifiers ?? {} });
        setDraft((current) => (data.icons?.some((entry) => entry.id === current.iconId) ? current : { ...current, iconId: defaultIcon(data.icons ?? [])?.id ?? null }));
      })
      .catch((error) => {
        if (cancelled) return;
        console.warn(`The ${id} symbol catalogue could not be loaded.`, error);
        setCatalog({ id, status: "error", icons: [], modifiers: {} });
      });
    return () => {
      cancelled = true;
    };
  }, [open, standard.catalog, catalogAttempt]);

  useEffect(() => writePref("map-symbols", symbols), [symbols]);
  useEffect(() => writePref("map-symbol-standard", standardId), [standardId]);
  useEffect(() => writePref("map-symbol-favorites", favorites), [favorites]);

  // ---- The draft, and the placed symbol it edits ----------------------------
  // A change to the draft is also made to the selected symbol, when there is one.
  const live = useRef(null);
  live.current = { draft, selectedId, catalog, standard };
  const applyDraft = useCallback((change) => {
    const { draft: current, selectedId: editing, catalog: shown, standard: chosen } = live.current;
    const next = { ...current, ...change };
    live.current.draft = next;
    setDraft(next);
    if (!editing || shown.id !== chosen.catalog) return;
    const nextIcon = shown.icons.find((entry) => entry.id === next.iconId);
    if (!nextIcon) return;
    const nextSidc = composeSidc(nextIcon, next.settings, chosen);
    setSymbols((list) =>
      list.map((symbol) =>
        symbol.id === editing
          ? { ...symbol, icon: nextIcon.id, name: nextIcon.name, sidc: nextSidc, settings: next.settings, texts: next.texts, size: next.size }
          : symbol,
      ),
    );
  }, []);

  const chooseIcon = useCallback(
    (entry) => {
      applyDraft({ iconId: entry.id });
      setTab((current) => tabAfterChoice(current, Boolean(live.current.selectedId)));
    },
    [applyDraft],
  );
  const changeSettings = useCallback((change) => applyDraft({ settings: { ...live.current.draft.settings, ...change } }), [applyDraft]);
  const changeText = useCallback(
    (key, value) => {
      const texts = { ...live.current.draft.texts };
      if (value) texts[key] = String(value).slice(0, TEXT_MAX);
      else delete texts[key];
      applyDraft({ texts });
    },
    [applyDraft],
  );
  const chooseSize = useCallback((size) => applyDraft({ size: Object.hasOwn(SYMBOL_SIZES, size) ? size : "medium" }), [applyDraft]);

  const chooseStandard = useCallback(
    (id) => {
      if (selectedId || !STANDARD_IDS.includes(id)) return;
      setStandardId(id);
      setDraft((current) => ({ ...current, settings: settingsForStandard(current.settings, symbolStandard(id)) }));
    },
    [selectedId],
  );
  const chooseTab = useCallback((next) => {
    if (GALLERY_TABS.includes(next)) setTab(next);
  }, []);
  const toggleFavorite = useCallback((iconId) => {
    if (!iconId) return;
    setFavorites((current) => toggledFavorites(current, live.current.standard.id, iconId));
  }, []);

  // ---- Placing, selecting, removing ------------------------------------------
  const startPlacing = useCallback(() => {
    if (icon && sidc) setPlacing(true);
  }, [icon, sidc]);
  const cancelPlacing = useCallback(() => setPlacing(false), []);

  const latestRef = useRef(null);
  latestRef.current = { icon, sidc, draft, standardId };
  const revealRef = useRef(null);

  // A symbol put on the map stays unselected: the palette keeps its draft,
  // so the next tile chosen makes another symbol rather than changing this
  // one. On a phone the palette would cover the map: it closes.
  const addSymbol = useCallback((symbol) => {
    if (!symbol) return false;
    setSymbols((list) => [...list, symbol]);
    setPlacing(false);
    live.current.selectedId = null;
    setSelectedId(null);
    if (matches(PHONE_QUERY)) setOpen(false);
    return true;
  }, []);

  useEffect(() => {
    if (!placing) return undefined;
    const slot = map.mapClickRef;
    const canvas = map.getMap()?.getCanvas();
    if (canvas) canvas.style.cursor = "crosshair";
    slot.current = (lngLat) => {
      const { icon: placedIcon, draft: placedDraft, standardId: placedStandard } = latestRef.current;
      addSymbol(placedSymbol({ id: newSymbolId(), standardId: placedStandard, icon: placedIcon, draft: placedDraft }, lngLat));
    };
    return () => {
      slot.current = null;
      if (canvas) canvas.style.cursor = "";
    };
  }, [placing, map.mapClickRef, map.getMap, addSymbol]);

  // A catalogue tile or the preview dropped on the map (not on a panel or a
  // control over it, nor on the space round the globe) is placed there, with
  // the draft's settings; the tile becomes the draft's symbol.
  const { lngLatAtClient } = map;
  const dropSymbol = useCallback(
    (entry, clientX, clientY) => {
      const instance = map.getMap();
      const { catalog: shown, standard: chosen } = live.current;
      if (!instance || !entry || shown.id !== chosen.catalog) return false;
      const under = document.elementFromPoint(clientX, clientY);
      if (!(under instanceof Element) || !instance.getCanvasContainer().contains(under)) return false;
      const lngLat = lngLatAtClient(clientX, clientY);
      if (!lngLat) return false;
      const draftNow = { ...live.current.draft, iconId: entry.id };
      live.current.draft = draftNow;
      setDraft(draftNow);
      return addSymbol(placedSymbol({ id: newSymbolId(), standardId: chosen.id, icon: entry, draft: draftNow }, lngLat));
    },
    [map.getMap, lngLatAtClient, addSymbol],
  );

  // A double-clicked tile becomes the draft's symbol and is placed with the next click on the map.
  const placeWith = useCallback((entry) => {
    if (!entry) return;
    live.current.selectedId = null;
    setSelectedId(null);
    const draftNow = { ...live.current.draft, iconId: entry.id };
    live.current.draft = draftNow;
    setDraft(draftNow);
    setPlacing(true);
  }, []);

  const symbolsRef = useRef(symbols);
  symbolsRef.current = symbols;
  // The selected symbol as it was when it was clicked, for the undo.
  const originalRef = useRef(null);
  const selectSymbol = useCallback((id) => {
    const symbol = symbolsRef.current.find((entry) => entry.id === id);
    if (!symbol) return;
    originalRef.current = symbol;
    setPlacing(false);
    revealRef.current = id;
    setSelectedId(id);
    setStandardId(symbol.standard);
    setDraft({ iconId: symbol.icon, settings: symbol.settings, texts: symbol.texts, size: symbol.size });
    setTab("properties");
    setOpen(true);
  }, []);

  // Puts the selected symbol back as it was when it was clicked, keeping the
  // position it has been dragged to since.
  const revertSelected = useCallback(() => {
    const original = originalRef.current;
    if (!original || original.id !== live.current.selectedId) return;
    setSymbols((list) => list.map((symbol) => (symbol.id === original.id ? { ...original, lng: symbol.lng, lat: symbol.lat } : symbol)));
    const restored = { iconId: original.icon, settings: original.settings, texts: original.texts, size: original.size };
    live.current.draft = restored;
    setDraft(restored);
  }, []);

  // A symbol just placed or chosen on the map that the palette covers is
  // panned to the left of it.
  useEffect(() => {
    const id = revealRef.current;
    if (!id || id !== selectedId) return undefined;
    revealRef.current = null;
    const frame = requestAnimationFrame(() => {
      const instance = map.getMap();
      const symbol = symbolsRef.current.find((entry) => entry.id === id);
      const panel = document.querySelector(".map-symbol-palette");
      if (!instance || !symbol || !panel) return;
      const stage = instance.getContainer().getBoundingClientRect();
      const box = panel.getBoundingClientRect();
      const point = instance.project([symbol.lng, symbol.lat]);
      const x = stage.left + point.x;
      const y = stage.top + point.y;
      if (x < box.left - REVEAL_MARGIN || x > box.right + REVEAL_MARGIN || y < box.top - REVEAL_MARGIN || y > box.bottom + REVEAL_MARGIN) return;
      const target = box.left - 2 * REVEAL_MARGIN;
      if (target < stage.left + REVEAL_MARGIN) return;
      instance.panBy([x - target, 0], { duration: matches(REDUCED_MOTION_QUERY) ? 0 : 450 });
    });
    return () => cancelAnimationFrame(frame);
  }, [selectedId, map.getMap]);

  const newSymbol = useCallback(() => setSelectedId(null), []);
  const removeSymbol = useCallback((id) => {
    setSymbols((list) => list.filter((symbol) => symbol.id !== id));
    setSelectedId((current) => (current === id ? null : current));
  }, []);
  const deleteSelected = useCallback(() => {
    if (selectedId) removeSymbol(selectedId);
  }, [selectedId, removeSymbol]);
  const clearAll = useCallback(() => {
    setSymbols([]);
    setSelectedId(null);
  }, []);
  const moveSymbol = useCallback((id, lng, lat) => {
    setSymbols((list) => list.map((symbol) => (symbol.id === id ? { ...symbol, lng, lat } : symbol)));
  }, []);

  const togglePalette = useCallback(() => {
    setOpen((current) => {
      if (current) {
        setPlacing(false);
        setSelectedId(null);
      }
      return !current;
    });
  }, []);
  const closePalette = useCallback(() => {
    setOpen(false);
    setPlacing(false);
    setSelectedId(null);
  }, []);
  const retry = useCallback(() => {
    setCatalogAttempt((value) => value + 1);
    setMsAttempt((value) => value + 1);
  }, []);

  // ---- Markers ----------------------------------------------------------------
  const handlersRef = useRef(null);
  handlersRef.current = { select: selectSymbol, move: moveSymbol, remove: removeSymbol, label: markerLabel };
  const markersRef = useRef(new Map());
  const { getMap, getLibrary, status, styleRevision } = map;

  useEffect(() => {
    const instance = getMap();
    const library = getLibrary();
    if (!instance || !library || !ms || status !== "ready") return;
    const entries = markersRef.current;
    const present = new Set();
    for (const symbol of symbols) {
      present.add(symbol.id);
      let entry = entries.get(symbol.id);
      if (entry && entry.map !== instance) {
        entry.marker.remove();
        entries.delete(symbol.id);
        entry = null;
      }
      if (!entry) {
        const element = document.createElement("div");
        element.className = "map-symbol";
        element.tabIndex = 0;
        element.setAttribute("role", "button");
        const id = symbol.id;
        const marker = new library.Marker({ element, anchor: "top-left", draggable: true, clickTolerance: MARKER_CLICK_TOLERANCE });
        marker.on("dragend", () => {
          const { lng, lat } = marker.getLngLat().wrap();
          handlersRef.current.move(id, lng, lat);
        });
        element.addEventListener("click", (event) => {
          event.stopPropagation();
          handlersRef.current.select(id);
        });
        element.addEventListener("keydown", (event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            handlersRef.current.select(id);
          } else if (event.key === "Delete" || event.key === "Backspace") {
            event.preventDefault();
            handlersRef.current.remove(id);
          }
        });
        marker.setLngLat([symbol.lng, symbol.lat]).addTo(instance);
        entry = { marker, element, key: null, map: instance };
        entries.set(id, entry);
      }
      const key = `${symbol.standard}|${symbol.sidc}|${symbol.size}|${JSON.stringify(symbol.texts)}`;
      if (entry.key !== key) {
        const drawn = drawSymbol(ms, symbol, { onMap: true });
        entry.element.innerHTML = drawn.svg;
        entry.marker.setOffset([-drawn.anchor.x, -drawn.anchor.y]);
        entry.key = key;
      }
      entry.marker.setLngLat([symbol.lng, symbol.lat]);
      const selected = symbol.id === selectedId;
      entry.element.style.filter = selected ? SELECTED_FILTER : "";
      entry.element.setAttribute("aria-pressed", String(selected));
      entry.element.setAttribute("aria-label", handlersRef.current.label(symbol));
    }
    for (const [id, entry] of entries) {
      if (present.has(id)) continue;
      entry.marker.remove();
      entries.delete(id);
    }
  }, [symbols, selectedId, ms, status, styleRevision, getMap, getLibrary]);

  useEffect(() => {
    const entries = markersRef.current;
    return () => {
      for (const entry of entries.values()) entry.marker.remove();
      entries.clear();
    };
  }, []);

  const selected = symbols.find((symbol) => symbol.id === selectedId) ?? null;
  const canRevert = Boolean(selected && originalRef.current?.id === selected.id && !sameSymbolLook(selected, originalRef.current));

  return {
    open,
    togglePalette,
    closePalette,
    standard,
    chooseStandard,
    catalog,
    ms,
    msFailed,
    retry,
    draft,
    icon,
    sidc,
    chooseIcon,
    changeSettings,
    changeText,
    chooseSize,
    editing: selectedId != null,
    placing,
    startPlacing,
    cancelPlacing,
    placeWith,
    dropSymbol,
    newSymbol,
    deleteSelected,
    clearAll,
    count: symbols.length,
    favorites: favorites[standard.id] ?? [],
    toggleFavorite,
    tab,
    chooseTab,
    canRevert,
    revertSelected,
  };
}
