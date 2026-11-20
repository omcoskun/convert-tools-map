// The pieces the military symbol palette, its editor and its gallery share:
// drawing a symbol, the choice pills, labelled fields, catalogue tiles, the
// drag that takes a symbol onto the map and the panel's styles. A tile and a
// search row both choose on click, place on double click and drag on press.
import { memo, useCallback, useEffect, useMemo, useRef } from "react";
import { nextIndexForKey } from "../lib/roving.js";
import { COLORS, PHONE, RADIUS, SHADOW, TYPE, UI_FONT } from "../theme.js";
import { Box } from "../ui/index.js";
import { drawSymbol } from "./milsymbol.js";
import { composeSidc } from "./symbols.js";

// A press that travels this far is a drag, not a click.
export const DRAG_START_PX = 6;

export const sectionTitleSx = { m: 0, mb: 0.75, fontSize: TYPE.label, fontWeight: 650, letterSpacing: "0.08em", textTransform: "uppercase", color: COLORS.muted };

export const fieldSx = {
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

export const pillSx = {
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

export const actionSx = {
  ...pillSx,
  minHeight: 34,
  px: "14px",
  fontSize: TYPE.small,
  fontWeight: 650,
  color: COLORS.ink,
  "&:disabled": { opacity: 0.45, cursor: "default" },
  [PHONE]: { minHeight: 40 },
};

export const primarySx = {
  ...actionSx,
  bgcolor: COLORS.a,
  borderColor: COLORS.a,
  color: "#ffffff",
  "&:hover:not(:disabled)": { bgcolor: COLORS.aInk, borderColor: COLORS.aInk, color: "#ffffff" },
};

export const panelSx = {
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

/** milsymbol's SVG of a code; milsymbol escapes the texts it writes. */
export const Glyph = memo(function Glyph({ ms, sidc, standard, texts, size }) {
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
export function ChoicePills({ label, options, value, onChoose }) {
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

export function Labeled({ label, children, htmlFor }) {
  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: "4px", minWidth: 0 }}>
      <Box component="label" htmlFor={htmlFor} sx={{ color: COLORS.muted, fontSize: TYPE.meta, fontWeight: 600 }}>
        {label}
      </Box>
      {children}
    </Box>
  );
}

export const Tile = memo(function Tile({ icon, ms, sidc, standard, selected, onChoose, onPlace, onDragStart, dragTitle }) {
  return (
    <Box
      component="button"
      type="button"
      aria-pressed={selected}
      aria-label={icon.name}
      title={`${icon.name} — ${dragTitle}`}
      onClick={() => onChoose(icon)}
      onDoubleClick={() => onPlace(icon)}
      // A finger scrolls the grid; a mouse or a pen drags the symbol out.
      onPointerDown={(event) => {
        if (event.pointerType !== "touch") onDragStart(event, icon);
      }}
      sx={{
        display: "grid",
        placeItems: "center",
        height: 50,
        p: "3px",
        border: `1px solid ${selected ? COLORS.selected : COLORS.rule}`,
        borderRadius: `${RADIUS.control}px`,
        bgcolor: selected ? COLORS.aSoft : COLORS.sheet,
        boxShadow: selected ? `0 0 0 1px ${COLORS.selected}` : "none",
        cursor: "grab",
        "&:hover": { borderColor: COLORS.ink2 },
        "&:focus-visible": { outline: `2px solid ${COLORS.focus}`, outlineOffset: 1 },
        "& svg": { maxWidth: "100%", maxHeight: 42, width: "auto", height: "auto", pointerEvents: "none" },
      }}
    >
      <Glyph ms={ms} sidc={sidc} standard={standard} size="small" />
    </Box>
  );
});

/**
 * Dragging a symbol out of the palette: past DRAG_START_PX the symbol, drawn
 * as it would be placed, follows the pointer, and a release over the map
 * places it there (palette.dropSymbol decides what counts as the map). Esc
 * or a release anywhere else drops nothing. The click that ends a drag is
 * swallowed, so the tile is not chosen again.
 */
export function useSymbolDrag(palette) {
  const liveRef = useRef(palette);
  liveRef.current = palette;
  const cleanupRef = useRef(null);
  useEffect(() => () => cleanupRef.current?.(), []);

  return useCallback((event, icon) => {
    if (event.button !== 0 || !icon) return;
    cleanupRef.current?.();
    const target = event.currentTarget;
    const { pointerId } = event;
    const start = { x: event.clientX, y: event.clientY };
    const at = { ...start };
    let ghost = null;
    let anchor = { x: 0, y: 0 };
    let frame = 0;

    function show() {
      const { ms, standard, draft } = liveRef.current;
      if (!ms) return false;
      let drawn;
      try {
        drawn = drawSymbol(ms, { sidc: composeSidc(icon, draft.settings, standard), standard: standard.id, texts: draft.texts, size: draft.size }, { onMap: true });
      } catch {
        return false;
      }
      ghost = document.createElement("div");
      ghost.className = "map-symbol-ghost";
      ghost.setAttribute("aria-hidden", "true");
      Object.assign(ghost.style, { position: "fixed", left: "0", top: "0", zIndex: "2000", pointerEvents: "none", opacity: "0.9", lineHeight: "0", willChange: "transform" });
      ghost.innerHTML = drawn.svg;
      anchor = drawn.anchor;
      document.body.append(ghost);
      document.documentElement.style.cursor = "grabbing";
      try {
        target.setPointerCapture(pointerId);
      } catch {
        // The pointer may already be gone.
      }
      return true;
    }
    function place() {
      frame = 0;
      if (ghost) ghost.style.transform = `translate(${at.x - anchor.x}px, ${at.y - anchor.y}px)`;
    }
    function onMove(moveEvent) {
      if (moveEvent.pointerId !== pointerId) return;
      at.x = moveEvent.clientX;
      at.y = moveEvent.clientY;
      if (!ghost) {
        const dx = at.x - start.x;
        const dy = at.y - start.y;
        if (dx * dx + dy * dy < DRAG_START_PX * DRAG_START_PX || !show()) return;
      }
      moveEvent.preventDefault();
      if (!frame) frame = requestAnimationFrame(place);
    }
    function onEnd(endEvent) {
      if (endEvent.pointerId !== pointerId) return;
      const dragged = ghost != null;
      cleanup();
      if (!dragged) return;
      swallowClick();
      if (endEvent.type === "pointerup") liveRef.current.dropSymbol(icon, endEvent.clientX, endEvent.clientY);
    }
    function onKey(keyEvent) {
      if (keyEvent.key !== "Escape" || !ghost) return;
      keyEvent.preventDefault();
      keyEvent.stopPropagation();
      cleanup();
      swallowClick();
    }
    function swallowClick() {
      const stop = (clickEvent) => {
        clickEvent.stopPropagation();
        clickEvent.preventDefault();
      };
      window.addEventListener("click", stop, { capture: true, once: true });
      window.setTimeout(() => window.removeEventListener("click", stop, { capture: true }), 0);
    }
    function cleanup() {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onEnd);
      window.removeEventListener("pointercancel", onEnd);
      window.removeEventListener("keydown", onKey, true);
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
      ghost?.remove();
      ghost = null;
      document.documentElement.style.cursor = "";
      cleanupRef.current = null;
    }
    window.addEventListener("pointermove", onMove, { passive: false });
    window.addEventListener("pointerup", onEnd);
    window.addEventListener("pointercancel", onEnd);
    window.addEventListener("keydown", onKey, true);
    cleanupRef.current = cleanup;
  }, []);
}

export function Spinner() {
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
