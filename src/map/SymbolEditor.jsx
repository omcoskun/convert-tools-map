// The symbol palette's properties tab: the preview of the chosen symbol, its
// identity pills and every amplifier the standard offers (context, status,
// echelon or mobility, the indicators, sector modifiers, size and texts). The
// preview is dragged onto the map like a tile; with nothing chosen it is all
// the tab shows.
import Disclosure from "../components/Disclosure.jsx";
import Segmented from "../components/Segmented.jsx";
import { useLanguage } from "../context.js";
import { COLORS, MONO_FONT, PHONE, RADIUS, TYPE } from "../theme.js";
import { Box } from "../ui/index.js";
import { ChoicePills, Glyph, Labeled, Spinner, fieldSx, pillSx, sectionTitleSx, useSymbolDrag } from "./symbol-parts.jsx";
import { ECHELONS, MOBILITIES, STATUSES, TEXT_FIELDS, TEXT_MAX, identityChoices, symbolOffers } from "./symbols.js";

/**
 * @param {{
 *   palette: ReturnType<typeof import("./useSymbols.js").default>,
 *   labels: ReturnType<typeof import("./symbol-labels.js").symbolLabels>,
 * }} props
 */
export default function SymbolEditor({ palette, labels }) {
  const { text } = useLanguage();
  const { standard, catalog, ms, draft, icon, sidc, editing } = palette;
  const dragSymbol = useSymbolDrag(palette);

  const offers = icon ? symbolOffers(icon, standard) : null;
  const modifierLists = offers?.modifiers ? (catalog.modifiers?.[icon.symbolSet] ?? {}) : {};
  const settings = draft.settings;
  const change = palette.changeSettings;
  const none = text.symbolNone;

  // Preview: dragged onto the map, it is placed there.
  const preview = (
    <Box
      data-palette="preview"
      title={text.symbolDragTitle}
      onPointerDown={(event) => dragSymbol(event, icon)}
      sx={{
        display: "flex",
        gap: 1.25,
        alignItems: "center",
        mt: 1.5,
        p: 1,
        border: `1px solid ${COLORS.rule}`,
        borderRadius: `${RADIUS.card}px`,
        bgcolor: COLORS.paper,
        cursor: icon && ms ? "grab" : "default",
        touchAction: "none",
        userSelect: "none",
      }}
    >
      <Box sx={{ flex: "none", display: "grid", placeItems: "center", width: 96, minHeight: 72, overflow: "hidden", "& svg": { maxWidth: 96, height: "auto", pointerEvents: "none" } }}>
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
  );

  if (!icon) return preview;

  return (
    <>
      {editing && (
        <Box component="p" sx={{ m: "6px 0 0", color: COLORS.muted, fontSize: TYPE.meta, lineHeight: 1.4 }}>
          {text.symbolEditing}
        </Box>
      )}

      {preview}

      <Box sx={{ mt: 1.5 }}>
        <Box component="h3" sx={sectionTitleSx}>
          {text.symbolIdentity}
        </Box>
        <ChoicePills
          label={text.symbolIdentity}
          options={identityChoices(standard).map(({ value }) => ({ value, text: labels.identities[value] }))}
          value={settings.identity}
          onChoose={(value) => change({ identity: value })}
        />
      </Box>

      <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5, mt: 2 }}>
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
    </>
  );
}
