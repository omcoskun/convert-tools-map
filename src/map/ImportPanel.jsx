// The data panel: open GeoJSON, GPX and KML files (or drop them on the map)
// and lay an image over the map by its corners. Files are read in the
// browser and kept for this visit only. Each file is listed with its colour
// and what it holds, and can be hidden, zoomed to or removed. Esc and the
// close button close the panel; it stays open while the map is used, so the
// image's handles can be dragged.
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import Icon from "../components/Icon.jsx";
import { useLanguage } from "../context.js";
import { COLORS, PHONE, RADIUS, SHADOW, TYPE, UI_FONT } from "../theme.js";
import { Box } from "../ui/index.js";
import { MAX_FEATURES } from "./geodata.js";
import { MAX_FILE_MB, MAX_IMAGE_MB } from "./useImports.js";

const ROOM_BELOW = 28;
const MIN_HEIGHT = 200;

const sectionTitleSx = { m: 0, mb: 0.75, fontSize: TYPE.label, fontWeight: 650, letterSpacing: "0.08em", textTransform: "uppercase", color: COLORS.muted };

const actionSx = {
  display: "inline-flex",
  alignItems: "center",
  gap: "6px",
  minHeight: 34,
  px: "12px",
  border: `1px solid ${COLORS.rule2}`,
  borderRadius: `${RADIUS.pill}px`,
  bgcolor: COLORS.sheet,
  color: COLORS.ink,
  font: "inherit",
  fontSize: TYPE.small,
  fontWeight: 650,
  cursor: "pointer",
  "&:hover:not(:disabled)": { borderColor: COLORS.ink2 },
  "&[aria-pressed='true']": { bgcolor: COLORS.selected, borderColor: COLORS.selected, color: COLORS.onSelected },
  "&:focus-visible": { outline: `2px solid ${COLORS.focus}`, outlineOffset: 1 },
  "&:disabled": { opacity: 0.45, cursor: "default" },
  [PHONE]: { minHeight: 40 },
};

const iconButtonSx = {
  display: "grid",
  placeItems: "center",
  flex: "none",
  width: 30,
  height: 30,
  border: 0,
  borderRadius: `${RADIUS.control}px`,
  bgcolor: "transparent",
  color: COLORS.muted,
  cursor: "pointer",
  "&:hover": { bgcolor: COLORS.paper2, color: COLORS.ink },
  "&[aria-pressed='false']": { color: COLORS.faint },
  "&:focus-visible": { outline: `2px solid ${COLORS.focus}` },
  [PHONE]: { width: 40, height: 40 },
};

/** Why a file could not be shown, in the page's language. */
function reasonOf(text, code, format) {
  switch (code) {
    case "tooLarge":
      return text.importTooLarge.replace("{max}", format.format(MAX_FILE_MB));
    case "imageTooLarge":
      return text.importTooLarge.replace("{max}", format.format(MAX_IMAGE_MB));
    case "tooMany":
      return text.importTooMany.replace("{max}", format.format(MAX_FEATURES));
    case "notGeodata":
      return text.importNotGeodata;
    case "unsupported":
      return text.importUnsupported;
    case "kmz":
      return text.importKmz;
    case "empty":
      return text.importEmpty;
    case "imageUnreadable":
      return text.importImageUnreadable;
    default:
      return text.importUnreadable;
  }
}

/**
 * @param {{ data: ReturnType<typeof import("./useImports.js").default>, open: boolean, onClose: () => void }} props
 */
export default function ImportPanel({ data, open, onClose }) {
  const { text, language } = useLanguage();
  const format = useMemo(() => new Intl.NumberFormat(language === "tr" ? "tr-TR" : "en-US"), [language]);
  const panelRef = useRef(null);
  const fileRef = useRef(null);
  const imageRef = useRef(null);
  const openFileRef = useRef(null);
  const openImageRef = useRef(null);
  const [maxHeight, setMaxHeight] = useState(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

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
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    function onKey(event) {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      event.preventDefault();
      onCloseRef.current();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  if (!open) return null;

  function countsOf({ points, lines, areas }) {
    const parts = [];
    if (points) parts.push((points === 1 ? text.importPoint : text.importPoints).replace("{count}", format.format(points)));
    if (lines) parts.push((lines === 1 ? text.importLine : text.importLines).replace("{count}", format.format(lines)));
    if (areas) parts.push((areas === 1 ? text.importArea : text.importAreas).replace("{count}", format.format(areas)));
    return parts.join(" · ");
  }

  // After a removal the focus goes to the same button of the next row (or
  // the last one), else to the button that opens files or images.
  function focusAfter(selector, index, fallbackRef) {
    window.requestAnimationFrame(() => {
      const rest = panelRef.current?.querySelectorAll(selector) ?? [];
      (rest[Math.min(index, rest.length - 1)] ?? fallbackRef.current)?.focus();
    });
  }

  function pick(input) {
    data.importFiles(input.files);
    input.value = "";
  }

  const { overlay } = data;
  const opacityText = overlay ? text.importPercent.replace("{value}", format.format(Math.round(overlay.opacity * 100))) : "";

  return (
    <Box
      ref={panelRef}
      className="map-import-panel"
      role="dialog"
      aria-label={text.importTitle}
      sx={{
        width: 320,
        maxWidth: "calc(100vw - 32px)",
        maxHeight: maxHeight ?? undefined,
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
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
        <Box component="h2" sx={{ m: 0, flex: 1, fontSize: TYPE.body, fontWeight: 700 }}>
          {text.importTitle}
        </Box>
        <Box component="button" type="button" aria-label={text.importClose} title={text.importClose} onClick={onClose} sx={iconButtonSx}>
          <Icon name="clear" size={16} />
        </Box>
      </Box>

      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
        <Box component="button" type="button" ref={openFileRef} onClick={() => fileRef.current?.click()} disabled={data.busy} sx={actionSx}>
          <Icon name="import" size={16} />
          {text.importOpenFile}
        </Box>
        <Box component="button" type="button" ref={openImageRef} onClick={() => imageRef.current?.click()} disabled={data.busy} sx={actionSx}>
          <Icon name="image" size={16} />
          {text.importOpenImage}
        </Box>
        <input ref={fileRef} type="file" hidden multiple accept=".geojson,.json,.gpx,.kml,application/geo+json,application/gpx+xml,application/vnd.google-earth.kml+xml" onChange={(event) => pick(event.target)} />
        <input ref={imageRef} type="file" hidden accept="image/png,image/jpeg,image/webp,image/gif" onChange={(event) => pick(event.target)} />
      </Box>
      <Box component="p" sx={{ m: "8px 0 0", color: COLORS.muted, fontSize: TYPE.meta, lineHeight: 1.45 }}>
        {text.importHint}
      </Box>
      {data.busy && (
        <Box component="p" role="status" sx={{ m: "8px 0 0", color: COLORS.muted, fontSize: TYPE.meta }}>
          {text.importReading}
        </Box>
      )}

      {data.errors.length > 0 && (
        <Box role="alert" sx={{ display: "flex", flexDirection: "column", gap: 0.75, mt: 1.25 }}>
          {data.errors.map((error, index) => (
            <Box key={error.id} sx={{ display: "flex", alignItems: "flex-start", gap: 1, p: "6px 6px 6px 10px", borderRadius: `${RADIUS.control}px`, bgcolor: COLORS.warnSoft, color: COLORS.warn, fontSize: TYPE.meta, fontWeight: 600, lineHeight: 1.4 }}>
              <Box component="span" sx={{ flex: 1, minWidth: 0, overflowWrap: "anywhere" }}>
                {`${error.name}: ${reasonOf(text, error.code, format)}`}
              </Box>
              <Box
                component="button"
                type="button"
                aria-label={text.importDismiss}
                title={text.importDismiss}
                data-dismiss=""
                onClick={() => {
                  data.dismissError(error.id);
                  focusAfter("[data-dismiss]", index, openFileRef);
                }}
                sx={{ ...iconButtonSx, width: 22, height: 22, color: "inherit" }}
              >
                <Icon name="clear" size={14} />
              </Box>
            </Box>
          ))}
        </Box>
      )}

      {data.files.length > 0 && (
        <Box sx={{ mt: 1.75 }}>
          <Box component="h3" sx={sectionTitleSx}>
            {text.importFiles}
          </Box>
          <Box component="ul" sx={{ listStyle: "none", m: 0, p: 0, display: "flex", flexDirection: "column", gap: 0.5 }}>
            {data.files.map((file, index) => (
              <Box component="li" key={file.id} sx={{ display: "flex", alignItems: "center", gap: 1, minHeight: 40 }}>
                <Box component="span" aria-hidden="true" sx={{ flex: "none", width: 12, height: 12, borderRadius: "50%", bgcolor: file.color, boxShadow: "0 0 0 2px #ffffff, 0 0 0 3px rgba(22, 25, 28, 0.2)", opacity: file.visible ? 1 : 0.35 }} />
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Box component="span" sx={{ display: "block", fontSize: TYPE.small, fontWeight: 650, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={file.name}>
                    {file.name}
                  </Box>
                  <Box component="span" sx={{ display: "block", color: COLORS.muted, fontSize: TYPE.label }}>
                    {countsOf(file.counts)}
                  </Box>
                </Box>
                <Box component="button" type="button" aria-pressed={file.visible} aria-label={`${text.importShow}: ${file.name}`} title={text.importShow} onClick={() => data.toggleFile(file.id)} sx={iconButtonSx}>
                  <Icon name={file.visible ? "eye" : "eyeOff"} size={17} />
                </Box>
                <Box component="button" type="button" aria-label={`${text.importZoom}: ${file.name}`} title={text.importZoom} onClick={() => data.zoomToFile(file.id)} sx={iconButtonSx}>
                  <Icon name="focus" size={17} />
                </Box>
                <Box
                  component="button"
                  type="button"
                  aria-label={`${text.importRemove}: ${file.name}`}
                  title={text.importRemove}
                  data-remove=""
                  onClick={() => {
                    data.removeFile(file.id);
                    focusAfter("[data-remove]", index, openFileRef);
                  }}
                  sx={iconButtonSx}
                >
                  <Icon name="clear" size={16} />
                </Box>
              </Box>
            ))}
          </Box>
        </Box>
      )}

      {overlay && (
        <Box sx={{ mt: 1.75 }}>
          <Box component="h3" sx={sectionTitleSx}>
            {text.importOverlay}
          </Box>
          <Box component="p" sx={{ m: "0 0 8px", fontSize: TYPE.small, fontWeight: 650, overflowWrap: "anywhere" }}>
            {overlay.name}
          </Box>
          <Box component="label" sx={{ display: "flex", alignItems: "center", gap: 1, color: COLORS.muted, fontSize: TYPE.meta, fontWeight: 600 }}>
            <span>{text.importOpacity}</span>
            <Box
              component="input"
              type="range"
              min={0}
              max={100}
              step={5}
              value={Math.round(overlay.opacity * 100)}
              aria-label={text.importOpacity}
              aria-valuetext={opacityText}
              onChange={(event) => data.setOverlayOpacity(Number(event.target.value) / 100)}
              sx={{ flex: 1, accentColor: COLORS.a }}
            />
            <Box component="span" sx={{ minWidth: 36, textAlign: "right", fontVariantNumeric: "tabular-nums", color: COLORS.ink }}>
              {opacityText}
            </Box>
          </Box>
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, mt: 1 }}>
            <Box component="button" type="button" aria-pressed={overlay.editing} onClick={data.toggleOverlayEditing} sx={actionSx}>
              {text.importEditCorners}
            </Box>
            <Box component="button" type="button" onClick={data.placeOverlayInView} sx={actionSx}>
              {text.importPlaceInView}
            </Box>
            <Box
              component="button"
              type="button"
              onClick={() => {
                data.removeOverlay();
                focusAfter("[data-none]", 0, openImageRef);
              }}
              sx={{ ...actionSx, color: COLORS.error }}
            >
              {text.importRemove}
            </Box>
          </Box>
          {overlay.editing && (
            <Box component="p" sx={{ m: "8px 0 0", color: COLORS.muted, fontSize: TYPE.meta, lineHeight: 1.45 }}>
              {text.importCornersHint}
            </Box>
          )}
        </Box>
      )}
    </Box>
  );
}
