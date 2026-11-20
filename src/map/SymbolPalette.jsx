// The military symbol palette, after map.army: a header with the standard, a
// quick identity and status switch, tabs for favourites, units, equipment,
// search and properties, and a footer with the chosen symbol, its star and the
// place buttons. The gallery and the properties live in their own files; this
// shell keeps the panel's fit to the map, Esc, the clear confirmation and the
// bar it shrinks to while a symbol is placed.
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import Icon from "../components/Icon.jsx";
import { useLanguage } from "../context.js";
import { nextIndexForKey } from "../lib/roving.js";
import { COLORS, MONO_FONT, RADIUS, TYPE } from "../theme.js";
import { Box, visuallyHidden } from "../ui/index.js";
import SymbolEditor from "./SymbolEditor.jsx";
import SymbolGallery from "./SymbolGallery.jsx";
import { GALLERY_TABS, symbolCode } from "./symbol-gallery.js";
import { symbolLabels } from "./symbol-labels.js";
import { Glyph, Labeled, actionSx, fieldSx, panelSx, primarySx } from "./symbol-parts.jsx";
import { SYMBOL_STANDARDS, identityChoices } from "./symbols.js";

const ROOM_BELOW = 28;
const MIN_HEIGHT = 200;
const SOURCE_URL = "https://github.com/omcoskun/milsymbol";

/**
 * @param {{
 *   palette: ReturnType<typeof import("./useSymbols.js").default>,
 *   open: boolean,
 *   onClose: () => void,
 * }} props
 */
export default function SymbolPalette({ palette, open, onClose }) {
  const { text, language } = useLanguage();
  const labels = useMemo(() => symbolLabels(text), [text]);
  const format = useMemo(() => new Intl.NumberFormat(language === "tr" ? "tr-TR" : "en-US"), [language]);
  const panelRef = useRef(null);
  const tabRefs = useRef([]);
  const [maxHeight, setMaxHeight] = useState(null);
  const [confirmClear, setConfirmClear] = useState(false);

  const { standard, ms, draft, icon, sidc, editing, placing } = palette;
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const placingRef = useRef(placing);
  placingRef.current = placing;
  const cancelRef = useRef(palette.cancelPlacing);
  cancelRef.current = palette.cancelPlacing;

  useLayoutEffect(() => {
    if (!open) return undefined;
    function fit() {
      const panel = panelRef.current;
      const box = panel?.offsetParent;
      const stage = box?.offsetParent;
      if (!panel || !box || !stage) return;
      setMaxHeight(Math.max(MIN_HEIGHT, stage.clientHeight - box.offsetTop - panel.offsetTop - ROOM_BELOW));
    }
    fit();
    // The map area changes height without the window (a phone's tool sheet
    // opening or closing), so the panel watches the stage itself.
    const stage = panelRef.current?.offsetParent?.offsetParent;
    const observer = typeof ResizeObserver === "function" && stage ? new ResizeObserver(fit) : null;
    observer?.observe(stage);
    window.addEventListener("resize", fit);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", fit);
    };
  }, [open, placing]);

  // Esc stops placing first, then closes the palette.
  useEffect(() => {
    if (!open) return undefined;
    function onKey(event) {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      event.preventDefault();
      if (placingRef.current) cancelRef.current();
      else onCloseRef.current();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    if (palette.count === 0) setConfirmClear(false);
  }, [palette.count]);

  if (!open) return null;

  const settings = draft.settings;
  const isFavorite = palette.favorites.includes(icon?.id);
  const statusChoices = ["present", "planned"];
  if (!statusChoices.includes(settings.status)) statusChoices.push(settings.status);
  const countText = text.symbolCount.replace("{count}", format.format(palette.count));

  function onTabKey(event) {
    const current = tabRefs.current.indexOf(event.target);
    const next = nextIndexForKey(event, current < 0 ? GALLERY_TABS.indexOf(palette.tab) : current, GALLERY_TABS.length);
    if (next == null) return;
    event.preventDefault();
    tabRefs.current[next]?.focus();
    palette.chooseTab(GALLERY_TABS[next]);
  }

  if (placing) {
    return (
      <Box
        ref={panelRef}
        className="map-symbol-palette"
        role="dialog"
        aria-label={text.mapSymbols}
        sx={{ ...panelSx, width: 300, display: "flex", alignItems: "center", gap: 1, p: "8px 8px 8px 12px" }}
      >
        <Box sx={{ flex: "none", display: "grid", placeItems: "center", width: 44, height: 36, "& svg": { maxWidth: 44, maxHeight: 36, width: "auto", height: "auto" } }}>
          <Glyph ms={ms} sidc={sidc} standard={standard.id} size="small" />
        </Box>
        <Box component="p" role="status" sx={{ m: 0, flex: 1, minWidth: 0, fontSize: TYPE.small, fontWeight: 650, lineHeight: 1.35 }}>
          {text.symbolPlacing}
        </Box>
        <Box component="button" type="button" onClick={palette.cancelPlacing} sx={actionSx}>
          {text.mapCancel}
        </Box>
      </Box>
    );
  }

  return (
    <Box
      ref={panelRef}
      className="map-symbol-palette"
      role="dialog"
      aria-label={text.mapSymbols}
      sx={{ ...panelSx, display: "flex", flexDirection: "column", p: 0, overflow: "hidden", maxHeight: maxHeight ?? undefined }}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, flex: "none", p: "10px 8px 8px 14px", borderBottom: `1px solid ${COLORS.rule}` }}>
        <Box component="h2" sx={{ m: 0, flex: 1, fontSize: TYPE.body, fontWeight: 700 }}>
          {text.mapSymbols}
        </Box>
        <Box
          component="select"
          id="symbol-standard"
          aria-label={text.symbolStandard}
          value={standard.id}
          disabled={editing}
          onChange={(event) => palette.chooseStandard(event.target.value)}
          sx={{ ...fieldSx, flex: "none", width: "auto", maxWidth: 150 }}
        >
          {SYMBOL_STANDARDS.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </Box>
        <Box
          component="button"
          type="button"
          aria-label={text.symbolClose}
          title={text.symbolClose}
          onClick={onClose}
          sx={{ display: "grid", placeItems: "center", width: 30, height: 30, border: 0, borderRadius: `${RADIUS.control}px`, bgcolor: "transparent", color: COLORS.muted, cursor: "pointer", "&:hover": { bgcolor: COLORS.paper2, color: COLORS.ink }, "&:focus-visible": { outline: `2px solid ${COLORS.focus}` } }}
        >
          <Icon name="clear" size={16} />
        </Box>
      </Box>

      {palette.tab !== "properties" && (
        <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1, p: "8px 12px 0", flex: "none" }}>
          <Labeled label={text.symbolIdentity} htmlFor="symbol-quick-identity">
            <Box component="select" id="symbol-quick-identity" value={settings.identity} onChange={(event) => palette.changeSettings({ identity: event.target.value })} sx={fieldSx}>
              {identityChoices(standard).map(({ value }) => (
                <option key={value} value={value}>
                  {labels.identities[value]}
                </option>
              ))}
            </Box>
          </Labeled>
          <Labeled label={text.symbolStatus} htmlFor="symbol-quick-status">
            <Box component="select" id="symbol-quick-status" value={settings.status} onChange={(event) => palette.changeSettings({ status: event.target.value })} sx={fieldSx}>
              {statusChoices.map((value) => (
                <option key={value} value={value}>
                  {labels.statuses[value]}
                </option>
              ))}
            </Box>
          </Labeled>
        </Box>
      )}

      <Box
        role="tablist"
        aria-label={text.symbolTabs}
        onKeyDown={onTabKey}
        sx={{ display: "flex", gap: "2px", p: "8px 8px 0", flex: "none", borderBottom: `1px solid ${COLORS.rule}` }}
      >
        {GALLERY_TABS.map((id, index) => {
          const selected = palette.tab === id;
          return (
            <Box
              key={id}
              ref={(node) => {
                tabRefs.current[index] = node;
              }}
              component="button"
              type="button"
              role="tab"
              id={`symbol-tab-${id}`}
              aria-selected={selected}
              aria-controls="symbol-tab-panel"
              tabIndex={selected ? 0 : -1}
              onClick={() => palette.chooseTab(id)}
              title={id === "favorites" ? labels.tabs.favorites : undefined}
              sx={{
                flex: "1 1 auto",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "4px",
                px: "6px",
                minHeight: 34,
                border: 0,
                borderBottom: `2px solid ${selected ? COLORS.a : "transparent"}`,
                bgcolor: "transparent",
                color: selected ? COLORS.a : COLORS.muted,
                font: "inherit",
                fontSize: TYPE.meta,
                fontWeight: 650,
                whiteSpace: "nowrap",
                cursor: "pointer",
                "&:hover": { color: COLORS.ink },
                "&:focus-visible": { outline: `2px solid ${COLORS.focus}`, outlineOffset: -2 },
              }}
            >
              {id === "favorites" ? (
                <>
                  <Icon name="star" size={16} />
                  <Box component="span" sx={visuallyHidden}>
                    {labels.tabs.favorites}
                  </Box>
                </>
              ) : (
                labels.tabs[id]
              )}
            </Box>
          );
        })}
      </Box>

      <Box data-palette="body" sx={{ flex: "1 1 auto", minHeight: 0, overflowY: "auto", overscrollBehavior: "contain", scrollbarWidth: "thin", p: 1.5 }}>
        <Box role="tabpanel" id="symbol-tab-panel" aria-labelledby={`symbol-tab-${palette.tab}`}>
          {palette.tab === "properties" ? <SymbolEditor palette={palette} labels={labels} /> : <SymbolGallery palette={palette} labels={labels} tab={palette.tab} />}
        </Box>

        <Box sx={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 1, mt: 2, pt: 1.25, borderTop: `1px solid ${COLORS.rule}`, color: COLORS.muted, fontSize: TYPE.meta }}>
          {confirmClear ? (
            <>
              <Box component="span" role="alert" sx={{ flex: 1, color: COLORS.ink, fontWeight: 650 }}>
                {text.symbolClearAsk.replace("{count}", format.format(palette.count))}
              </Box>
              <Box
                component="button"
                type="button"
                onClick={() => {
                  palette.clearAll();
                  setConfirmClear(false);
                }}
                sx={{ ...actionSx, minHeight: 30, color: COLORS.error }}
              >
                {text.symbolClearYes}
              </Box>
              <Box component="button" type="button" onClick={() => setConfirmClear(false)} sx={{ ...actionSx, minHeight: 30 }}>
                {text.mapCancel}
              </Box>
            </>
          ) : (
            <>
              <Box component="span" sx={{ flex: 1 }}>
                {countText}
              </Box>
              {palette.count > 0 && (
                <Box component="button" type="button" onClick={() => setConfirmClear(true)} sx={{ ...actionSx, minHeight: 30, fontSize: TYPE.meta }}>
                  {text.symbolClearAll}
                </Box>
              )}
            </>
          )}
        </Box>
        <Box component="p" sx={{ m: "8px 0 0", color: COLORS.faint, fontSize: TYPE.label }}>
          <Box component="a" href={SOURCE_URL} target="_blank" rel="noopener noreferrer" sx={{ color: "inherit" }}>
            {text.symbolSource}
          </Box>
        </Box>
      </Box>

      {/* Actions: always in view, whatever the body's scroll. */}
      <Box data-palette="actions" sx={{ flex: "none", p: "10px 12px 12px", borderTop: `1px solid ${COLORS.rule}`, bgcolor: COLORS.paper }}>
        {icon && (
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: "8px" }}>
            <Box sx={{ flex: "none", display: "grid", placeItems: "center", width: 44, height: 36, "& svg": { maxWidth: 44, maxHeight: 36, width: "auto", height: "auto" } }}>
              <Glyph ms={ms} sidc={sidc} standard={standard.id} texts={draft.texts} size="small" />
            </Box>
            <Box sx={{ flex: "1 1 auto", minWidth: 0, display: "flex", flexDirection: "column", gap: "1px" }}>
              <Box component="span" sx={{ fontSize: TYPE.small, fontWeight: 700, lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {icon.name}
              </Box>
              <Box component="code" sx={{ color: COLORS.muted, fontFamily: MONO_FONT, fontSize: TYPE.label, lineHeight: 1.3 }}>
                {symbolCode(icon)}
              </Box>
            </Box>
            <Box
              component="button"
              type="button"
              aria-pressed={isFavorite}
              aria-label={isFavorite ? text.symbolFavoriteRemove : text.symbolFavoriteAdd}
              title={isFavorite ? text.symbolFavoriteRemove : text.symbolFavoriteAdd}
              onClick={() => palette.toggleFavorite(icon.id)}
              sx={{
                flex: "none",
                display: "grid",
                placeItems: "center",
                width: 34,
                height: 34,
                border: 0,
                borderRadius: `${RADIUS.control}px`,
                bgcolor: "transparent",
                color: isFavorite ? COLORS.a : COLORS.muted,
                cursor: "pointer",
                "&:hover": { bgcolor: COLORS.paper2, color: COLORS.a },
                "&:focus-visible": { outline: `2px solid ${COLORS.focus}` },
              }}
            >
              <Icon name="star" size={18} filled={isFavorite} />
            </Box>
          </Box>
        )}
        {/* One row: the place button takes the room the edit buttons leave. */}
        <Box sx={{ display: "flex", gap: 0.75, "& > button": { px: "11px", whiteSpace: "nowrap" } }}>
          <Box component="button" type="button" onClick={palette.startPlacing} disabled={!icon || !sidc || !ms} sx={{ ...primarySx, flex: "1 1 auto", justifyContent: "center", minWidth: 0 }}>
            <Icon name="plus" size={16} />
            {editing ? text.symbolPlaceCopy : text.symbolPlace}
          </Box>
          {editing && (
            <>
              <Box component="button" type="button" onClick={palette.deleteSelected} sx={{ ...actionSx, color: COLORS.error }}>
                {text.symbolDelete}
              </Box>
              <Box component="button" type="button" onClick={palette.newSymbol} sx={actionSx}>
                {text.symbolNew}
              </Box>
            </>
          )}
        </Box>
        <Box component="p" sx={{ m: "8px 0 0", color: COLORS.muted, fontSize: TYPE.label, lineHeight: 1.35 }}>
          {text.symbolDragHint}
        </Box>
      </Box>
    </Box>
  );
}
