// The place search: what a typed query becomes, how Nominatim's answer is read
// into places, and the request spacing, caching and chaining around a search.

import assert from "node:assert/strict";
import test from "node:test";
import { MAX_QUERY, cleanQuery, coordinatePlace, createPlaceSearch, parsePlaces, searchUrl } from "../src/map/place-search.js";

const SEARCH = { url: "https://search.example/search", limit: 8, minIntervalMs: 1000, attribution: [] };
const ANKARA = {
  place_id: 123,
  osm_type: "relation",
  osm_id: 223422,
  lat: "39.9207759",
  lon: "32.8540497",
  category: "boundary",
  type: "administrative",
  name: "Ankara",
  display_name: "Ankara, İç Anadolu Bölgesi, Türkiye",
  boundingbox: ["39.7774318", "40.0790283", "32.5245247", "33.0244458"],
};

test("a query is trimmed, its spaces collapsed and cut to the longest query", () => {
  assert.equal(MAX_QUERY, 200);
  assert.equal(cleanQuery("  Kızılay \n  Ankara  "), "Kızılay Ankara");
  assert.equal(cleanQuery("x".repeat(250)).length, 200);
  assert.equal(cleanQuery(undefined), "");
  assert.equal(cleanQuery("   "), "");
});

test("the search asks Nominatim for JSON v2 in the page's language, as many results as configured", () => {
  assert.equal(
    searchUrl(SEARCH, "Kızılay, Ankara", "tr"),
    "https://search.example/search?q=K%C4%B1z%C4%B1lay%2C+Ankara&format=jsonv2&limit=8&accept-language=tr",
  );
  assert.equal(searchUrl({ ...SEARCH, limit: 3 }, "Rome", "en"), "https://search.example/search?q=Rome&format=jsonv2&limit=3&accept-language=en");
});

test("a result has its name, the rest of its address as detail, its point and its bounds", () => {
  assert.deepEqual(parsePlaces([ANKARA]), [
    {
      id: "123",
      name: "Ankara",
      detail: "İç Anadolu Bölgesi, Türkiye",
      lat: 39.9207759,
      lng: 32.8540497,
      bounds: [[32.5245247, 39.7774318], [33.0244458, 40.0790283]],
    },
  ]);
  const unnamed = parsePlaces([{ ...ANKARA, name: "", display_name: "Atatürk Bulvarı, Çankaya, Ankara" }])[0];
  assert.equal(unnamed.name, "Atatürk Bulvarı");
  assert.equal(unnamed.detail, "Çankaya, Ankara");
  const elsewhere = parsePlaces([{ ...ANKARA, name: "Angora", display_name: "Ankara, Türkiye" }])[0];
  assert.equal(elsewhere.detail, "Ankara, Türkiye");
});

test("results without a valid point or a name are left out, bad bounds are dropped, and the list is capped", () => {
  assert.deepEqual(parsePlaces(null), []);
  assert.deepEqual(parsePlaces({ error: "x" }), []);
  const bad = [
    { ...ANKARA, place_id: 1, lat: "north" },
    { ...ANKARA, place_id: 2, lat: "91" },
    { ...ANKARA, place_id: 3, lon: "-181" },
    { ...ANKARA, place_id: 4, name: "", display_name: "" },
    { ...ANKARA, place_id: 5, boundingbox: ["1", "2", "179", "-179"] },
    { ...ANKARA, place_id: 6, boundingbox: "x" },
  ];
  const places = parsePlaces(bad);
  assert.deepEqual(places.map((place) => [place.id, place.bounds]), [["5", null], ["6", null]]);
  const many = Array.from({ length: 12 }, (_, index) => ({ ...ANKARA, place_id: index }));
  assert.equal(parsePlaces(many).length, 8);
  assert.equal(parsePlaces(many, 3).length, 3);
  assert.equal(parsePlaces([{ ...ANKARA, place_id: undefined }])[0].id, "relation223422");
});

test("a coordinate pair is a place of its own, found without a request", () => {
  assert.deepEqual(coordinatePlace("39.933365, 32.859742"), { id: "coordinate", name: "39.933365, 32.859742", detail: "", lat: 39.933365, lng: 32.859742, bounds: null });
  assert.equal(coordinatePlace("32.8E 39.9N").lat, 39.9);
  assert.equal(coordinatePlace("Ankara"), null);
  assert.equal(coordinatePlace(""), null);
  assert.equal(coordinatePlace("Kızılay 06420"), null);
});

function fakeSearch(options = {}) {
  const state = { clock: 0, waits: [], fetched: [] };
  const search = createPlaceSearch({
    fetchJson: async (url) => {
      state.fetched.push([url, state.clock]);
      if (options.fail?.(url, state.fetched.length)) throw new Error("offline");
      return [{ url }];
    },
    now: () => state.clock,
    wait: async (ms) => {
      state.waits.push(ms);
      state.clock += ms;
    },
    minIntervalMs: 1000,
    cacheSize: options.cacheSize,
  });
  return { search, state };
}

test("two searches go out at least the interval apart", async () => {
  const { search, state } = fakeSearch();
  state.clock = 5000;
  await search.search("https://s.example/?q=a");
  state.clock = 5300;
  await search.search("https://s.example/?q=b");
  state.clock = 9000;
  await search.search("https://s.example/?q=c");
  assert.deepEqual(state.waits, [700]);
  assert.deepEqual(state.fetched, [["https://s.example/?q=a", 5000], ["https://s.example/?q=b", 6000], ["https://s.example/?q=c", 9000]]);
});

test("searches started together go out one after another", async () => {
  const { search, state } = fakeSearch();
  const answers = await Promise.all([search.search("https://s.example/?q=a"), search.search("https://s.example/?q=b")]);
  assert.deepEqual(answers, [[{ url: "https://s.example/?q=a" }], [{ url: "https://s.example/?q=b" }]]);
  assert.deepEqual(state.fetched.map(([, at]) => at), [0, 1000]);
});

test("a repeated search is answered from the cache, which keeps the newest searches", async () => {
  const { search, state } = fakeSearch({ cacheSize: 2 });
  const first = await search.search("https://s.example/?q=a");
  state.clock = 10000;
  assert.equal(await search.search("https://s.example/?q=a"), first);
  assert.equal(state.fetched.length, 1);
  assert.deepEqual(state.waits, []);
  state.clock = 20000;
  await search.search("https://s.example/?q=b");
  state.clock = 30000;
  await search.search("https://s.example/?q=c");
  state.clock = 40000;
  await search.search("https://s.example/?q=a");
  assert.equal(state.fetched.length, 4, "a was the oldest of three and left the cache");
});

test("a failed search is not cached", async () => {
  const { search, state } = fakeSearch({ fail: (url, count) => count === 1 });
  await assert.rejects(search.search("https://s.example/?q=a"), /offline/);
  state.clock = 10000;
  assert.deepEqual(await search.search("https://s.example/?q=a"), [{ url: "https://s.example/?q=a" }]);
  assert.equal(state.fetched.length, 2);
});
