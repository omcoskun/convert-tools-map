// webpack.config.js: the IWC variant, relative URLs and the production CSP.

import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import config, {
  BROWSER_TARGETS,
  CONTENT_SECURITY_POLICY,
  IWC_VALUES,
  MAP_ORIGINS,
  mapOrigins,
  resolveIwc,
  resolveMaptilerKey,
} from "../webpack.config.js";
import { APP_ROOT } from "./support/files.mjs";

/** Sets (undefined: removes) an environment variable and returns a function that puts it back. */
function setEnv(name, value) {
  const saved = process.env[name];
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
  return () => {
    if (saved === undefined) delete process.env[name];
    else process.env[name] = saved;
  };
}

/** Builds the config with IWC and MAPTILER_KEY set to these values (undefined: unset), then restores the environment. */
function configWith(value, mode, maptilerKey) {
  const restoreIwc = setEnv("IWC", value);
  const restoreKey = setEnv("MAPTILER_KEY", maptilerKey);
  try {
    return config({}, { mode });
  } finally {
    restoreKey();
    restoreIwc();
  }
}

const plugin = (built, name) => built.plugins.find((candidate) => candidate.constructor.name === name);

test("resolveIwc accepts hap and hwf, and treats unset or empty as no variant", () => {
  assert.deepEqual(IWC_VALUES, ["hap", "hwf"]);
  assert.equal(resolveIwc(undefined), null);
  assert.equal(resolveIwc(""), null);
  assert.equal(resolveIwc("hap"), "hap");
  assert.equal(resolveIwc("hwf"), "hwf");
});

test("resolveIwc stops the build on any other value instead of guessing", () => {
  for (const value of ["HAP", "hap ", "xyz", "0"]) {
    assert.throws(() => resolveIwc(value), {
      message: `IWC must be one of hap, hwf (got ${JSON.stringify(value)}).`,
    });
  }
  assert.throws(() => configWith("other", "production"), /IWC must be one of/);
});

test("IWC is embedded as process.env.IWC, null when unset", () => {
  for (const [value, expected] of [
    ["hap", '"hap"'],
    ["hwf", '"hwf"'],
    [undefined, "null"],
    ["", "null"],
  ]) {
    const definitions = plugin(configWith(value, "production"), "DefinePlugin").definitions;
    assert.deepEqual(definitions, { "process.env.IWC": expected, "process.env.MAPTILER_KEY": "null" }, String(value));
  }
});

test("resolveMaptilerKey: unset or blank is no key; a key is trimmed; anything else stops the build", () => {
  for (const value of [undefined, "", "  ", "\n"]) assert.equal(resolveMaptilerKey(value), null, JSON.stringify(value));
  assert.equal(resolveMaptilerKey("AbC123xyz"), "AbC123xyz");
  assert.equal(resolveMaptilerKey(" get_your-own_X1\n"), "get_your-own_X1");
  for (const value of ["abc 123", "abc?x=1", "a/b", '"x"', "ab&c"]) {
    // The message never repeats the value: it is a secret in the build log.
    assert.throws(() => resolveMaptilerKey(value), (error) => {
      assert.equal(error.message, 'MAPTILER_KEY may hold only letters, digits, "_" and "-".');
      return true;
    });
  }
});

test("the MapTiler key is embedded as process.env.MAPTILER_KEY, null when unset", () => {
  const embedded = (key) => plugin(configWith(undefined, "production", key), "DefinePlugin").definitions["process.env.MAPTILER_KEY"];
  assert.equal(embedded(undefined), "null");
  assert.equal(embedded(""), "null");
  assert.equal(embedded(" Key_1-2 "), '"Key_1-2"');
  assert.throws(() => configWith(undefined, "production", "bad key"), /MAPTILER_KEY may hold only/);
});

test("output uses relative URLs and app/build; the dev server listens on 3008", () => {
  const production = configWith(undefined, "production");
  assert.equal(production.mode, "production");
  assert.equal(production.output.publicPath, "");
  assert.equal(production.output.path, path.join(APP_ROOT, "build"));
  assert.match(production.output.filename, /\[contenthash/);
  assert.equal(production.devtool, false);
  const development = configWith(undefined, "development");
  assert.equal(development.mode, "development");
  assert.equal(development.devServer.port, 3008);
  assert.equal(development.devServer.host, "localhost");
});

test("production pages carry the Content-Security-Policy meta tag, development pages do not", () => {
  const meta = plugin(configWith(undefined, "production"), "HtmlWebpackPlugin").userOptions.meta;
  assert.deepEqual(meta["Content-Security-Policy"], {
    "http-equiv": "Content-Security-Policy",
    content: CONTENT_SECURITY_POLICY,
  });
  assert.match(CONTENT_SECURITY_POLICY, /script-src 'self'(;|$)/);
  assert.doesNotMatch(CONTENT_SECURITY_POLICY, /unsafe-eval/);
  // No image host: tiles and imagery are fetched, then decoded from blobs.
  assert.deepEqual(MAP_ORIGINS, [
    "https://api.maptiler.com",
    "https://earthquake.usgs.gov",
    "https://elevation-tiles-prod.s3.amazonaws.com",
    "https://gibs.earthdata.nasa.gov",
    "https://tiles.maps.eox.at",
    "https://tiles.openfreemap.org",
  ]);
  // Raster tiles arrive as images, so the same origins are allowed there.
  assert.match(CONTENT_SECURITY_POLICY, new RegExp(`img-src 'self' data: blob: ${MAP_ORIGINS.join(" ")}(;|$)`));
  assert.match(CONTENT_SECURITY_POLICY, new RegExp(`connect-src 'self' ${MAP_ORIGINS.join(" ")}(;|$)`));
  assert.match(CONTENT_SECURITY_POLICY, /worker-src 'self'(;|$)/);
  assert.doesNotMatch(CONTENT_SECURITY_POLICY, /arcgis|unsafe-eval/);
  assert.deepEqual(plugin(configWith(undefined, "development"), "HtmlWebpackPlugin").userOptions.meta, {});
});

test("map origins come from styles and tile templates, not from attribution links", () => {
  const map = {
    basemaps: [
      { id: "a", style: "https://one.example/styles/a", attribution: [{ text: "x", href: "https://credit.example/" }] },
      { id: "b", style: "https://one.example/styles/b", darkStyle: "https://two.example/dark", raster: { tiles: "https://three.example/{z}/{y}/{x}.jpg" } },
    ],
  };
  assert.deepEqual(mapOrigins(map), ["https://one.example", "https://three.example", "https://two.example"]);
  assert.deepEqual(mapOrigins(undefined), []);
});

test("links in nested credits and logos are not map origins; the imagery they credit is", () => {
  const map = {
    basemaps: [
      {
        id: "s",
        style: "https://style.example/s",
        raster: {
          tiles: "https://imagery.example/{z}/{y}/{x}.jpg",
          detail: {
            url: "https://detail.example/tiles.json?key={key}",
            logo: { src: "https://detail.example/logo.svg", href: "https://brand.example" },
            attribution: [{ text: "D", href: "https://credit.example/d" }],
          },
        },
      },
    ],
  };
  assert.deepEqual(mapOrigins(map), ["https://detail.example", "https://imagery.example", "https://style.example"]);
});

test("MapLibre is a separate chunk with its stylesheet and worker copied to vendor/", () => {
  const production = configWith(undefined, "production");
  assert.match(production.output.chunkFilename, /^assets\/.*\[contenthash/);
  const copied = plugin(production, "CopyPlugin").patterns.map((pattern) => [path.basename(pattern.from), pattern.to]);
  assert.deepEqual(copied, [
    ["public", "."],
    ["maplibre-gl.css", "vendor/"],
    ["maplibre-gl-worker.mjs", "vendor/"],
  ]);
  const loaderRule = production.module.rules.find((rule) => String(rule.loader).endsWith("blank-import-meta-url.cjs"));
  assert.ok(loaderRule.test.test(path.join("node_modules", "maplibre-gl", "dist", "maplibre-gl.mjs")));
});

test("Babel compiles only src/ for the MUI v5 browser baseline", () => {
  const [rule] = configWith(undefined, "production").module.rules;
  assert.equal(rule.include, path.join(APP_ROOT, "src"));
  const { options } = rule.use;
  assert.equal(options.configFile, false);
  assert.equal(options.babelrc, false);
  assert.deepEqual(options.presets[0], ["@babel/preset-env", { targets: BROWSER_TARGETS, bugfixes: true }]);
  assert.deepEqual(options.presets[1], ["@babel/preset-react", { runtime: "automatic", development: false }]);
  assert.deepEqual(BROWSER_TARGETS, { chrome: "90", edge: "91", firefox: "78", safari: "14", ios: "12.5" });
});

test("the map origins include the terrain tiles' origin but no credit link", () => {
  const map = {
    basemaps: [{ id: "a", style: "https://style.example/a.json", attribution: [{ text: "A", href: "https://credit.example/a" }] }],
    terrain: { tiles: "https://dem.example/{z}/{x}/{y}.png", attribution: [{ text: "DEM", href: "https://credit.example/dem" }] },
  };
  assert.deepEqual(mapOrigins(map), ["https://dem.example", "https://style.example"]);
  assert.deepEqual(mapOrigins({ basemaps: map.basemaps }), ["https://style.example"]);
});

test("the map origins include the earthquake feed's origin but no credit link", () => {
  const map = {
    basemaps: [{ id: "a", style: "https://style.example/a.json", attribution: [{ text: "A", href: "https://credit.example/a" }] }],
    earthquakes: { data: "https://quakes.example/feed/week.geojson", attribution: [{ text: "Q", href: "https://credit.example/q" }] },
  };
  assert.deepEqual(mapOrigins(map), ["https://quakes.example", "https://style.example"]);
});
