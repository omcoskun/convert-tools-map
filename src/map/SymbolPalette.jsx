// The military symbol palette: choose a standard, find a symbol in its
// catalogue, set its amplifiers (identity, context, status, echelon or
// mobility, headquarters / task force / feint-dummy, sector modifiers, the
// text fields and the size) and place it on the map. A placed symbol clicked
// on the map comes back here to be edited, and every change is made to it at
// once. Unlike the layers panel it stays open while the map is used; Esc and
// its close button close it, and while a symbol is being placed it shrinks to
// a bar so the map is free.
import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import Disclosure from "../components/Disclosure.jsx";
import Icon from "../components/Icon.jsx";
import Segmented from "../components/Segmented.jsx";
import { useLanguage } from "../context.js";
import { nextIndexForKey } from "../lib/roving.js";
import { COLORS, MONO_FONT, PHONE, RADIUS, SHADOW, TYPE, UI_FONT } from "../theme.js";
import { Box } from "../ui/index.js";
import { drawSymbol } from "./milsymbol.js";
import { symbolLabels } from "./symbol-labels.js";
import {
  DEFAULT_SETTINGS,
  ECHELONS,
  MOBILITIES,
  SYMBOL_STANDARDS,
  STATUSES,
  TEXT_FIELDS,
  TEXT_MAX,
  composeSidc,
  identityChoices,
  searchSymbols,
  symbolCategories,
  symbolOffers,
} from "./symbols.js";

const PAGE = 120;
const ROOM_BELOW = 28;
const MIN_HEIGHT = 200;
const SOURCE_URL = "https://github.com/omcoskun/milsymbol";

const sectionTitleSx = { m: 0, mb: 0.75, fontSize: TYPE.label, fontWeight: 650, letterSpacing: "0.08em", textTransform: "uppercase", color: COLORS.muted };

const fieldSx = {
  boxSizing: "border-box",
  width: "100%",
  minWidth: 0,
  height: 34,
  px: 1,
  border: `1px solid ${COLORS.rule2}`,
  borderRadius: `${RADIUS.control}px`,
  bgcolor: COLORS.sheet,
  color: COLORS.ink,
  font: "inherit",
  fontSize: TYPE.small,
  "&:focus-visible": { outline: `2px solid ${COLORS.focus}`, outlineOffset: 0, borderColor: COLORS.focus },
  "&:disabled": { opacity: 0.6 },
  [PHONE]: { height: 40, fontSize: 16 },
};

const pillSx = {
  display: "inline-flex",
  alignItems: "center",
  gap: "6px",
  minHeight: 30,
  px: "10px",
  border: `1px solid ${COLORS.rule2}`,
  borderRadius: `${RADIUS.pill}px`,
  bgcolor: COLORS.sheet,
  color: COLORS.ink2,
  font: "inherit",
  fontSize: TYPE.meta,
  fontWeight: 600,
  cursor: "pointer",
  "&:hover": { borderColor: COLORS.ink2, color: COLORS.ink },
  "&[aria-checked='true'], &[aria-pressed='true']": { bgcolor: COLORS.selected, borderColor: COLORS.selected, color: COLORS.onSelected },
  "&:focus-visible": { outline: `2px solid ${COLORS.focus}`, outlineOffset: 1 },
  [PHONE]: { minHeight: 36 },
};

const actionSx = {
  ...pillSx,
  minHeight: 34,
  px: "14px",
  fontSize: TYPE.small,
  fontWeight: 650,
  color: COLORS.ink,
  "&:disabled": { opacity: 0.45, cursor: "default" },
  [PHONE]: { minHeight: 40 },
};

const primarySx = {
  ...actionSx,
  bgcolor: COLORS.a,
  borderColor: COLORS.a,
  color: "#ffffff",
  "&:hover:not(:disabled)": { bgcolor: COLORS.aInk, borderColor: COLORS.aInk, color: "#ffffff" },
};

/** milsymbol's SVG of a code; milsymbol escapes the texts it writes. */
const Glyph = memo(function Glyph({ ms, sidc, standard, texts, size }) {
  const markup = useMemo(() => {
    if (!ms || !sidc) return "";
    try {
      return drawSymbol(ms, { sidc, standard, texts, size }).svg;
    } catch {
      return "";
    }
  }, [ms, sidc, standard, texts, size]);
  return <Box component="span" aria-hidden="true" sx={{ display: "grid", placeItems: "center", lineHeight: 0 }} dangerouslySetInnerHTML={{ __html: markup }} />;
});

/** A wrapping radio group of pills: Tab enters at the checked one, the arrows move and choose. */
function ChoicePills({ label, options, value, onChoose }) {
  const refs = useRef([]);
  refs.current.length = options.length;
  const checkedIndex = options.findIndex((option) => option.value === value);
  function onKey(event) {
    const current = refs.current.indexOf(event.target);
    const next = nextIndexForKey(event, current < 0 ? checkedIndex : current, options.length);
    if (next == null) return;
    event.preventDefault();
    refs.current[next]?.focus();
    onChoose(options[next].value);
  }
  return (
    <Box role="radiogroup" aria-label={label} onKeyDown={onKey} sx={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
      {options.map((option, index) => (
        <Box
          key={option.value}
          ref={(node) => {
            refs.current[index] = node;
          }}
          component="button"
          type="button"
          role="radio"
          aria-checked={option.value === value}
          tabIndex={index === (checkedIndex < 0 ? 0 : checkedIndex) ? 0 : -1}
          onClick={() => onChoose(option.value)}
          sx={pillSx}
        >
          {option.text}
        </Box>
      ))}
    </Box>
  );
}

function Labeled({ label, children, htmlFor }) {
  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: "4px", minWidth: 0 }}>
      <Box component="label" htmlFor={htmlFor} sx={{ color: COLORS.muted, fontSize: TYPE.meta, fontWeight: 600 }}>
        {label}
      </Box>
      {children}
    </Box>
  );
}

const Tile = memo(function Tile({ icon, ms, sidc, standard, selected, onChoose }) {
  return (
    <Box
      component="button"
      type="button"
      aria-pressed={selected}
      aria-label={icon.name}
      title={icon.name}
      onClick={() => onChoose(icon)}
      sx={{
        display: "grid",
        placeItems: "center",
        height: 50,
        p: "3px",
        border: `1px solid ${selected ? COLORS.selected : COLORS.rule}`,
        borderRadius: `${RADIUS.control}px`,
        bgcolor: selected ? COLORS.aSoft : COLORS.sheet,
        boxShadow: selected ? `0 0 0 1px ${COLORS.selected}` : "none",
        cursor: "pointer",
        "&:hover": { borderColor: COLORS.ink2 },
        "&:focus-visible": { outline: `2px solid ${COLORS.focus}`, outlineOffset: 1 },
        "& svg": { maxWidth: "100%", maxHeight: 42, width: "auto", height: "auto" },
      }}
    >
      <Glyph ms={ms} sidc={sidc} standard={standard} size="small" />
    </Box>
  );
});

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
  const [maxHeight, setMaxHeight] = useState(null);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [limit, setLimit] = useState(PAGE);
  const [confirmClear, setConfirmClear] = useState(false);

  const { standard, catalog, ms, draft, icon, sidc, editing, placing } = palette;
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
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
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

  // A new standard or search starts at the first page.
  useEffect(() => setLimit(PAGE), [catalog.id, query, category]);
  useEffect(() => setCategory(""), [catalog.id]);
  useEffect(() => {
    if (palette.count === 0) setConfirmClear(false);
  }, [palette.count]);

  const categories = useMemo(() => symbolCategories(catalog.icons), [catalog.icons]);
  const found = useMemo(() => searchSymbols(catalog.icons, query, { category: category || undefined, limit: Infinity }), [catalog.icons, query, category]);
  const shown = found.slice(0, limit);
  const tileSettings = useMemo(
    () => ({ ...DEFAULT_SETTINGS, identity: draft.settings.identity, context: draft.settings.context }),
    [draft.settings.identity, draft.settings.context],
  );

  if (!open) return null;

  const offers = icon ? symbolOffers(icon, standard) : null;
  const modifierLists = offers?.modifiers ? (catalog.modifiers?.[icon.symbolSet] ?? {}) : {};
  const settings = draft.settings;
  const change = palette.changeSettings;
  const none = text.symbolNone;
  const countText = text.symbolCount.replace("{count}", format.format(palette.count));

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
      sx={{ ...panelSx, maxHeight: maxHeight ?? undefined }}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1.25 }}>
        <Box component="h2" sx={{ m: 0, flex: 1, fontSize: TYPE.body, fontWeight: 700 }}>
          {text.mapSymbols}
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

      <Labeled label={text.symbolStandard} htmlFor="symbol-standard">
        <Box component="select" id="symbol-standard" value={standard.id} disabled={editing} onChange={(event) => palette.chooseStandard(event.target.value)} sx={fieldSx}>
          {SYMBOL_STANDARDS.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </Box>
      </Labeled>
      {editing && (
        <Box component="p" sx={{ m: "6px 0 0", color: COLORS.muted, fontSize: TYPE.meta, lineHeight: 1.4 }}>
          {text.symbolEditing}
        </Box>
      )}

      {/* Preview */}
      <Box sx={{ display: "flex", gap: 1.25, alignItems: "center", mt: 1.5, p: 1, border: `1px solid ${COLORS.rule}`, borderRadius: `${RADIUS.card}px`, bgcolor: COLORS.paper }}>
        <Box sx={{ flex: "none", display: "grid", placeItems: "center", width: 96, minHeight: 72, overflow: "hidden", "& svg": { maxWidth: 96, height: "auto" } }}>
          {ms && sidc ? <Glyph ms={ms} sidc={sidc} standard={standard.id} texts={draft.texts} size="medium" /> : <Spinner />}
        </Box>
        <Box sx={{ minWidth: 0, display: "flex", flexDirection: "column", gap: "3px" }}>
          <Box component="span" sx={{ fontSize: TYPE.small, fontWeight: 700, lineHeight: 1.3, overflowWrap: "anywhere" }}>
            {icon?.name ?? "—"}
          </Box>
          {icon && icon.path.length > 1 && (
            <Box component="span" sx={{ color: COLORS.muted, fontSize: TYPE.label, lineHeight: 1.35, overflowWrap: "anywhere" }}>
              {icon.path.slice(0, -1).join(" › ")}
            </Box>
          )}
          {sidc && (
            <Box component="code" sx={{ color: COLORS.ink2, fontFamily: MONO_FONT, fontSize: TYPE.label, letterSpacing: "0.02em", overflowWrap: "anywhere" }}>
              {sidc}
            </Box>
          )}
        </Box>
      </Box>

      {/* Catalogue */}
      <Box sx={{ mt: 1.5 }}>
        {catalog.status === "error" || palette.msFailed ? (
          <Box role="alert" sx={{ display: "flex", alignItems: "center", gap: 1, p: 1, borderRadius: `${RADIUS.control}px`, bgcolor: COLORS.warnSoft, color: COLORS.warn, fontSize: TYPE.small, fontWeight: 600 }}>
            <Icon name="alert" size={16} />
            <Box component="span" sx={{ flex: 1 }}>
              {palette.msFailed ? text.symbolRendererFailed : text.symbolLoadFailed}
            </Box>
            <Box component="button" type="button" onClick={palette.retry} sx={{ ...actionSx, color: COLORS.warn, borderColor: "currentColor" }}>
              {text.mapRetry}
            </Box>
          </Box>
        ) : catalog.status !== "ready" ? (
          <Box role="status" sx={{ display: "flex", alignItems: "center", gap: 1, color: COLORS.muted, fontSize: TYPE.small }}>
            <Spinner />
            {text.symbolLoading}
          </Box>
        ) : (
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
            <Box
              role="group"
              aria-label={text.symbolCatalogue}
              sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(54px, 1fr))", gap: "6px", maxHeight: 232, overflowY: "auto", overscrollBehavior: "contain", p: "2px" }}
            >
              {shown.map((entry) => (
                <Tile
                  key={entry.id}
                  icon={entry}
                  ms={ms}
                  sidc={composeSidc(entry, tileSettings, standard)}
                  standard={standard.id}
                  selected={entry.id === draft.iconId}
                  onChoose={palette.chooseIcon}
                />
              ))}
              {found.length > shown.length && (
                <Box component="button" type="button" onClick={() => setLimit((value) => value + PAGE)} sx={{ ...actionSx, gridColumn: "1 / -1", justifyContent: "center" }}>
                  {text.symbolShowMore}
                </Box>
              )}
            </Box>
          </>
        )}
      </Box>

      {/* Amplifiers */}
      {offers && (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5, mt: 2 }}>
          <Box>
            <Box component="h3" sx={sectionTitleSx}>
              {text.symbolIdentity}
            </Box>
            <ChoicePills
              label={text.symbolIdentity}
              options={identityChoices(standard).map(({ value }) => ({ value, text: labels.identities[value] }))}
              value={settings.identity}
              onChoose={(identity) => change({ identity })}
            />
          </Box>
          {offers.contexts.length > 1 && (
            <Box>
              <Box component="h3" sx={sectionTitleSx}>
                {text.symbolContext}
              </Box>
              <Segmented
                label={text.symbolContext}
                size="sm"
                options={offers.contexts.map((value) => ({ value, label: labels.contexts[value] }))}
                value={offers.contexts.includes(settings.context) ? settings.context : "0"}
                onChange={(context) => change({ context })}
              />
            </Box>
          )}
          <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1 }}>
            <Labeled label={text.symbolStatus} htmlFor="symbol-status">
              <Box component="select" id="symbol-status" value={offers.statuses.includes(settings.status) ? settings.status : "present"} onChange={(event) => change({ status: event.target.value })} sx={fieldSx}>
                {STATUSES.filter(({ value }) => offers.statuses.includes(value)).map(({ value }) => (
                  <option key={value} value={value}>
                    {labels.statuses[value]}
                  </option>
                ))}
              </Box>
            </Labeled>
            {offers.echelon && (
              <Labeled label={text.symbolEchelon} htmlFor="symbol-echelon">
                <Box component="select" id="symbol-echelon" value={settings.echelon} onChange={(event) => change({ echelon: event.target.value })} sx={fieldSx}>
                  <option value="">{none}</option>
                  {ECHELONS.map(([value]) => (
                    <option key={value} value={value}>
                      {labels.echelons[value]}
                    </option>
                  ))}
                </Box>
              </Labeled>
            )}
            {offers.mobility && (
              <Labeled label={text.symbolMobility} htmlFor="symbol-mobility">
                <Box component="select" id="symbol-mobility" value={settings.mobility} onChange={(event) => change({ mobility: event.target.value })} sx={fieldSx}>
                  <option value="">{none}</option>
                  {MOBILITIES.map(([value]) => (
                    <option key={value} value={value}>
                      {labels.mobilities[value]}
                    </option>
                  ))}
                </Box>
              </Labeled>
            )}
          </Box>
          {(offers.hq || offers.taskForce || offers.feintDummy) && (
            <Box>
              <Box component="h3" sx={sectionTitleSx}>
                {text.symbolIndicators}
              </Box>
              <Box sx={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                {offers.hq && (
                  <Box component="button" type="button" aria-pressed={settings.hq} onClick={() => change({ hq: !settings.hq })} sx={pillSx}>
                    {text.symbolHq}
                  </Box>
                )}
                {offers.taskForce && (
                  <Box component="button" type="button" aria-pressed={settings.taskForce} onClick={() => change({ taskForce: !settings.taskForce })} sx={pillSx}>
                    {text.symbolTaskForce}
                  </Box>
                )}
                {offers.feintDummy && (
                  <Box component="button" type="button" aria-pressed={settings.feintDummy} onClick={() => change({ feintDummy: !settings.feintDummy })} sx={pillSx}>
                    {text.symbolFeintDummy}
                  </Box>
                )}
              </Box>
            </Box>
          )}
          {(modifierLists["1"]?.length > 0 || modifierLists["2"]?.length > 0) && (
            <Box sx={{ display: "grid", gridTemplateColumns: "1fr", gap: 1 }}>
              {modifierLists["1"]?.length > 0 && (
                <Labeled label={text.symbolModifier1} htmlFor="symbol-modifier-1">
                  <Box component="select" id="symbol-modifier-1" value={settings.modifier1} onChange={(event) => change({ modifier1: event.target.value })} sx={fieldSx}>
                    <option value="00">{none}</option>
                    {modifierLists["1"].map(([code, name]) => (
                      <option key={code} value={code}>
                        {name}
                      </option>
                    ))}
                  </Box>
                </Labeled>
              )}
              {modifierLists["2"]?.length > 0 && (
                <Labeled label={text.symbolModifier2} htmlFor="symbol-modifier-2">
                  <Box component="select" id="symbol-modifier-2" value={settings.modifier2} onChange={(event) => change({ modifier2: event.target.value })} sx={fieldSx}>
                    <option value="00">{none}</option>
                    {modifierLists["2"].map(([code, name]) => (
                      <option key={code} value={code}>
                        {name}
                      </option>
                    ))}
                  </Box>
                </Labeled>
              )}
            </Box>
          )}
          <Box>
            <Box component="h3" sx={sectionTitleSx}>
              {text.symbolSize}
            </Box>
            <Segmented
              label={text.symbolSize}
              size="sm"
              options={["small", "medium", "large"].map((value) => ({ value, label: labels.sizes[value] }))}
              value={draft.size}
              onChange={palette.chooseSize}
            />
          </Box>
          <Disclosure title={text.symbolTexts} defaultOpen={Object.keys(draft.texts).length > 0}>
            <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1, [PHONE]: { gridTemplateColumns: "1fr" } }}>
              {TEXT_FIELDS.map(({ key, code }) => (
                <Labeled key={key} label={`${labels.fields[key]} (${code})`} htmlFor={`symbol-text-${key}`}>
                  <Box
                    component="input"
                    id={`symbol-text-${key}`}
                    type="text"
                    inputMode={key === "direction" ? "decimal" : undefined}
                    maxLength={TEXT_MAX}
                    value={draft.texts[key] ?? ""}
                    onChange={(event) => palette.changeText(key, event.target.value)}
                    sx={fieldSx}
                  />
                </Labeled>
              ))}
            </Box>
          </Disclosure>
        </Box>
      )}

      {/* Actions */}
      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, mt: 2 }}>
        <Box component="button" type="button" onClick={palette.startPlacing} disabled={!icon || !sidc || !ms} sx={primarySx}>
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

      <Box sx={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 1, mt: 1.5, pt: 1.25, borderTop: `1px solid ${COLORS.rule}`, color: COLORS.muted, fontSize: TYPE.meta }}>
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
  );
}

const panelSx = {
  width: 336,
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
  [PHONE]: { maxWidth: "calc(100vw - 82px)" },
};

function Spinner() {
  return (
    <Box
      component="span"
      aria-hidden="true"
      sx={{
        flex: "none",
        width: 16,
        height: 16,
        border: `2px solid ${COLORS.rule2}`,
        borderTopColor: COLORS.ink2,
        borderRadius: "50%",
        animation: "convertSymbolSpin 800ms linear infinite",
        "@keyframes convertSymbolSpin": { to: { transform: "rotate(360deg)" } },
        "@media (prefers-reduced-motion: reduce)": { animation: "none" },
      }}
    />
  );
}
