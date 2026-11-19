// src/map/buildings.js: the 3D buildings layer over the basemap's building
// tiles, where it goes, and how the style's own building layers give way.

import assert from "node:assert/strict";
import test from "node:test";
import {
  BUILDINGS_LAYER,
  BUILDINGS_MINZOOM,
  buildingSource,
  buildingsBeforeId,
  buildingsLayer,
  flatBuildingLayers,
  styleBuildingExtrusions,
} from "../src/map/buildings.js";

test("3D buildings rise from the tiles' render heights from zoom 14 and fade in by zoom 15", () => {
  const layer = buildingsLayer("light", "openmaptiles");
  assert.equal(layer.id, BUILDINGS_LAYER);
  assert.equal(layer.id, "convert-buildings-3d");
  assert.equal(layer.type, "fill-extrusion");
  assert.equal(layer.source, "openmaptiles");
  assert.equal(layer["source-layer"], "building");
  assert.equal(BUILDINGS_MINZOOM, 14);
  assert.equal(layer.minzoom, BUILDINGS_MINZOOM);
  assert.deepEqual(layer.paint["fill-extrusion-height"], ["get", "render_height"]);
  assert.deepEqual(layer.paint["fill-extrusion-base"], ["get", "render_min_height"]);
  assert.deepEqual(layer.paint["fill-extrusion-opacity"], ["interpolate", ["linear"], ["zoom"], 14, 0, 15, 0.85]);
});

test("building parts the tiles mark hide_3d are left out", () => {
  assert.deepEqual(buildingsLayer("light", "openmaptiles").filter, ["!", ["has", "hide_3d"]]);
});

test("the building colour follows the basemap tone; an unknown tone takes the light colour", () => {
  const color = (tone) => buildingsLayer(tone, "openmaptiles").paint["fill-extrusion-color"];
  assert.equal(color("light"), "#dcd7cf");
  assert.equal(color("dark"), "#2b2f36");
  assert.equal(color("imagery"), "#e6e1d8");
  assert.equal(color("unknown"), "#dcd7cf");
});

test("the buildings come from the style's building layer's source, else its openmaptiles vector source", () => {
  const liberty = {
    sources: { openmaptiles: { type: "vector" }, ne2_shaded: { type: "raster" } },
    layers: [
      { id: "water", type: "fill", source: "openmaptiles", "source-layer": "water" },
      { id: "building", type: "fill", source: "openmaptiles", "source-layer": "building" },
    ],
  };
  assert.equal(buildingSource(liberty), "openmaptiles");
  const custom = { sources: { tiles: { type: "vector" } }, layers: [{ id: "b", type: "fill", source: "tiles", "source-layer": "building" }] };
  assert.equal(buildingSource(custom), "tiles");
  // The satellite style keeps only labels and lines, but still the vector source.
  const satellite = {
    sources: { openmaptiles: { type: "vector" }, "convert-satellite": { type: "raster" } },
    layers: [{ id: "place", type: "symbol", source: "openmaptiles", "source-layer": "place" }],
  };
  assert.equal(buildingSource(satellite), "openmaptiles");
  assert.equal(buildingSource({ sources: { openmaptiles: { type: "raster" } }, layers: [] }), undefined);
  assert.equal(buildingSource({ sources: {}, layers: [] }), undefined);
  assert.equal(buildingSource(undefined), undefined);
});

test("the style's own building extrusions give way to the app's, and its flat footprints stay at every zoom", () => {
  const layers = [
    { id: "building", type: "fill", source: "openmaptiles", "source-layer": "building", minzoom: 13, maxzoom: 14 },
    { id: "building-3d", type: "fill-extrusion", source: "openmaptiles", "source-layer": "building", minzoom: 14 },
    { id: BUILDINGS_LAYER, type: "fill-extrusion", source: "openmaptiles", "source-layer": "building", minzoom: 14 },
    { id: "building-top", type: "fill", source: "openmaptiles", "source-layer": "building", minzoom: 12 },
    { id: "landuse", type: "fill", source: "openmaptiles", "source-layer": "landuse", maxzoom: 14 },
  ];
  assert.deepEqual(styleBuildingExtrusions(layers), ["building-3d"]);
  // Only footprints that stop before zoom 24 need their range widened.
  assert.deepEqual(flatBuildingLayers(layers), [{ id: "building", minzoom: 13 }]);
  assert.deepEqual(flatBuildingLayers([{ id: "b", type: "fill", "source-layer": "building", maxzoom: 15 }]), [{ id: "b", minzoom: 0 }]);
  assert.deepEqual(styleBuildingExtrusions(undefined), []);
  assert.deepEqual(flatBuildingLayers(undefined), []);
});

test("the buildings go under every label and the app's own lines, above roads", () => {
  const landuse = { id: "landuse", type: "fill", "source-layer": "landuse" };
  const roads = { id: "roads", type: "line", "source-layer": "transportation" };
  const grid = { id: "convert-grid-lines", type: "line", source: "convert-grid" };
  const names = { id: "road-names", type: "symbol", "source-layer": "transportation_name" };
  assert.equal(buildingsBeforeId([landuse, roads, grid, names]), "convert-grid-lines");
  assert.equal(buildingsBeforeId([landuse, roads, names]), "road-names");
  assert.equal(buildingsBeforeId([landuse, roads]), undefined);
  assert.equal(buildingsBeforeId(undefined), undefined);
});
