// The map view in the address (?map=zoom/latitude/longitude[/bearing/pitch]),
// so a link opens the map where it was shared.

import assert from "node:assert/strict";
import test from "node:test";
import { formatViewParam, parseViewParam, searchWithView, viewFromSearch } from "../src/map/view-link.js";

const ANKARA = { zoom: 12.3456, lat: 39.933365, lng: 32.859742, bearing: 0, pitch: 0 };

test("a view is written as zoom/latitude/longitude, with as many decimals as the zoom shows", () => {
  assert.equal(formatViewParam(ANKARA), "12.35/39.93337/32.85974");
  assert.equal(formatViewParam({ ...ANKARA, zoom: 1.6 }), "1.6/39.93/32.86");
  assert.equal(formatViewParam({ ...ANKARA, zoom: 5 }), "5/39.933/32.860");
  assert.equal(formatViewParam({ ...ANKARA, zoom: 8 }), "8/39.9334/32.8597");
  assert.equal(formatViewParam({ zoom: 3, lat: -0.0001, lng: 0, bearing: 0, pitch: 0 }), "3/0.000/0.000");
});

test("a turned or tilted view adds its bearing and pitch", () => {
  assert.equal(formatViewParam({ ...ANKARA, zoom: 15, bearing: -33.26, pitch: 45.4 }), "15/39.93337/32.85974/-33.3/45");
  assert.equal(formatViewParam({ ...ANKARA, zoom: 15, bearing: 0, pitch: 30 }), "15/39.93337/32.85974/0/30");
  assert.equal(formatViewParam({ ...ANKARA, zoom: 15, bearing: 12, pitch: 0 }), "15/39.93337/32.85974/12");
});

test("a written view is read back; anything malformed or out of range is no view", () => {
  assert.deepEqual(parseViewParam("12.35/39.93337/32.85974"), { zoom: 12.35, lat: 39.93337, lng: 32.85974, bearing: 0, pitch: 0 });
  assert.deepEqual(parseViewParam("15/39.9/32.8/-33.3/45"), { zoom: 15, lat: 39.9, lng: 32.8, bearing: -33.3, pitch: 45 });
  for (const bad of [null, "", "abc", "12/39.9", "12/95/30", "12/39/181", "21/39/32", "-3/39/32", "12/39/32/400", "12/39/32/0/61", "12/39/32/0/0/1", "12/39/32x", "1e2/3/4", " 12/39/32"]) {
    assert.equal(parseViewParam(bad), null, String(bad));
  }
});

test("the view is the map= parameter of the query, beside any other", () => {
  assert.deepEqual(viewFromSearch("?x=1&map=10/39.9/32.8"), { zoom: 10, lat: 39.9, lng: 32.8, bearing: 0, pitch: 0 });
  assert.equal(viewFromSearch("?x=1"), null);
  assert.equal(viewFromSearch(""), null);
  assert.equal(searchWithView("?x=1", "10/1/2"), "?x=1&map=10/1/2");
  assert.equal(searchWithView("?map=1/2/3", "10/1/2"), "?map=10/1/2");
  assert.equal(searchWithView("", "10/-1/-2/5/6"), "?map=10/-1/-2/5/6");
  assert.equal(searchWithView("?map=1/2/3&x=1", null), "?x=1");
  assert.equal(searchWithView("?map=1/2/3", null), "");
});
