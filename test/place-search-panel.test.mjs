// The place search panel, server-rendered: closed it draws nothing; open it is
// a named dialog with a search form, a submit button and OpenStreetMap's credit.

import assert from "node:assert/strict";
import test from "node:test";
import "./support/jsx-loader.mjs";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { readJson } from "./support/files.mjs";
import { element, markup, visibleText } from "./support/html.mjs";

const config = readJson("public/config.json");
const lang = readJson("public/lang.json");
const { default: PlaceSearch } = await import("../src/map/PlaceSearch.jsx");
const { ConfigContext, LanguageContext } = await import("../src/context.js");

function render({ open = true, ...props } = {}) {
  return markup(
    renderToString(
      createElement(
        ConfigContext.Provider,
        { value: config },
        createElement(
          LanguageContext.Provider,
          { value: { language: "tr", ...lang.tr } },
          createElement(PlaceSearch, { open, onClose() {}, onChoose() {}, onClear() {}, ...props }),
        ),
      ),
    ),
  );
}

test("a closed place search renders nothing", () => {
  assert.equal(render({ open: false }), "");
});

test("the place search is a named dialog with a search form, a submit button and the OpenStreetMap credit", () => {
  const html = render();
  const dialog = element(html, 'role="dialog"');
  assert.ok(dialog, "a dialog");
  assert.match(dialog, /aria-label="Yer ara"/);
  const form = element(html, 'role="search"');
  assert.ok(form, "a search form");
  assert.match(form, /^<form/);
  const input = element(html, 'type="search"');
  assert.ok(input, "a search input");
  assert.match(input, /aria-label="Yer adı, adres veya koordinat"/);
  assert.match(input, /placeholder="Ör. Kızılay, Ankara ya da 39\.93, 32\.86"/);
  const submit = element(html, 'type="submit"');
  assert.ok(submit, "a submit button");
  assert.match(submit, /^<button/);
  assert.equal(visibleText(submit), "Ara");
  const credit = element(html, 'href="https://www.openstreetmap.org/copyright"');
  assert.ok(credit, "the OpenStreetMap credit");
  assert.equal(visibleText(credit), "© OpenStreetMap");
  assert.ok(visibleText(html).includes("Arama: Nominatim"));
  assert.doesNotMatch(html, /<ul/);
  assert.equal(visibleText(element(html, 'role="status"')), "");
});
