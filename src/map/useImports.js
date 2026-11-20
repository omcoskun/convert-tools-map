// Data laid on the map from the user's own files, read in the browser and
// never sent anywhere, kept for this visit only: GeoJSON, GPX and KML files
// (geodata.js), each drawn in its own colour, and one image laid over the
// map by its four corners (overlay.js), dragged into place by corner handles
// and a centre handle that moves it whole.

import { useCallback, useEffect, useRef, useState } from "react";
import { GeodataError, geodataBounds, readGeodata, unionBounds } from "./geodata.js";
import { IMPORT_PREFIX, LAYER_SUFFIXES, featureSummary, fileLayers, fileSource, hitLayerIds } from "./import-layers.js";
import { downscaledSize, overlayRect } from "./overlay.js";
import { CASING_LAYER, labelFont } from "./useMapStage.js";

export const MAX_FILE_MB = 25;
export const MAX_IMAGE_MB = 40;
const MB = 1024 * 1024;
// Colours apart from the measured lines' blue and red.
const FILE_COLORS = Object.freeze(["#c026d3", "#0891b2", "#ea580c", "#16a34a", "#7c3aed", "#ca8a04", "#db2777"]);
const OVERLAY_SOURCE = "convert-overlay";
const OVERLAY_LAYER = "convert-overlay";
const IMAGE_NAME = /\.(png|jpe?g|webp|gif|bmp|avif)$/i;

/** An image to lay over the map, rather than a data file. */
export function isImageFile(file) {
  return /^image\/(png|jpeg|webp|gif|bmp|avif)$/.test(file.type) || IMAGE_NAME.test(file.name);
}

function removeFile(map, id) {
  for (const suffix of LAYER_SUFFIXES) if (map.getLayer(`${id}-${suffix}`)) map.removeLayer(`${id}-${suffix}`);
  if (map.getSource(id)) map.removeSource(id);
}

const FRAME_MARGIN = 32;
const MIN_FRAME = 200;

/**
 * The padding a file is framed in: the map's own (clear of the widgets), the
 * open data panel's side too while enough of the map is left beside it, and
 * a margin.
 */
function framePadding(map, base) {
  const canvas = map.getCanvas().getBoundingClientRect();
  const panel = map.getContainer().closest(".map-stage")?.querySelector(".map-import-panel")?.getBoundingClientRect();
  let { left, right } = base;
  if (panel && panel.width > 0) {
    // The panel docks on the left; the side it is nearer is the side it covers.
    const onLeft = panel.left + panel.width / 2 < canvas.left + canvas.width / 2;
    const beside = onLeft ? panel.right - canvas.left : canvas.right - panel.left;
    const free = canvas.width - (onLeft ? right : left) - beside - 2 * FRAME_MARGIN;
    if (free >= MIN_FRAME) {
      if (onLeft) left = Math.max(left, beside);
      else right = Math.max(right, beside);
    }
  }
  return { top: base.top + FRAME_MARGIN, right: right + FRAME_MARGIN, bottom: base.bottom + FRAME_MARGIN, left: left + FRAME_MARGIN };
}

/** The corners [top-left, top-right, bottom-right, bottom-left] of a new image in the free part of the view. */
function cornersInView(map, size) {
  const canvas = map.getCanvas();
  const rect = overlayRect({ width: canvas.clientWidth, height: canvas.clientHeight, padding: framePadding(map, map.getPadding()) }, size);
  const corners = [
    [rect.left, rect.top],
    [rect.right, rect.top],
    [rect.right, rect.bottom],
    [rect.left, rect.bottom],
  ].map((point) => map.unproject(point).wrap().toArray());
  if (corners.every(([lng, lat]) => Number.isFinite(lng) && Number.isFinite(lat))) return corners;
  const { lng, lat } = map.getCenter();
  return [
    [lng - 1, lat + 0.5],
    [lng + 1, lat + 0.5],
    [lng + 1, lat - 0.5],
    [lng - 1, lat - 0.5],
  ];
}

const centerOf = (corners) => [corners.reduce((sum, [lng]) => sum + lng, 0) / 4, corners.reduce((sum, [, lat]) => sum + lat, 0) / 4];

/**
 * @param {{
 *   map: ReturnType<typeof import("./useMapStage.js").default>,
 *   cornerLabels: string[],
 *   cardLabels: { point: string, line: string, area: string, close: string },
 *   picking: boolean,
 * }} options
 *   cornerLabels: the names of the top-left, top-right, bottom-right and
 *   bottom-left handles and of the centre handle. cardLabels: the texts of an
 *   imported feature's card, one per kind and its close button. picking: true
 *   while a workspace tool is picking points on the map, when the pointer
 *   belongs to the tool.
 */
export default function useImports({ map, cornerLabels, cardLabels, picking }) {
  const [open, setOpen] = useState(false);
  const [files, setFiles] = useState([]);
  const [errors, setErrors] = useState([]);
  const [overlay, setOverlay] = useState(null);
  const [busy, setBusy] = useState(false);
  const counterRef = useRef(0);
  const { getMap, getLibrary, status, styleRevision } = map;

  const addError = useCallback((name, code) => {
    counterRef.current += 1;
    const id = counterRef.current;
    setErrors((list) => [...list.slice(-3), { id, name, code }]);
  }, []);
  const dismissError = useCallback((id) => setErrors((list) => list.filter((error) => error.id !== id)), []);

  const { fitArea } = map;
  const fitBounds = useCallback(
    (bounds) => {
      const instance = getMap();
      return Boolean(instance && bounds && fitArea(bounds, { padding: framePadding(instance, instance.getPadding()) }));
    },
    [getMap, fitArea],
  );

  /** The image drawn on a canvas at most MAX_IMAGE_SIDE px a side, or null when it cannot be. */
  const loadImage = useCallback(
    async (file) => {
      if (file.size > MAX_IMAGE_MB * MB) {
        addError(file.name, "imageTooLarge");
        return null;
      }
      let bitmap;
      try {
        bitmap = await createImageBitmap(file);
      } catch {
        addError(file.name, "imageUnreadable");
        return null;
      }
      const size = downscaledSize(bitmap.width, bitmap.height);
      const canvas = document.createElement("canvas");
      canvas.width = size.width;
      canvas.height = size.height;
      canvas.getContext("2d").drawImage(bitmap, 0, 0, size.width, size.height);
      bitmap.close?.();
      return { name: file.name, canvas, size };
    },
    [addError],
  );

  const importFiles = useCallback(
    async (list) => {
      const chosen = [...(list ?? [])];
      if (chosen.length === 0) return;
      setOpen(true);
      setBusy(true);
      // Files opened together are framed together, once they are all read;
      // an image among them is then laid in the view they are framed in.
      const added = [];
      let image = null;
      try {
        for (const file of chosen) {
          if (isImageFile(file)) {
            image = (await loadImage(file)) ?? image;
            continue;
          }
          if (file.size > MAX_FILE_MB * MB) {
            addError(file.name, "tooLarge");
            continue;
          }
          try {
            const read = readGeodata(file.name, await file.text());
            counterRef.current += 1;
            const index = counterRef.current;
            const entry = {
              id: `${IMPORT_PREFIX}${index}`,
              name: file.name,
              color: FILE_COLORS[(index - 1) % FILE_COLORS.length],
              visible: true,
              data: { type: "FeatureCollection", features: read.features },
              counts: read.counts,
              bounds: geodataBounds(read.features),
            };
            setFiles((current) => [...current, entry]);
            added.push(entry.bounds);
          } catch (error) {
            addError(file.name, error instanceof GeodataError ? error.code : "unreadable");
          }
        }
      } finally {
        setBusy(false);
      }
      const moving = fitBounds(unionBounds(added));
      const instance = getMap();
      if (!image || !instance) return;
      const place = () => setOverlay({ ...image, corners: cornersInView(instance, image.size), opacity: 0.7, editing: true });
      if (moving) instance.once("moveend", place);
      else place();
    },
    [addError, fitBounds, getMap, loadImage],
  );

  const toggleFile = useCallback((id) => setFiles((list) => list.map((file) => (file.id === id ? { ...file, visible: !file.visible } : file))), []);
  const removeFileEntry = useCallback((id) => setFiles((list) => list.filter((file) => file.id !== id)), []);
  const zoomToFile = useCallback((id) => fitBounds(files.find((file) => file.id === id)?.bounds), [files, fitBounds]);

  const setOverlayOpacity = useCallback((opacity) => setOverlay((current) => current && { ...current, opacity: Math.max(0, Math.min(1, opacity)) }), []);
  const toggleOverlayEditing = useCallback(() => setOverlay((current) => current && { ...current, editing: !current.editing }), []);
  const placeOverlayInView = useCallback(() => {
    const instance = getMap();
    setOverlay((current) => (current && instance ? { ...current, corners: cornersInView(instance, current.size) } : current));
  }, [getMap]);
  const removeOverlay = useCallback(() => setOverlay(null), []);

  // ---- The files on the map (put back after each style load) -------------
  const presentRef = useRef(new Set());
  useEffect(() => {
    const instance = getMap();
    if (!instance || status !== "ready" || styleRevision === 0) return;
    try {
      const font = labelFont(instance);
      const before = instance.getLayer(CASING_LAYER) ? CASING_LAYER : undefined;
      const wanted = new Set(files.map((file) => file.id));
      for (const id of presentRef.current) if (!wanted.has(id)) removeFile(instance, id);
      for (const file of files) {
        if (!instance.getSource(file.id)) instance.addSource(file.id, fileSource(file.data));
        for (const layer of fileLayers(file, font)) {
          if (!instance.getLayer(layer.id)) instance.addLayer(layer, before);
          instance.setLayoutProperty(layer.id, "visibility", file.visible ? "visible" : "none");
        }
      }
      presentRef.current = wanted;
    } catch (error) {
      // A style still loading: the next style.load puts the files back.
      console.warn("Imported files could not be drawn yet.", error);
    }
  }, [files, status, styleRevision, getMap]);

  // ---- Hover and click on the files' features -----------------------------------
  const filesRef = useRef(files);
  filesRef.current = files;
  const pickingRef = useRef(picking);
  pickingRef.current = picking;
  const cardLabelsRef = useRef(cardLabels);
  cardLabelsRef.current = cardLabels;
  const cardFileRef = useRef(null);
  const closeCardRef = useRef(null);
  useEffect(() => {
    const instance = getMap();
    const library = getLibrary();
    if (!instance || !library || status !== "ready") return undefined;
    const busy = () => Boolean(map.mapClickRef.current) || pickingRef.current;
    let hovered = null;
    let cursorSet = false;
    let frame = 0;
    let point = null;
    let card = null;
    let cardFile = null;

    function removeCard() {
      if (!card && !cardFile) return;
      card?.remove();
      card = null;
      cardFile = null;
      cardFileRef.current = null;
    }
    closeCardRef.current = removeCard;

    function clearHover() {
      if (hovered) {
        try {
          instance.setFeatureState(hovered, { hover: false });
        } catch {
          // The source may be gone after a style change.
        }
        hovered = null;
      }
      if (cursorSet) {
        instance.getCanvas().style.cursor = "";
        cursorSet = false;
      }
    }

    function topFeature(at) {
      const layers = hitLayerIds(filesRef.current, (id) => Boolean(instance.getLayer(id)));
      if (layers.length === 0) return null;
      try {
        return instance.queryRenderedFeatures(at, { layers })[0] ?? null;
      } catch {
        return null;
      }
    }

    function updateHover() {
      frame = 0;
      if (busy()) {
        clearHover();
        return;
      }
      const feature = topFeature(point);
      if (feature && hovered && feature.source === hovered.source && feature.id === hovered.id) return;
      clearHover();
      if (!feature || feature.id == null) return;
      try {
        instance.setFeatureState({ source: feature.source, id: feature.id }, { hover: true });
        hovered = { source: feature.source, id: feature.id };
        instance.getCanvas().style.cursor = "pointer";
        cursorSet = true;
      } catch {
        // A source gone after a style change: there is nothing to highlight.
      }
    }

    function onMouseMove(event) {
      point = event.point;
      if (!frame) frame = requestAnimationFrame(updateHover);
    }

    function onMouseOut() {
      clearHover();
    }

    function showCard(feature, lngLat) {
      const file = filesRef.current.find((entry) => entry.id === feature.source);
      if (!file) return;
      const summary = featureSummary(feature);
      const body = document.createElement("div");
      body.className = "map-import-card-body";
      const title = document.createElement("strong");
      title.textContent = summary.title ?? file.name;
      body.appendChild(title);
      const meta = document.createElement("span");
      meta.className = "map-import-card-meta";
      const kindLabel = summary.kind ? cardLabelsRef.current[summary.kind] : null;
      meta.textContent = [kindLabel, file.name].filter(Boolean).join(" · ");
      body.appendChild(meta);
      if (summary.rows.length > 0) {
        const list = document.createElement("dl");
        for (const [key, value] of summary.rows) {
          const term = document.createElement("dt");
          term.textContent = key;
          const detail = document.createElement("dd");
          detail.textContent = value;
          list.append(term, detail);
        }
        body.appendChild(list);
      }
      removeCard();
      card = new library.Popup({ closeButton: true, closeOnClick: false, closeOnMove: false, maxWidth: "280px", offset: 12, className: "map-import-card" });
      card.setDOMContent(body).setLngLat(lngLat).addTo(instance);
      cardFile = file.id;
      cardFileRef.current = file.id;
      card.getElement()?.querySelector(".maplibregl-popup-close-button")?.setAttribute("aria-label", cardLabelsRef.current.close);
    }

    function onClick(event) {
      if (busy()) return;
      const origin = event.originalEvent?.target;
      if (origin instanceof Element && origin.closest(".maplibregl-marker, .maplibregl-popup")) return;
      const feature = topFeature(event.point);
      if (!feature) {
        removeCard();
        return;
      }
      showCard(feature, event.lngLat);
    }

    function onKeyDown(event) {
      if (event.key !== "Escape" || !card || event.defaultPrevented) return;
      removeCard();
      event.preventDefault();
    }

    instance.on("mousemove", onMouseMove);
    instance.on("mouseout", onMouseOut);
    instance.on("click", onClick);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      instance.off("mousemove", onMouseMove);
      instance.off("mouseout", onMouseOut);
      instance.off("click", onClick);
      document.removeEventListener("keydown", onKeyDown);
      if (frame) cancelAnimationFrame(frame);
      clearHover();
      removeCard();
      closeCardRef.current = null;
    };
  }, [getMap, getLibrary, status, map.mapClickRef]);

  // A card goes when its file is hidden or removed.
  useEffect(() => {
    const id = cardFileRef.current;
    if (!id) return;
    const file = files.find((entry) => entry.id === id);
    if (!file || !file.visible) closeCardRef.current?.();
  }, [files]);

  // ---- The image laid over the map ---------------------------------------
  const shownCanvasRef = useRef(null);
  useEffect(() => {
    const instance = getMap();
    if (!instance || status !== "ready" || styleRevision === 0) return;
    try {
      const source = instance.getSource(OVERLAY_SOURCE);
      if (source && (!overlay || shownCanvasRef.current !== overlay.canvas)) {
        if (instance.getLayer(OVERLAY_LAYER)) instance.removeLayer(OVERLAY_LAYER);
        instance.removeSource(OVERLAY_SOURCE);
        shownCanvasRef.current = null;
      }
      if (!overlay) return;
      if (!instance.getSource(OVERLAY_SOURCE)) {
        instance.addSource(OVERLAY_SOURCE, { type: "canvas", canvas: overlay.canvas, coordinates: overlay.corners, animate: false });
        // Under the basemap's labels, so the names stay readable, and under
        // the files and lines drawn on the map.
        const firstLabel = instance.getStyle().layers.find((layer) => layer.type === "symbol" || layer.id.startsWith(IMPORT_PREFIX) || layer.id === CASING_LAYER)?.id;
        instance.addLayer({ id: OVERLAY_LAYER, type: "raster", source: OVERLAY_SOURCE, paint: { "raster-opacity": overlay.opacity, "raster-fade-duration": 0 } }, firstLabel);
        shownCanvasRef.current = overlay.canvas;
      } else {
        instance.getSource(OVERLAY_SOURCE).setCoordinates(overlay.corners);
        instance.setPaintProperty(OVERLAY_LAYER, "raster-opacity", overlay.opacity);
      }
    } catch (error) {
      console.warn("The image could not be laid over the map yet.", error);
    }
  }, [overlay, status, styleRevision, getMap]);

  // Corner handles while the image is being placed; the centre one moves it whole.
  const cornersRef = useRef(null);
  cornersRef.current = overlay?.corners ?? null;
  const handlesRef = useRef([]);
  const labelsRef = useRef(cornerLabels);
  labelsRef.current = cornerLabels;
  const editing = Boolean(overlay?.editing);
  const shownCanvas = overlay?.canvas ?? null;
  useEffect(() => {
    const instance = getMap();
    const library = getLibrary();
    if (!instance || !library || status !== "ready" || !editing || !shownCanvas) return undefined;
    const apply = (corners) => {
      cornersRef.current = corners;
      instance.getSource(OVERLAY_SOURCE)?.setCoordinates(corners);
      handlesRef.current.forEach((handle, index) => {
        if (!handle.dragging) handle.marker.setLngLat(index < 4 ? corners[index] : centerOf(corners));
      });
    };
    const commit = () => {
      const corners = cornersRef.current;
      setOverlay((current) => current && { ...current, corners });
    };
    const handles = [0, 1, 2, 3, 4].map((index) => {
      const element = document.createElement("div");
      element.className = index < 4 ? "map-corner" : "map-corner is-center";
      element.setAttribute("aria-label", labelsRef.current[index] ?? "");
      element.title = labelsRef.current[index] ?? "";
      const corners = cornersRef.current;
      const marker = new library.Marker({ element, draggable: true, anchor: "center" }).setLngLat(index < 4 ? corners[index] : centerOf(corners)).addTo(instance);
      const handle = { marker, dragging: false, start: null };
      marker.on("dragstart", () => {
        handle.dragging = true;
        handle.start = { at: marker.getLngLat().toArray(), corners: cornersRef.current };
      });
      marker.on("drag", () => {
        const [lng, lat] = marker.getLngLat().toArray();
        if (index < 4) {
          const corners = cornersRef.current.slice();
          corners[index] = [lng, lat];
          apply(corners);
        } else {
          const [startLng, startLat] = handle.start.at;
          apply(handle.start.corners.map(([cornerLng, cornerLat]) => [cornerLng + lng - startLng, Math.max(-85, Math.min(85, cornerLat + lat - startLat))]));
        }
      });
      marker.on("dragend", () => {
        handle.dragging = false;
        commit();
      });
      return handle;
    });
    handlesRef.current = handles;
    return () => {
      for (const handle of handles) handle.marker.remove();
      handlesRef.current = [];
    };
  }, [editing, shownCanvas, status, getMap, getLibrary]);

  // Corners set from the panel ("place in view") move the handles too.
  useEffect(() => {
    if (!overlay) return;
    handlesRef.current.forEach((handle, index) => {
      if (!handle.dragging) handle.marker.setLngLat(index < 4 ? overlay.corners[index] : centerOf(overlay.corners));
    });
  }, [overlay]);

  const togglePanel = useCallback(() => setOpen((current) => !current), []);
  const closePanel = useCallback(() => setOpen(false), []);

  return {
    open,
    togglePanel,
    closePanel,
    busy,
    files,
    errors,
    dismissError,
    importFiles,
    toggleFile,
    removeFile: removeFileEntry,
    zoomToFile,
    overlay: overlay && { name: overlay.name, opacity: overlay.opacity, editing: overlay.editing },
    setOverlayOpacity,
    toggleOverlayEditing,
    placeOverlayInView,
    removeOverlay,
  };
}
