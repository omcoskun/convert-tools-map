// "What is here": the names the basemap draws at a point, from its rendered
// OpenMapTiles features, one per kind, in the page's language.

import assert from "node:assert/strict";
import test from "node:test";
import { placesAt } from "../src/map/places.js";

const feature = (sourceLayer, properties) => ({ sourceLayer, properties });

const KIZILAY = [
  feature("place", { name: "Ankara", "name:en": "Ankara", class: "city" }),
  feature("transportation_name", { name: "Atatürk Bulvarı", class: "primary" }),
  feature("poi", { name: "Güvenpark", "name:en": "Guven Park", class: "park" }),
  feature("transportation_name", { name: "Atatürk Bulvarı" }),
  feature(undefined, { name: "30°N" }),
  feature("housenumber", { housenumber: "12" }),
  feature("water_name", { name: "Kızılırmak" }),
  feature("place", { name: "Çankaya", class: "suburb" }),
];

test("one name per kind: a place of interest, a street, water or a park, then the settlement", () => {
  assert.deepEqual(placesAt(KIZILAY, "tr"), ["Güvenpark", "Atatürk Bulvarı", "Kızılırmak", "Çankaya"]);
});

test("names are taken in the page's language when the tiles have one", () => {
  assert.deepEqual(placesAt(KIZILAY, "en"), ["Guven Park", "Atatürk Bulvarı", "Kızılırmak", "Çankaya"]);
  assert.deepEqual(placesAt([feature("place", { name: "Москва", "name:tr": "Moskova", "name_en": "Moscow", class: "city" })], "tr"), ["Moskova"]);
  assert.deepEqual(placesAt([feature("place", { name: "Москва", "name_en": "Moscow", class: "city" })], "en"), ["Moscow"]);
});

test("the smallest settlement wins, and features of the map's own layers or without a name are left out", () => {
  const places = [
    feature("place", { name: "Türkiye", class: "country" }),
    feature("place", { name: "Ankara", class: "city" }),
    feature("place", { name: "Kızılay", class: "neighbourhood" }),
  ];
  assert.deepEqual(placesAt(places, "tr"), ["Kızılay"]);
  assert.deepEqual(placesAt([feature(undefined, { name: "MGRS 36S" }), feature("poi", { name: "  " }), feature("building", { name: "x" })], "tr"), []);
  assert.deepEqual(placesAt([], "tr"), []);
});
