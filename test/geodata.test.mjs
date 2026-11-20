// Reading GeoJSON, GPX and KML files into features for the map.

import assert from "node:assert/strict";
import test from "node:test";
import { GeodataError, MAX_FEATURES, geodataBounds, readGeodata, unionBounds } from "../src/map/geodata.js";

const code = (fn) => {
  try {
    fn();
  } catch (error) {
    assert.ok(error instanceof GeodataError, String(error));
    return error.code;
  }
  return null;
};

test("GeoJSON: a feature collection, a feature or a bare geometry, with its name and plain properties", () => {
  const collection = readGeodata(
    "plan.geojson",
    JSON.stringify({
      type: "FeatureCollection",
      features: [
        { type: "Feature", properties: { name: "HQ", secret: 1 }, geometry: { type: "Point", coordinates: [32.8, 39.9] } },
        { type: "Feature", properties: { title: "Road" }, geometry: { type: "LineString", coordinates: [[32, 39], [33, 40]] } },
        { type: "Feature", properties: null, geometry: { type: "Polygon", coordinates: [[[30, 38], [31, 38], [31, 39], [30, 38]]] } },
        { type: "Feature", properties: {}, geometry: { type: "GeometryCollection", geometries: [{ type: "Point", coordinates: [1, 2] }, { type: "MultiLineString", coordinates: [[[1, 2], [3, 4]]] }] } },
        { type: "Feature", properties: {}, geometry: null },
      ],
    }),
  );
  assert.equal(collection.type, "FeatureCollection");
  assert.deepEqual(collection.features.map((feature) => feature.geometry.type), ["Point", "LineString", "Polygon", "Point", "MultiLineString"]);
  assert.deepEqual(collection.features.map((feature) => feature.properties), [{ name: "HQ", secret: 1 }, { name: "Road" }, {}, {}, {}]);
  assert.deepEqual(collection.counts, { points: 2, lines: 2, areas: 1 });
  assert.equal(readGeodata("a.json", '{"type":"Point","coordinates":[1,2]}').features.length, 1);
  assert.equal(readGeodata("a.json", '{"type":"Feature","geometry":{"type":"MultiPoint","coordinates":[[1,2],[3,4]]},"properties":{"name":"x"}}').counts.points, 1);
});

test("GeoJSON keeps a feature's plain properties for its card: twelve at most, numbers, booleans and short texts", () => {
  const properties = { name: "A", title: "T", ele: 938, open: false, note: "  Meydan  ", blank: " ", nested: { a: 1 }, list: [1], none: null, long: "y".repeat(300), ["k".repeat(70)]: 1, ["__proto__"]: 2 };
  for (let index = 0; index < 20; index += 1) properties[`p${index}`] = index;
  const [feature] = readGeodata("a.geojson", JSON.stringify({ type: "Feature", properties, geometry: { type: "Point", coordinates: [1, 2] } })).features;
  assert.deepEqual(feature.properties, { name: "A", title: "T", ele: 938, open: false, note: "Meydan", long: "y".repeat(200), p0: 0, p1: 1, p2: 2, p3: 3, p4: 4, p5: 5, p6: 6 });
  assert.equal(Object.getPrototypeOf(feature.properties), Object.prototype);
  const named = (props) => readGeodata("a.geojson", JSON.stringify({ type: "Feature", properties: props, geometry: { type: "Point", coordinates: [1, 2] } })).features[0].properties;
  assert.deepEqual(named({ Name: "N", kind: "x" }), { name: "N", kind: "x" }, "the key the name came from is not kept twice");
  assert.deepEqual(named(["a"]), {});
});

test("GeoJSON coordinates off the globe or not numbers drop their feature; none left is an empty file", () => {
  const read = readGeodata(
    "a.geojson",
    JSON.stringify({
      type: "FeatureCollection",
      features: [
        { type: "Feature", geometry: { type: "Point", coordinates: [200, 10] } },
        { type: "Feature", geometry: { type: "Point", coordinates: ["1", 2] } },
        { type: "Feature", geometry: { type: "LineString", coordinates: [[1, 2]] } },
        { type: "Feature", geometry: { type: "Point", coordinates: [10, -95] } },
        { type: "Feature", geometry: { type: "Point", coordinates: [10, 20, 300] } },
      ],
    }),
  );
  assert.deepEqual(read.features.map((feature) => feature.geometry.coordinates), [[10, 20]]);
  assert.equal(code(() => readGeodata("a.geojson", '{"type":"FeatureCollection","features":[]}')), "empty");
  assert.equal(code(() => readGeodata("a.geojson", "{not json")), "unreadable");
  assert.equal(code(() => readGeodata("a.geojson", '{"hello":1}')), "notGeodata");
});

const GPX = `<?xml version="1.0"?>
<gpx version="1.1" xmlns="http://www.topografix.com/GPX/1/1">
  <wpt lat="39.92" lon="32.85"><name>Kızılay</name></wpt>
  <rte><name>Route</name><rtept lat="39" lon="32"/><rtept lat="40" lon="33"/></rte>
  <trk><name>Walk</name>
    <trkseg><trkpt lat="39.1" lon="32.1"/><trkpt lat="39.2" lon="32.2"/></trkseg>
    <trkseg><trkpt lat="39.3" lon="32.3"/><trkpt lat="39.4" lon="32.4"/></trkseg>
  </trk>
</gpx>`;

test("GPX: waypoints, routes and tracks (one line per segment)", () => {
  const read = readGeodata("walk.gpx", GPX);
  assert.deepEqual(read.features.map(({ geometry, properties }) => [geometry.type, properties.name]), [
    ["Point", "Kızılay"],
    ["LineString", "Route"],
    ["MultiLineString", "Walk"],
  ]);
  assert.deepEqual(read.features[0].geometry.coordinates, [32.85, 39.92]);
  assert.deepEqual(read.features[2].geometry.coordinates[1], [[32.3, 39.3], [32.4, 39.4]]);
  assert.deepEqual(read.counts, { points: 1, lines: 2, areas: 0 });
});

const KML = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2" xmlns:gx="http://www.google.com/kml/ext/2.2">
<Document><name>Plan</name><Folder>
  <Placemark><name>Gate</name><Point><coordinates>32.85,39.92,0</coordinates></Point></Placemark>
  <Placemark><name>Fence</name><LineString><coordinates>
    32.80,39.90,0 32.81,39.91,0
    32.82,39.92,0
  </coordinates></LineString></Placemark>
  <Placemark><name>Zone</name><Polygon>
    <outerBoundaryIs><LinearRing><coordinates>30,38 31,38 31,39 30,38</coordinates></LinearRing></outerBoundaryIs>
    <innerBoundaryIs><LinearRing><coordinates>30.2,38.2 30.4,38.2 30.4,38.4 30.2,38.2</coordinates></LinearRing></innerBoundaryIs>
  </Polygon></Placemark>
  <Placemark><name>Both</name><MultiGeometry><Point><coordinates>1,2</coordinates></Point><LineString><coordinates>1,2 3,4</coordinates></LineString></MultiGeometry></Placemark>
  <Placemark><name>Drive</name><gx:Track><when>2026-01-01T00:00:00Z</when><gx:coord>29 41 10</gx:coord><gx:coord>29.1 41.1 12</gx:coord></gx:Track></Placemark>
</Folder></Document></kml>`;

test("KML: points, lines, polygons with holes, multi-geometries and gx:Track, in folders", () => {
  const read = readGeodata("plan.kml", KML);
  assert.deepEqual(read.features.map(({ geometry, properties }) => [geometry.type, properties.name]), [
    ["Point", "Gate"],
    ["LineString", "Fence"],
    ["Polygon", "Zone"],
    ["Point", "Both"],
    ["LineString", "Both"],
    ["LineString", "Drive"],
  ]);
  assert.deepEqual(read.features[1].geometry.coordinates, [[32.8, 39.9], [32.81, 39.91], [32.82, 39.92]]);
  assert.equal(read.features[2].geometry.coordinates.length, 2, "outer ring and hole");
  assert.deepEqual(read.features[5].geometry.coordinates, [[29, 41], [29.1, 41.1]]);
});

test("the kind is told by the file's extension or, without one, by its content; zipped KMZ is refused", () => {
  assert.equal(readGeodata("export", GPX).counts.lines, 2);
  assert.equal(readGeodata("export.xml", KML).features.length, 6);
  assert.equal(readGeodata("data.txt", '{"type":"Point","coordinates":[1,2]}').features.length, 1);
  assert.equal(code(() => readGeodata("map.kmz", "PK...")), "kmz");
  assert.equal(code(() => readGeodata("notes.txt", "hello")), "unsupported");
  assert.equal(code(() => readGeodata("bad.gpx", "<gpx><wpt></gpx>")), "unreadable");
  assert.equal(code(() => readGeodata("other.xml", "<svg/>")), "unsupported");
});

test("a file with more than MAX_FEATURES features is refused", () => {
  const many = { type: "FeatureCollection", features: Array.from({ length: MAX_FEATURES + 1 }, () => ({ type: "Feature", geometry: { type: "Point", coordinates: [1, 2] } })) };
  assert.equal(code(() => readGeodata("many.geojson", JSON.stringify(many))), "tooMany");
});

test("bounds cover every coordinate", () => {
  assert.deepEqual(geodataBounds(readGeodata("plan.kml", KML).features), [[1, 2], [32.85, 41.1]]);
});

test("files opened together are framed together: their bounds joined, missing ones left out", () => {
  assert.deepEqual(
    unionBounds([
      [[32.8, 39.9], [32.86, 39.94]],
      null,
      [[32.83, 39.89], [32.9, 39.925]],
    ]),
    [[32.8, 39.89], [32.9, 39.94]],
  );
  assert.deepEqual(unionBounds([[[1, 2], [1, 2]]]), [[1, 2], [1, 2]]);
  assert.equal(unionBounds([]), null);
  assert.equal(unionBounds([null]), null);
});
