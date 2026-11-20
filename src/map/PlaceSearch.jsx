// The place search panel: a place name, an address or a coordinate pair is
// looked up on OpenStreetMap's Nominatim on submit (never while typing), and
// the answers are listed by name and detail. Choosing one frames the map on
// it. Esc, the close button and a press outside close the panel; the shared
// search queue keeps requests a second apart and caches them.

import { useEffect, useRef, useState } from "react";
import Icon from "../components/Icon.jsx";
import { fill, useConfig, useLanguage } from "../context.js";
import { COLORS, PHONE, RADIUS, SHADOW, TYPE, UI_FONT } from "../theme.js";
import { Box } from "../ui/index.js";
import { MAX_QUERY, cleanQuery, coordinatePlace, createPlaceSearch, parsePlaces, searchUrl } from "./place-search.js";

let shared = null;

/** The page's one search queue, its request spacing from config.json. */
function placeSearch(search) {
  if (shared == null) {
    shared = createPlaceSearch({
      fetchJson: async (url) => {
        const response = await fetch(url, { headers: { Accept: "application/json" } });
        if (!response.ok) throw new Error(`The search answered ${response.status}.`);
        return response.json();
      },
      minIntervalMs: search.minIntervalMs,
    });
  }
  return shared;
}

const sectionTitleSx = { m: 0, fontSize: TYPE.label, fontWeight: 650, letterSpacing: "0.08em", textTransform: "uppercase", color: COLORS.muted };

const iconButtonSx = {
  display: "grid",
  placeItems: "center",
  flex: "none",
  width: 28,
  height: 28,
  border: 0,
  borderRadius: `${RADIUS.control}px`,
  bgcolor: "transparent",
  color: COLORS.muted,
  cursor: "pointer",
  "&:hover": { bgcolor: COLORS.paper2, color: COLORS.ink },
  "&:focus-visible": { outline: `2px solid ${COLORS.focus}`, outlineOffset: 0 },
  [PHONE]: { width: 40, height: 40 },
};

const inputSx = {
  flex: 1,
  minWidth: 0,
  height: 36,
  boxSizing: "border-box",
  px: "10px",
  border: `1px solid ${COLORS.rule2}`,
  borderRadius: `${RADIUS.control}px`,
  bgcolor: COLORS.sheet,
  color: COLORS.ink,
  font: "inherit",
  fontSize: TYPE.small,
  "&::placeholder": { color: COLORS.faint, opacity: 1 },
  // The panel has its own clear button; the browser's would be a second one.
  "&::-webkit-search-cancel-button": { display: "none" },
  "&:focus-visible": { outline: `2px solid ${COLORS.focus}`, outlineOffset: 0 },
  [PHONE]: { height: 44, fontSize: 16 },
};

const submitSx = {
  display: "inline-flex",
  alignItems: "center",
  gap: "6px",
  flex: "none",
  height: 36,
  px: "12px",
  border: 0,
  borderRadius: `${RADIUS.control}px`,
  bgcolor: COLORS.a,
  color: "#ffffff",
  font: "inherit",
  fontSize: TYPE.small,
  fontWeight: 650,
  whiteSpace: "nowrap",
  cursor: "pointer",
  "&:hover": { bgcolor: COLORS.aInk },
  "&:focus-visible": { outline: `2px solid ${COLORS.focus}`, outlineOffset: 1 },
  [PHONE]: { height: 44 },
};

const resultSx = {
  display: "flex",
  flexDirection: "column",
  gap: "2px",
  width: "100%",
  p: "6px 8px",
  border: 0,
  borderRadius: `${RADIUS.control}px`,
  bgcolor: "transparent",
  color: COLORS.ink,
  font: "inherit",
  fontSize: TYPE.small,
  textAlign: "left",
  cursor: "pointer",
  "&:hover": { bgcolor: COLORS.paper2 },
  "&:focus-visible": { outline: `2px solid ${COLORS.focus}`, outlineOffset: 0 },
  "&[aria-current='true']": { bgcolor: COLORS.selected, color: COLORS.onSelected },
  "&[aria-current='true'] .place-detail": { color: COLORS.onSelected, opacity: 0.8 },
  [PHONE]: { minHeight: 44 },
};

/**
 * @param {{
 *   open: boolean,
 *   onClose: () => void,
 *   returnFocusRef?: { current: HTMLElement | null },
 *   onChoose: (place: import("./place-search.js").Place) => void,
 *   onClear: () => void,
 *   pinned?: boolean,
 * }} props
 *   pinned: a pin of an earlier choice stays on the map, so the clear button
 *   stays too.
 */
export default function PlaceSearch({ open, onClose, returnFocusRef, onChoose, onClear, pinned = false }) {
  const { map } = useConfig();
  const { text, language } = useLanguage();
  const search = map.search;
  const panelRef = useRef(null);
  const inputRef = useRef(null);
  const resultRefs = useRef([]);
  const requestRef = useRef(0);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("idle");
  const [places, setPlaces] = useState([]);
  const [chosenId, setChosenId] = useState(null);

  useEffect(() => {
    if (!open) return undefined;
    inputRef.current?.focus();
    function onPointer(event) {
      if (panelRef.current?.contains(event.target) || returnFocusRef?.current?.contains(event.target)) return;
      onCloseRef.current();
    }
    function onKey(event) {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
      }
    }
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, returnFocusRef]);

  if (!open) return null;

  function choose(place) {
    setChosenId(place.id);
    onChoose(place);
  }

  async function onSubmit(event) {
    event.preventDefault();
    const q = cleanQuery(query);
    if (q === "") return;
    const request = ++requestRef.current;
    const direct = coordinatePlace(q);
    if (direct) {
      setPlaces([direct]);
      setStatus("done");
      choose(direct);
      return;
    }
    setStatus("loading");
    try {
      const json = await placeSearch(search).search(searchUrl(search, q, language));
      if (request !== requestRef.current) return;
      setPlaces(parsePlaces(json, search.limit));
      setStatus("done");
    } catch {
      if (request !== requestRef.current) return;
      setPlaces([]);
      setStatus("error");
    }
  }

  function clearSearch() {
    setQuery("");
    setPlaces([]);
    setStatus("idle");
    setChosenId(null);
    onClear();
    inputRef.current?.focus();
  }

  function onInputKey(event) {
    if (event.key !== "ArrowDown" || places.length === 0) return;
    event.preventDefault();
    resultRefs.current[0]?.focus();
  }

  function onResultKey(event, index) {
    const forward = event.key === "ArrowDown";
    const backward = event.key === "ArrowUp";
    if (!forward && !backward) return;
    event.preventDefault();
    const target = forward ? resultRefs.current[index + 1] : index === 0 ? inputRef.current : resultRefs.current[index - 1];
    target?.focus();
  }

  const statusText =
    status === "loading" ? text.searchLoading : status === "error" ? text.searchFailed : status === "done" && places.length === 0 ? text.searchNoResults : "";

  return (
    <Box
      ref={panelRef}
      className="map-place-search"
      role="dialog"
      aria-label={text.mapSearch}
      sx={{
        width: 320,
        maxWidth: "calc(100vw - 32px)",
        overflowY: "auto",
        overscrollBehavior: "contain",
        boxSizing: "border-box",
        p: 1.5,
        border: `1px solid ${COLORS.rule2}`,
        borderRadius: `${RADIUS.card}px`,
        bgcolor: COLORS.glass,
        boxShadow: SHADOW.float,
        color: COLORS.ink,
        fontFamily: UI_FONT,
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1, mb: 1 }}>
        <Box component="h2" sx={sectionTitleSx}>
          {text.mapSearch}
        </Box>
        <Box component="button" type="button" aria-label={text.searchClose} onClick={onClose} sx={iconButtonSx}>
          <Icon name="clear" size={16} />
        </Box>
      </Box>
      <Box component="form" role="search" onSubmit={onSubmit} sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
        <Box
          component="input"
          ref={inputRef}
          type="search"
          aria-label={text.searchLabel}
          placeholder={text.searchPlaceholder}
          maxLength={MAX_QUERY}
          autoComplete="off"
          enterKeyHint="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={onInputKey}
          sx={inputSx}
        />
        {(query !== "" || pinned) && (
          <Box component="button" type="button" aria-label={text.searchClear} onClick={clearSearch} sx={iconButtonSx}>
            <Icon name="clear" size={16} />
          </Box>
        )}
        <Box component="button" type="submit" sx={submitSx}>
          <Icon name="search" size={16} />
          {text.searchSubmit}
        </Box>
      </Box>
      <Box
        component="p"
        role="status"
        sx={{
          m: 0,
          mt: statusText === "" ? 0 : 1,
          mb: statusText === "" ? 0 : 1,
          color: status === "error" ? COLORS.error : COLORS.muted,
          fontSize: TYPE.small,
          lineHeight: 1.4,
          "&:empty": { display: "none" },
        }}
      >
        {statusText}
      </Box>
      {places.length > 0 && (
        <Box
          component="ul"
          aria-label={fill(text.searchResults, { count: places.length })}
          sx={{ listStyle: "none", m: 0, p: 0, display: "flex", flexDirection: "column", gap: "2px", maxHeight: 320, overflowY: "auto", overscrollBehavior: "contain" }}
        >
          {places.map((place, index) => (
            <Box component="li" key={place.id}>
              <Box
                component="button"
                type="button"
                ref={(node) => {
                  resultRefs.current[index] = node;
                }}
                aria-current={place.id === chosenId ? "true" : undefined}
                onClick={() => choose(place)}
                onKeyDown={(event) => onResultKey(event, index)}
                sx={resultSx}
              >
                <Box component="span" sx={{ fontWeight: 650 }}>
                  {place.name}
                </Box>
                {place.detail !== "" && (
                  <Box component="span" className="place-detail" sx={{ color: COLORS.muted, fontSize: TYPE.meta }}>
                    {place.detail}
                  </Box>
                )}
              </Box>
            </Box>
          ))}
        </Box>
      )}
      <Box component="p" sx={{ m: 0, mt: 1.5, color: COLORS.muted, fontSize: TYPE.meta }}>
        {text.searchCredit}
        {search.attribution.map((entry) => (
          <Box component="span" key={entry.href}>
            {" · "}
            <Box
              component="a"
              href={entry.href}
              target="_blank"
              rel="noopener noreferrer"
              sx={{ color: "inherit", "&:hover": { color: COLORS.ink }, "&:focus-visible": { outline: `2px solid ${COLORS.focus}`, outlineOffset: 1 } }}
            >
              {entry.text}
            </Box>
          </Box>
        ))}
      </Box>
    </Box>
  );
}
