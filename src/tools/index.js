// The tools of the demo. The top bar, the address (#id), the map's tool rail
// and the layout are all built from this list.
//
// layout "workspace": the tool stands on the one map of the workspace
// (shell/WorkspaceLayout.jsx), opened from the rail on the map, and renders
// an InputWidget and a ResultHud. The address #map is the map with no tool
// open, where the app starts; the top bar names the map once for them all.
// layout "page": the tool is a centred column (PageLayout) and the page
// scrolls. prefetch, when present, starts loading what the tool needs as
// soon as its link is pointed at or focused.

import { prefetchMapLibre } from "../map/maplibre.js";
import CrsTool from "./crs/CrsTool.jsx";
import LengthConverter from "./length/LengthConverter.jsx";
import MeasureTool from "./measure/MeasureTool.jsx";
import PositionsTool from "./positions/PositionsTool.jsx";
import ReferenceTool from "./reference/ReferenceTool.jsx";
import TriaxialTool from "./triaxial/TriaxialTool.jsx";

/**
 * @typedef {{
 *   id: string,
 *   labelKey: string,
 *   icon: string,
 *   layout: "workspace" | "page",
 *   Component: () => import("react").ReactNode,
 *   prefetch?: () => void,
 * }} Tool
 *   labelKey is the lang.json text key of the navigation label; icon an
 *   Icon name.
 */

/** @type {ReadonlyArray<Tool>} */
export const TOOLS = Object.freeze([
  {
    id: "measure",
    labelKey: "navMeasure",
    icon: "measure",
    layout: "workspace",
    Component: MeasureTool,
    prefetch: prefetchMapLibre,
  },
  {
    id: "positions",
    labelKey: "navPositions",
    icon: "positions",
    layout: "workspace",
    Component: PositionsTool,
    prefetch: prefetchMapLibre,
  },
  { id: "crs", labelKey: "navCrs", icon: "crs", layout: "workspace", Component: CrsTool, prefetch: prefetchMapLibre },
  { id: "length", labelKey: "navLength", icon: "length", layout: "page", Component: LengthConverter },
  { id: "triaxial", labelKey: "navTriaxial", icon: "triaxial", layout: "page", Component: TriaxialTool },
  { id: "reference", labelKey: "navReference", icon: "reference", layout: "page", Component: ReferenceTool },
]);

/** The address of the map with no tool open. */
export const MAP_ID = "map";

export const DEFAULT_TOOL = MAP_ID;

/** Whether an address opens the map: #map or a workspace tool. */
export function isWorkspace(id) {
  return id === MAP_ID || TOOLS.some((tool) => tool.id === id && tool.layout === "workspace");
}

/** The top bar's links: the map, where every workspace tool opens, then the page tools. */
export const NAV = Object.freeze([
  Object.freeze({ id: MAP_ID, labelKey: "navMap", icon: "world", layout: "workspace", prefetch: prefetchMapLibre }),
  ...TOOLS.filter((tool) => tool.layout === "page"),
]);

// Addresses of earlier versions that still open a tool.
const ALIASES = new Map([["distance", "measure"]]);

/**
 * The tool an address names: "#measure" -> resolveTool("measure"). A part
 * after a slash names a place inside the tool ("#reference/errors") and is
 * left to the tool (lib/address.js, sectionOf).
 * @param {string} hashId the address without "#"
 * @returns {string | null} a tool id or MAP_ID, or null when the address names neither
 */
export function resolveTool(hashId) {
  const [head] = hashId.split("/");
  const id = ALIASES.get(head) ?? head;
  if (id === MAP_ID) return MAP_ID;
  return TOOLS.some((tool) => tool.id === id) ? id : null;
}
