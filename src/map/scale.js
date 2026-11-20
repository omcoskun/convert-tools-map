// The map's scale bar (ScaleBar.jsx): the longest round length that fits in
// the bar, in metric, nautical or imperial units. Pure: tested in
// test/scale.test.mjs.

export const SCALE_UNITS = Object.freeze(["metric", "nautical", "imperial"]);

// The scale bar's colours by the map's tone. The bar sits on the map, so a
// semi-opaque plate under it keeps the numbers and both segments readable
// over any ground; the bar is outlined in the ink colour.
export const SCALE_INKS = Object.freeze({
  light: Object.freeze({ ink: "#18212f", paper: "#ffffff", plate: "rgba(255, 255, 255, 0.86)", edge: "rgba(24, 33, 47, 0.22)" }),
  dark: Object.freeze({ ink: "#f2f4f7", paper: "#111821", plate: "rgba(10, 14, 20, 0.76)", edge: "rgba(255, 255, 255, 0.22)" }),
});

/** The scale bar's colours for a map tone: dark ink on the light map, light ink on the dark map and the imagery. */
export function scaleInks(tone) {
  return tone === "dark" || tone === "imagery" ? SCALE_INKS.dark : SCALE_INKS.light;
}

const METRES_PER_NAUTICAL_MILE = 1852;
const METRES_PER_MILE = 1609.344;
const METRES_PER_FOOT = 0.3048;

/** The largest 1, 2 or 5 × 10^k not above `value` (value > 0). */
export function roundDown125(value) {
  let power = 1;
  while (power * 10 <= value) power *= 10;
  while (power > value) power /= 10;
  if (power * 5 <= value) return power * 5;
  if (power * 2 <= value) return power * 2;
  return power;
}

/**
 * @param {number} metresPerPixel ground length of one screen pixel
 * @param {number} maxPx the longest the bar may be
 * @param {"metric" | "nautical" | "imperial"} unit
 * @returns {{ widthPx: number, end: number, mid: number, unit: "m" | "km" | "NM" | "ft" | "mi" } | null}
 *   end and mid in `unit`; null when the input gives no finite scale.
 */
export function niceScale(metresPerPixel, maxPx, unit) {
  if (!(metresPerPixel > 0) || !Number.isFinite(metresPerPixel) || !(maxPx > 0)) return null;
  const longest = metresPerPixel * maxPx;
  let size;
  let name;
  if (unit === "nautical") {
    [size, name] = longest >= 0.1 * METRES_PER_NAUTICAL_MILE ? [METRES_PER_NAUTICAL_MILE, "NM"] : [1, "m"];
  } else if (unit === "imperial") {
    [size, name] = longest >= METRES_PER_MILE ? [METRES_PER_MILE, "mi"] : [METRES_PER_FOOT, "ft"];
  } else {
    [size, name] = longest >= 1000 ? [1000, "km"] : [1, "m"];
  }
  const end = roundDown125(longest / size);
  return { widthPx: (end * size) / metresPerPixel, end, mid: end / 2, unit: name };
}
