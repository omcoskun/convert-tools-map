// The symbol palette's gallery tabs: the favourites kept for the standard, the
// units and equipment sections of the catalogue, and the search list. Tiles and
// rows are drawn in the quick switch's identity, context and status; a click
// chooses, a double click places and a press-and-drag takes one to the map.
import { memo, useEffect, useMemo, useState } from "react";
import Disclosure from "../components/Disclosure.jsx";
import Icon from "../components/Icon.jsx";
import { useLanguage } from "../context.js";
import { COLORS, MONO_FONT, RADIUS, TYPE } from "../theme.js";
import { Box } from "../ui/index.js";
import { favoriteIcons, gallerySections, symbolCode } from "./symbol-gallery.js";
import { DEFAULT_SETTINGS, composeSidc, searchSymbols, symbolCategories } from "./symbols.js";
import { Glyph, Spinner, Tile, actionSx, fieldSx, useSymbolDrag } from "./symbol-parts.jsx";

const PAGE = 60;

const gridSx = { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(54px, 1fr))", gap: "6px", p: "2px" };

const SymbolRow = memo(function SymbolRow({ icon, ms, sidc, standard, selected, onChoose, onPlace, onDragStart, dragTitle }) {
  return (
    <Box
      component="button"
      type="button"
      aria-pressed={selected}
      aria-label={icon.name}
      title={`${icon.name} — ${dragTitle}`}
      onClick={() => onChoose(icon)}
      onDoubleClick={() => onPlace(icon)}
      // A finger scrolls the list; a mouse or a pen drags the symbol out.
      onPointerDown={(event) => {
        if (event.pointerType !== "touch") onDragStart(event, icon);
      }}
      sx={{
        display: "flex",
        alignItems: "center",
        gap: "8px",
        width: "100%",
        minHeight: 48,
        p: "4px 6px",
        textAlign: "left",
        border: `1px solid ${selected ? COLORS.selected : COLORS.rule}`,
        borderRadius: `${RADIUS.control}px`,
        bgcolor: selected ? COLORS.aSoft : COLORS.sheet,
        boxShadow: selected ? `0 0 0 1px ${COLORS.selected}` : "none",
        color: COLORS.ink,
        font: "inherit",
        cursor: "grab",
        "&:hover": { borderColor: COLORS.ink2 },
        "&:focus-visible": { outline: `2px solid ${COLORS.focus}`, outlineOffset: 1 },
      }}
    >
      <Box sx={{ flex: "none", display: "grid", placeItems: "center", width: 40, height: 40, overflow: "hidden", "& svg": { maxWidth: 38, maxHeight: 38, width: "auto", height: "auto", pointerEvents: "none" } }}>
        <Glyph ms={ms} sidc={sidc} standard={standard} size="small" />
      </Box>
      <Box sx={{ flex: "1 1 auto", minWidth: 0, display: "flex", flexDirection: "column", gap: "1px" }}>
        <Box component="span" sx={{ fontSize: TYPE.small, fontWeight: 650, lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {icon.name}
        </Box>
        {icon.path.length > 1 && (
          <Box component="span" sx={{ color: COLORS.muted, fontSize: TYPE.label, lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {icon.path.slice(0, -1).join(" › ")}
          </Box>
        )}
        <Box component="code" sx={{ color: COLORS.ink2, fontFamily: MONO_FONT, fontSize: TYPE.label, lineHeight: 1.3 }}>
          {symbolCode(icon)}
        </Box>
      </Box>
    </Box>
  );
});

/**
 * @param {{
 *   palette: ReturnType<typeof import("./useSymbols.js").default>,
 *   labels: ReturnType<typeof import("./symbol-labels.js").symbolLabels>,
 *   tab: "favorites" | "units" | "equipment" | "search",
 * }} props
 */
export default function SymbolGallery({ palette, labels, tab }) {
  const { text, language } = useLanguage();
  const format = useMemo(() => new Intl.NumberFormat(language === "tr" ? "tr-TR" : "en-US"), [language]);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [limit, setLimit] = useState(PAGE);

  const { standard, catalog, ms, draft } = palette;
  const dragSymbol = useSymbolDrag(palette);

  // A new standard or search starts at the first page.
  useEffect(() => setLimit(PAGE), [catalog.id, query, category]);
  useEffect(() => setCategory(""), [catalog.id]);

  const categories = useMemo(() => symbolCategories(catalog.icons), [catalog.icons]);
  const found = useMemo(() => searchSymbols(catalog.icons, query, { category: category || undefined, limit: Infinity }), [catalog.icons, query, category]);
  const shown = found.slice(0, limit);
  const tileSettings = useMemo(
    () => ({ ...DEFAULT_SETTINGS, identity: draft.settings.identity, context: draft.settings.context, status: draft.settings.status }),
    [draft.settings.identity, draft.settings.context, draft.settings.status],
  );
  const sections = useMemo(() => gallerySections(catalog.icons, tab, standard), [catalog.icons, tab, standard]);
  const favorites = useMemo(() => favoriteIcons(catalog.icons, palette.favorites), [catalog.icons, palette.favorites]);

  const tileFor = (entry) => (
    <Tile
      key={entry.id}
      icon={entry}
      ms={ms}
      sidc={composeSidc(entry, tileSettings, standard)}
      standard={standard.id}
      selected={entry.id === draft.iconId}
      onChoose={palette.chooseIcon}
      onPlace={palette.placeWith}
      onDragStart={dragSymbol}
      dragTitle={text.symbolDragTitle}
    />
  );

  if (catalog.status === "error" || palette.msFailed) {
    return (
      <Box role="alert" sx={{ display: "flex", alignItems: "center", gap: 1, p: 1, borderRadius: `${RADIUS.control}px`, bgcolor: COLORS.warnSoft, color: COLORS.warn, fontSize: TYPE.small, fontWeight: 600 }}>
        <Icon name="alert" size={16} />
        <Box component="span" sx={{ flex: 1 }}>
          {palette.msFailed ? text.symbolRendererFailed : text.symbolLoadFailed}
        </Box>
        <Box component="button" type="button" onClick={palette.retry} sx={{ ...actionSx, color: COLORS.warn, borderColor: "currentColor" }}>
          {text.mapRetry}
        </Box>
      </Box>
    );
  }

  if (catalog.status !== "ready") {
    return (
      <Box role="status" sx={{ display: "flex", alignItems: "center", gap: 1, color: COLORS.muted, fontSize: TYPE.small }}>
        <Spinner />
        {text.symbolLoading}
      </Box>
    );
  }

  if (tab === "favorites") {
    if (favorites.length === 0) {
      return (
        <Box component="p" sx={{ m: 0, color: COLORS.muted, fontSize: TYPE.small, lineHeight: 1.45 }}>
          {text.symbolFavoritesEmpty}
        </Box>
      );
    }
    return (
      <Box role="group" aria-label={labels.tabs.favorites} sx={gridSx}>
        {favorites.map(tileFor)}
      </Box>
    );
  }

  if (tab === "units" || tab === "equipment") {
    return (
      <Box sx={{ display: "flex", flexDirection: "column" }}>
        {sections.map((section) => (
          <Box key={section.id} data-gallery-section={section.id}>
            <Disclosure title={`${labels.groups[section.id]} (${format.format(section.icons.length)})`} defaultOpen>
              <Box role="group" aria-label={labels.groups[section.id]} sx={gridSx}>
                {section.icons.map(tileFor)}
              </Box>
            </Disclosure>
          </Box>
        ))}
      </Box>
    );
  }

  if (tab === "search") {
    return (
      <>
        <Box sx={{ display: "grid", gridTemplateColumns: "1fr", gap: 1 }}>
          <Box
            component="input"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={text.symbolSearch}
            aria-label={text.symbolSearch}
            sx={fieldSx}
          />
          <Box component="select" value={category} onChange={(event) => setCategory(event.target.value)} aria-label={text.symbolCategory} sx={fieldSx}>
            <option value="">{text.symbolCategoryAll.replace("{count}", format.format(catalog.icons.length))}</option>
            {categories.map((entry) => (
              <option key={entry.category} value={entry.category}>
                {`${entry.category} (${format.format(entry.count)})`}
              </option>
            ))}
          </Box>
        </Box>
        <Box component="p" role="status" sx={{ m: "8px 0 6px", color: COLORS.muted, fontSize: TYPE.meta }}>
          {found.length === 0 ? text.symbolNoResults : text.symbolResults.replace("{count}", format.format(found.length))}
        </Box>
        <Box component="ul" aria-label={text.symbolCatalogue} sx={{ listStyle: "none", m: 0, p: 0, display: "grid", gap: "4px" }}>
          {shown.map((entry) => (
            <li key={entry.id}>
              <SymbolRow
                icon={entry}
                ms={ms}
                sidc={composeSidc(entry, tileSettings, standard)}
                standard={standard.id}
                selected={entry.id === draft.iconId}
                onChoose={palette.chooseIcon}
                onPlace={palette.placeWith}
                onDragStart={dragSymbol}
                dragTitle={text.symbolDragTitle}
              />
            </li>
          ))}
        </Box>
        {found.length > shown.length && (
          <Box component="button" type="button" onClick={() => setLimit((value) => value + PAGE)} sx={{ ...actionSx, mt: "6px", width: "100%", justifyContent: "center" }}>
            {text.symbolShowMore}
          </Box>
        )}
      </>
    );
  }

  return null;
}
