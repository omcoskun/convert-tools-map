// The small XML reader that GPX and KML files go through.

import assert from "node:assert/strict";
import test from "node:test";
import { childrenOf, firstChild, parseXml, textOf } from "../src/map/xml.js";

test("elements, attributes, self-closing tags and text are read; prefixes are kept apart from local names", () => {
  const root = parseXml(`<?xml version="1.0" encoding="UTF-8"?>
    <!-- a GPX file -->
    <gpx version="1.1" creator='test'>
      <wpt lat="39.9" lon="32.8"><name>Kızılay</name></wpt>
      <wpt lat="41.0" lon="29.0"/>
      <gx:Track><gx:coord>1 2 3</gx:coord></gx:Track>
    </gpx>`);
  assert.equal(root.name, "gpx");
  assert.deepEqual(root.attrs, { version: "1.1", creator: "test" });
  const points = childrenOf(root, "wpt");
  assert.equal(points.length, 2);
  assert.equal(points[1].attrs.lon, "29.0");
  assert.equal(textOf(firstChild(points[0], "name")), "Kızılay");
  const track = firstChild(root, "Track");
  assert.equal(track.name, "gx:Track");
  assert.equal(textOf(firstChild(track, "coord")), "1 2 3");
});

test("entities, numeric references and CDATA become their text", () => {
  const root = parseXml('<a t="&quot;x&quot; &amp; y"><b>1 &lt; 2 &#38; 3 &#x3E; 2 &unknown;</b><c><![CDATA[<i>raw</i> & ]]>more</c></a>');
  assert.equal(root.attrs.t, '"x" & y');
  assert.equal(textOf(firstChild(root, "b")), "1 < 2 & 3 > 2 &unknown;");
  assert.equal(textOf(firstChild(root, "c")), "<i>raw</i> & more");
});

test("a doctype is skipped, and broken documents are refused", () => {
  assert.equal(parseXml('<!DOCTYPE kml [ <!ENTITY x "y"> ]><kml/>').name, "kml");
  for (const broken of ["", "plain text", "<a><b></a>", "<a>", "<a></b>", "<a x=1/>", "<a><!-- open"]) {
    assert.throws(() => parseXml(broken), /XML/, broken);
  }
});

test("textOf reads the text of the element and all inside it", () => {
  const root = parseXml("<description>Line <b>bold</b> end</description>");
  assert.equal(textOf(root), "Line bold end");
  assert.equal(textOf(null), "");
});
