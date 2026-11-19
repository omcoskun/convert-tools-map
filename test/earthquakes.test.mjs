// The earthquake layer definitions: the USGS feed's source, the heatmap and
// the magnitude-sized points, and where they go in the style.
import assert from "node:assert/strict";
import test from "node:test";
import {
  EARTHQUAKE_CLUSTER_COUNT_LAYER,
  EARTHQUAKE_CLUSTER_LAYER,
  EARTHQUAKE_CLUSTER_SOURCE,
  EARTHQUAKE_HEAT_LAYER,
  EARTHQUAKE_POINT_LAYER,
  EARTHQUAKE_SINGLE_LAYER,
  EARTHQUAKE_SOURCE,
  EARTHQUAKE_VIEWS,
  earthquakeClusterCountLayer,
  earthquakeClusterLayer,
  earthquakeClusterSource,
  earthquakeHeatLayer,
  earthquakePointLayer,
  earthquakeSingleLayer,
  earthquakeSource,
  earthquakeViewParts,
  earthquakesBeforeId,
  isEarthquakeSource,
} from "../src/map/earthquakes.js";

const FEED = { data: "https://quakes.example/week.geojson", attribution: [{ text: "Q", href: "https://credit.example/q" }] };
// Features without a magnitude count as 0.
const MAGNITUDE = ["coalesce", ["get", "mag"], 0];

test("the earthquakes are a GeoJSON source of the configured feed, without the credits", () => {
  assert.equal(EARTHQUAKE_SOURCE, "convert-earthquakes");
  assert.deepEqual(earthquakeSource(FEED), { type: "geojson", data: FEED.data });
});

test("only the app's earthquake sources count as earthquake sources", () => {
  assert.equal(isEarthquakeSource(EARTHQUAKE_SOURCE), true);
  assert.equal(isEarthquakeSource("convert-earthquakes-clusters"), true);
  assert.equal(isEarthquakeSource("openmaptiles"), false);
  assert.equal(isEarthquakeSource(undefined), false);
});

test("the heatmap weighs each earthquake by its magnitude and gives way to points by zoom 9", () => {
  const layer = earthquakeHeatLayer();
  assert.equal(layer.id, EARTHQUAKE_HEAT_LAYER);
  assert.equal(layer.id, "convert-earthquakes-heat");
  assert.equal(layer.type, "heatmap");
  assert.equal(layer.source, EARTHQUAKE_SOURCE);
  assert.equal(layer.maxzoom, 9);
  // A week of M2.5+ is about 300 scattered events: the spots are wide and
  // strong enough to read on the whole globe, not faint specks.
  assert.deepEqual(layer.paint["heatmap-weight"], ["interpolate", ["linear"], MAGNITUDE, 2.5, 0.3, 7, 1]);
  assert.deepEqual(layer.paint["heatmap-intensity"], ["interpolate", ["linear"], ["zoom"], 0, 1.5, 9, 3]);
  assert.deepEqual(layer.paint["heatmap-radius"], ["interpolate", ["linear"], ["zoom"], 0, 10, 4, 18, 9, 30]);
  assert.deepEqual(layer.paint["heatmap-opacity"], ["interpolate", ["linear"], ["zoom"], 7, 0.85, 9, 0]);
  const colour = layer.paint["heatmap-color"];
  assert.deepEqual(colour.slice(0, 3), ["interpolate", ["linear"], ["heatmap-density"]]);
  assert.deepEqual([colour[3], colour[4]], [0, "rgba(33, 102, 172, 0)"], "no density, no colour");
});

test("from zoom 7 each earthquake is a circle sized and coloured by its magnitude", () => {
  const layer = earthquakePointLayer("light");
  assert.equal(layer.id, EARTHQUAKE_POINT_LAYER);
  assert.equal(layer.id, "convert-earthquakes-points");
  assert.equal(layer.type, "circle");
  assert.equal(layer.source, EARTHQUAKE_SOURCE);
  assert.equal(layer.minzoom, 7);
  assert.deepEqual(layer.paint["circle-radius"], ["interpolate", ["linear"], MAGNITUDE, 2.5, 4, 7, 16]);
  assert.deepEqual(layer.paint["circle-color"], ["interpolate", ["linear"], MAGNITUDE, 2.5, "#fdd49e", 4.5, "#fc8d59", 6, "#d7301f", 7, "#7f0000"]);
  assert.deepEqual(layer.paint["circle-opacity"], ["interpolate", ["linear"], ["zoom"], 7, 0, 8, 0.9]);
  assert.equal(earthquakePointLayer("light").paint["circle-stroke-color"], "#ffffff");
  assert.equal(earthquakePointLayer("dark").paint["circle-stroke-color"], "#0b0d10");
  assert.equal(earthquakePointLayer("imagery").paint["circle-stroke-color"], "#ffffff");
  assert.equal(earthquakePointLayer("unknown").paint["circle-stroke-color"], "#ffffff");
});

test("the earthquakes go under every label and the app's own lines, above roads", () => {
  const landuse = { id: "landuse", type: "fill", "source-layer": "landuse" };
  const roads = { id: "roads", type: "line", "source-layer": "transportation" };
  const grid = { id: "convert-grid-lines", type: "line", source: "convert-grid" };
  const names = { id: "road-names", type: "symbol", "source-layer": "transportation_name" };
  assert.equal(earthquakesBeforeId([landuse, roads, grid, names]), "convert-grid-lines");
  assert.equal(earthquakesBeforeId([landuse, roads, names]), "road-names");
  assert.equal(earthquakesBeforeId([landuse, roads]), undefined);
  assert.equal(earthquakesBeforeId(undefined), undefined);
});

test("the cluster view groups the feed within 50 pixels up to zoom 10 and keeps each group's largest magnitude", () => {
  assert.equal(EARTHQUAKE_CLUSTER_SOURCE, "convert-earthquakes-clusters");
  assert.deepEqual(earthquakeClusterSource(FEED), {
    type: "geojson",
    data: FEED.data,
    cluster: true,
    clusterRadius: 50,
    clusterMaxZoom: 10,
    clusterProperties: { maxMag: ["max", MAGNITUDE] },
  });
});

test("a cluster is a circle sized by its count and coloured by its largest magnitude, labelled with its count", () => {
  const circle = earthquakeClusterLayer("light");
  assert.equal(circle.id, EARTHQUAKE_CLUSTER_LAYER);
  assert.equal(circle.id, "convert-earthquakes-clusters");
  assert.equal(circle.type, "circle");
  assert.equal(circle.source, EARTHQUAKE_CLUSTER_SOURCE);
  assert.deepEqual(circle.filter, ["has", "point_count"]);
  assert.deepEqual(circle.paint["circle-radius"], ["step", ["get", "point_count"], 14, 10, 18, 50, 24]);
  assert.deepEqual(circle.paint["circle-color"], ["step", ["get", "maxMag"], "#fdd49e", 4.5, "#fc8d59", 6, "#d7301f"]);
  assert.equal(earthquakeClusterLayer("light").paint["circle-stroke-color"], "#ffffff");
  assert.equal(earthquakeClusterLayer("dark").paint["circle-stroke-color"], "#0b0d10");
  const count = earthquakeClusterCountLayer(["Noto Sans Regular"]);
  assert.equal(count.id, EARTHQUAKE_CLUSTER_COUNT_LAYER);
  assert.equal(count.id, "convert-earthquakes-cluster-count");
  assert.equal(count.type, "symbol");
  assert.equal(count.source, EARTHQUAKE_CLUSTER_SOURCE);
  assert.deepEqual(count.filter, ["has", "point_count"]);
  assert.deepEqual(count.layout["text-field"], ["get", "point_count_abbreviated"]);
  assert.deepEqual(count.layout["text-font"], ["Noto Sans Regular"]);
  // Without the style's glyphs there is no label, only the circles.
  assert.equal(earthquakeClusterCountLayer(null), null);
});

test("an earthquake outside every cluster is drawn like a point of the heatmap view, at every zoom", () => {
  const single = earthquakeSingleLayer("light");
  const point = earthquakePointLayer("light");
  assert.equal(single.id, EARTHQUAKE_SINGLE_LAYER);
  assert.equal(single.id, "convert-earthquakes-single");
  assert.equal(single.type, "circle");
  assert.equal(single.source, EARTHQUAKE_CLUSTER_SOURCE);
  assert.deepEqual(single.filter, ["!", ["has", "point_count"]]);
  assert.equal(single.minzoom, undefined);
  assert.deepEqual(single.paint["circle-radius"], point.paint["circle-radius"]);
  assert.deepEqual(single.paint["circle-color"], point.paint["circle-color"]);
  assert.equal(earthquakeSingleLayer("dark").paint["circle-stroke-color"], "#0b0d10");
});

test("each view has its own source and layers; an unknown view is the heatmap", () => {
  assert.deepEqual(EARTHQUAKE_VIEWS, ["heat", "clusters"]);
  assert.ok(Object.isFrozen(EARTHQUAKE_VIEWS));
  assert.deepEqual(earthquakeViewParts("heat"), { source: EARTHQUAKE_SOURCE, layers: [EARTHQUAKE_HEAT_LAYER, EARTHQUAKE_POINT_LAYER] });
  assert.deepEqual(earthquakeViewParts("clusters"), {
    source: EARTHQUAKE_CLUSTER_SOURCE,
    layers: [EARTHQUAKE_CLUSTER_LAYER, EARTHQUAKE_CLUSTER_COUNT_LAYER, EARTHQUAKE_SINGLE_LAYER],
  });
  assert.deepEqual(earthquakeViewParts("unknown"), earthquakeViewParts("heat"));
});
