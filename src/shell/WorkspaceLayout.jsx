import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useConfig, useLanguage } from "../context.js";
import MapStage from "../map/MapStage.jsx";
import { PIN_SHAPE, fitPadding } from "../map/map-adapter.js";
import { EMPTY_SCENE } from "../map/scene.js";
import { BAR_HEIGHT, COLORS, NARROW_DOCK, PHONE, PHONE_BAR_HEIGHT, WORKSPACE } from "../theme.js";
import { Box, visuallyHidden } from "../ui/index.js";
import { WorkspaceApiContext, WorkspaceContext } from "./workspace-context.js";

// Phone layout: share of the workspace height the bottom sheet may take.
const SHEET_MIN = 0.14;
const SHEET_MAX = 0.86;
const SHEET_DEFAULT = 0.46;
const SHEET_KEY_STEPS = { ArrowUp: 0.08, ArrowDown: -0.08, PageUp: 0.2, PageDown: -0.2 };
const PHONE_QUERY = "(max-width: 759.98px)";

const NOTHING_PUBLISHED = Object.freeze({ owner: null, scene: EMPTY_SCENE });
const NO_HANDLERS = Object.freeze({});
const clampRatio = (ratio) => Math.min(SHEET_MAX, Math.max(SHEET_MIN, ratio));

/**
 * What floats on the map's left, as one box: the tool rail, the open tool's
 * panel and the panels docked beside it; null when none of them shows.
 */
function leftDock(nodes) {
  let box = null;
  for (const node of nodes) {
    const rect = node?.getBoundingClientRect();
    if (!rect || rect.width === 0 || rect.height === 0) continue;
    box = box
      ? { left: Math.min(box.left, rect.left), top: Math.min(box.top, rect.top), right: Math.max(box.right, rect.right), bottom: Math.max(box.bottom, rect.bottom) }
      : { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom };
  }
  return box && { ...box, width: box.right - box.left, height: box.bottom - box.top };
}
const fill = { position: "absolute", top: 0, right: 0, bottom: 0, left: 0 };

/**
 * The workspace: the one map of the app (MapStage) filling the window under
 * the glass top bar, with the tool rail on its left and the open workspace
 * tool's widgets floating on it beside the rail (desktop, spec 6.2) or in a
 * bottom sheet under it (phones, 6.3). A closed tool stays mounted with its
 * widgets, scene and sheet hidden, so the map is free. It provides
 * useMapScene and useWorkspace to the tool, and stays mounted, hidden, while
 * a page tool is open, so the map keeps its view.
 * @param {{
 *   hidden?: boolean,
 *   tools: { id: string, label: string, icon: string }[],
 *   openTool: string | null,
 *   onToggleTool: (id: string) => void,
 *   children?: import("react").ReactNode,
 * }} props
 *   tools: the rail's workspace tools; openTool: the one open, or null;
 *   children is the last opened workspace tool, if any: one InputWidget and
 *   one ResultHud.
 */
export default function WorkspaceLayout({ hidden = false, tools, openTool, onToggleTool, children }) {
  const { map: mapSettings } = useConfig();
  const { text } = useLanguage();
  const [published, setPublished] = useState(NOTHING_PUBLISHED);
  const [expanded, setExpanded] = useState(false);
  const [mapStatus, setMapStatus] = useState("loading");
  const [sheetRatio, setSheetRatio] = useState(SHEET_DEFAULT);
  // Whether a panel (the symbols, the data) is docked on the left.
  const [docked, setDocked] = useState(false);
  const rootRef = useRef(null);
  const handlersRef = useRef(NO_HANDLERS);
  const handlersOwnerRef = useRef(null);
  const widgetsRef = useRef({ input: null, result: null });
  const observerRef = useRef(null);
  const expandedRef = useRef(expanded);
  const sheetDragRef = useRef(null);

  useEffect(() => {
    expandedRef.current = expanded;
  }, [expanded]);

  // The input widget may grow down to the result widget, never over it.
  const fitInputWidget = useCallback(() => {
    const root = rootRef.current;
    const { input, result } = widgetsRef.current;
    if (!root) return;
    const box = root.getBoundingClientRect();
    let below = WORKSPACE.strip + 4;
    let budget = Number.POSITIVE_INFINITY;
    if (input && result) {
      const hud = result.getBoundingClientRect();
      const inputWidth = input.getBoundingClientRect().width;
      if (hud.height > 0 && hud.left < input.getBoundingClientRect().right + WORKSPACE.inset) {
        below = box.bottom - hud.top + WORKSPACE.inset / 2;
      }
      // On tall, narrow windows the input widget scrolls sooner, so the
      // widgets at rest leave the map its share. The open drawer does not
      // count: it is asked for, and the widget then only stays above it.
      const drawer = result.querySelector(".hud-drawer")?.getBoundingClientRect().height ?? 0;
      const resting = hud.width * Math.max(0, hud.height - drawer);
      if (inputWidth > 0) budget = ((1 - WORKSPACE.mapShare) * box.width * box.height - resting) / inputWidth;
    }
    const max = Math.max(120, Math.floor(Math.min(box.height - BAR_HEIGHT - WORKSPACE.inset - below, budget)));
    root.style.setProperty("--input-max", `${max}px`);
  }, []);

  const api = useMemo(
    () => ({
      publish(owner, scene) {
        setPublished((current) => (current.owner === owner && current.scene === scene ? current : { owner, scene }));
      },
      setHandlers(owner, handlers) {
        handlersOwnerRef.current = owner;
        handlersRef.current = handlers ?? NO_HANDLERS;
      },
      withdraw(owner) {
        setPublished((current) => (current.owner === owner ? NOTHING_PUBLISHED : current));
        if (handlersOwnerRef.current === owner) {
          handlersOwnerRef.current = null;
          handlersRef.current = NO_HANDLERS;
        }
      },
      registerWidget(kind, node) {
        const previous = widgetsRef.current[kind];
        if (previous === node) return;
        widgetsRef.current[kind] = node;
        if (kind !== "result") return;
        if (previous) observerRef.current?.unobserve(previous);
        if (node) observerRef.current?.observe(node);
      },
    }),
    [],
  );

  useEffect(() => {
    const root = rootRef.current;
    fitInputWidget();
    if (typeof ResizeObserver === "undefined") return undefined;
    const observer = new ResizeObserver(() => fitInputWidget());
    observer.observe(root);
    if (widgetsRef.current.result) observer.observe(widgetsRef.current.result);
    observerRef.current = observer;
    return () => {
      observer.disconnect();
      observerRef.current = null;
    };
  }, [fitInputWidget]);

  // Fits keep the scene clear of the widgets (spec 6.2).
  const getPadding = useCallback(() => {
    const stage = rootRef.current?.querySelector(".map-stage");
    if (!stage) return { top: 16, right: 16, bottom: 16, left: 16 };
    const phone = window.matchMedia?.(PHONE_QUERY).matches ?? false;
    const bar = expandedRef.current ? 0 : phone ? PHONE_BAR_HEIGHT : BAR_HEIGHT;
    // The top padding keeps a whole pin (PIN_SHAPE.height above its tip) below the bar.
    const top = bar + PIN_SHAPE.height + (phone ? 10 : 16);
    // The side paddings keep a whole pin (half of it beside its tip) off the edge.
    const side = (phone ? 24 : 32) + PIN_SHAPE.width / 2;
    const base = { top, right: 76, bottom: phone ? 28 : 32, left: side };
    const { input, result } = widgetsRef.current;
    const controls = stage.querySelector(".map-controls");
    return fitPadding(
      stage.getBoundingClientRect(),
      {
        input: leftDock([stage.querySelector(".map-tool-rail"), input, stage.querySelector(".map-dock")]),
        result: result?.getBoundingClientRect() ?? null,
        controls: controls?.getBoundingClientRect() ?? null,
      },
      base,
    );
  }, []);

  const toggleExpanded = useCallback(() => setExpanded((value) => !value), []);
  const toolOpen = openTool != null;
  const toggleRef = useRef(onToggleTool);
  toggleRef.current = onToggleTool;
  const openToolRef = useRef(openTool);
  openToolRef.current = openTool;
  const closeTool = useCallback(() => {
    if (openToolRef.current) toggleRef.current(openToolRef.current);
  }, []);
  const state = useMemo(() => ({ expanded, mapStatus, toolOpen, closeTool }), [expanded, mapStatus, toolOpen, closeTool]);
  // A closed tool's scene leaves the map; reopened, it comes back as it was.
  const shown = toolOpen ? published : NOTHING_PUBLISHED;

  useEffect(() => {
    if (hidden) setExpanded(false);
  }, [hidden]);

  // Phone layout: the handle on the sheet's top edge resizes it against the map.
  function sheetRatioAt(clientY) {
    const box = rootRef.current.getBoundingClientRect();
    return clampRatio((box.bottom - clientY) / box.height);
  }
  function onSheetPointerDown(event) {
    event.currentTarget.setPointerCapture(event.pointerId);
    sheetDragRef.current = { frame: 0, y: event.clientY, startY: event.clientY, moved: false };
  }
  function onSheetPointerMove(event) {
    const drag = sheetDragRef.current;
    if (!drag) return;
    drag.y = event.clientY;
    if (!drag.moved && Math.abs(drag.y - drag.startY) < 4) return;
    drag.moved = true;
    if (drag.frame) return;
    drag.frame = requestAnimationFrame(() => {
      drag.frame = 0;
      setSheetRatio(sheetRatioAt(drag.y));
    });
  }
  function onSheetPointerUp(event) {
    const drag = sheetDragRef.current;
    if (!drag) return;
    if (drag.frame) cancelAnimationFrame(drag.frame);
    sheetDragRef.current = null;
    if (drag.moved) setSheetRatio(sheetRatioAt(event.clientY));
  }
  function onSheetKey(event) {
    if (event.key in SHEET_KEY_STEPS) {
      event.preventDefault();
      setSheetRatio((ratio) => clampRatio(ratio + SHEET_KEY_STEPS[event.key]));
    } else if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      setSheetRatio(event.key === "Home" ? SHEET_MIN : SHEET_MAX);
    }
  }

  return (
    <WorkspaceApiContext.Provider value={api}>
      <WorkspaceContext.Provider value={state}>
        <Box
          ref={rootRef}
          // --dock-left: where panels docked beside the open tool's panel start;
          // --dock-edge: where everything docked on the left ends (a narrow
          // window lays the docked panel over the tool's).
          data-docked={docked}
          style={{ "--sheet-ratio": sheetRatio, "--dock-left": toolOpen ? `calc(${WORKSPACE.dock}px + ${WORKSPACE.inputWidth} + 8px)` : `${WORKSPACE.dock}px` }}
          sx={{
            ...fill,
            "--dock-edge": docked ? `calc(var(--dock-left) + ${WORKSPACE.docked}px)` : "var(--dock-left)",
            ...(docked && { [NARROW_DOCK]: { "--dock-edge": `max(var(--dock-left), ${WORKSPACE.dock + WORKSPACE.docked}px)` } }),
            position: "fixed",
            zIndex: expanded ? 1300 : 0,
            visibility: hidden ? "hidden" : "visible",
            bgcolor: COLORS.paper,
            "& > .map-stage": fill,
            "& > .workspace-ui": { ...fill, zIndex: 1, pointerEvents: "none" },
            ...(!toolOpen && { "& > .workspace-ui": { display: "none" } }),
            [PHONE]: expanded || !toolOpen
              ? undefined
              : {
                  display: "flex",
                  flexDirection: "column",
                  "& > .map-stage": { position: "relative", zIndex: 0, top: "auto", right: "auto", bottom: "auto", left: "auto", flex: "1 1 auto", minHeight: 150 },
                  "& > .workspace-ui": {
                    position: "relative",
                    top: "auto",
                    right: "auto",
                    bottom: "auto",
                    left: "auto",
                    flex: "none",
                    height: `clamp(120px, calc(var(--sheet-ratio) * 100%), calc(100% - ${PHONE_BAR_HEIGHT + 150}px))`,
                    mt: "-14px",
                    display: "flex",
                    flexDirection: "column",
                    overflowY: "auto",
                    scrollbarWidth: "thin",
                    paddingBottom: "env(safe-area-inset-bottom)",
                    overscrollBehavior: "contain",
                    pointerEvents: "auto",
                    bgcolor: COLORS.sheet,
                    borderRadius: "16px 16px 0 0",
                    boxShadow: "0 -6px 24px rgba(22, 25, 28, 0.16)",
                  },
                },
          }}
        >
          {!toolOpen && (
            <Box component="h1" sx={visuallyHidden}>
              {text.navMap}
            </Box>
          )}
          <MapStage
            basemaps={mapSettings.basemaps}
            defaultBasemap={mapSettings.defaultBasemap}
            terrain={mapSettings.terrain ?? null}
            scene={shown.scene}
            owner={shown.owner}
            handlersRef={handlersRef}
            getPadding={getPadding}
            expanded={expanded}
            onToggleExpanded={toggleExpanded}
            onStatusChange={setMapStatus}
            active={!hidden}
            tools={tools}
            openTool={openTool}
            onToggleTool={onToggleTool}
            onDockedChange={setDocked}
          />
          <div className="workspace-ui">
            <Box
              role="separator"
              aria-orientation="horizontal"
              aria-label={text.resizePanel}
              aria-valuemin={Math.round(SHEET_MIN * 100)}
              aria-valuemax={Math.round(SHEET_MAX * 100)}
              aria-valuenow={Math.round(sheetRatio * 100)}
              tabIndex={0}
              onPointerDown={onSheetPointerDown}
              onPointerMove={onSheetPointerMove}
              onPointerUp={onSheetPointerUp}
              onPointerCancel={onSheetPointerUp}
              onKeyDown={onSheetKey}
              sx={{
                display: "none",
                [PHONE]: expanded
                  ? undefined
                  : {
                      // Drawn over the top edge of the result strip; takes no room itself.
                      order: -3,
                      position: "sticky",
                      top: 0,
                      zIndex: 3,
                      display: "grid",
                      placeItems: "center",
                      flex: "none",
                      height: 20,
                      mb: "-20px",
                      cursor: "ns-resize",
                      touchAction: "none",
                      userSelect: "none",
                      // A 40 px tall touch target around the grip; the strip's
                      // label under it is text, the unit switch stays clear.
                      "&::after": { content: '""', position: "absolute", top: 0, left: "50%", width: 80, height: 40, transform: "translateX(-50%)" },
                      "&:focus-visible": { outlineColor: COLORS.focusOnInk, outlineOffset: "-3px" },
                    },
              }}
            >
              <Box component="span" sx={{ width: 40, height: 4, borderRadius: 4, bgcolor: "rgba(243, 241, 235, 0.42)" }} />
            </Box>
            {children}
          </div>
        </Box>
      </WorkspaceContext.Provider>
    </WorkspaceApiContext.Provider>
  );
}
