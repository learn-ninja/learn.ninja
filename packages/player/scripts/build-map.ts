// Builds the map visual's data from Natural Earth's 1:50m countries (public domain, via world-atlas):
// a simplified TopoJSON keyed by ISO 3166-1 alpha-2 code for the player's map, and the table of
// countries the checker reads (name, alpha-3 code, bounding box, label anchor). Run it after
// changing the simplification or the code fixes below: `npm run map -w @workspace/player`.

import { readFileSync, writeFileSync } from "node:fs"
import { createRequire } from "node:module"
import { fileURLToPath } from "node:url"

import { geoArea, geoCentroid } from "d3-geo"
import countries from "i18n-iso-countries"
import en from "i18n-iso-countries/langs/en.json" with { type: "json" }
import { feature, quantize } from "topojson-client"
import {
  presimplify,
  quantile,
  simplify,
  sphericalTriangleArea,
} from "topojson-simplify"
import type { GeometryCollection, Topology } from "topojson-specification"

countries.registerLocale(en)

const require = createRequire(import.meta.url)
const source: Topology<{ countries: GeometryCollection<{ name: string }> }> =
  JSON.parse(
    readFileSync(require.resolve("world-atlas/countries-50m.json"), "utf8")
  )

/** The share of points kept: enough for a continent at a desktop column's width. */
const KEEP = 0.2
/** Coordinates snap to a 10,000 × 10,000 grid: about 4 km, under a pixel on any region. */
const GRID = 1e4

// Natural Earth leaves a few places without a numeric code. Kosovo takes its common user-assigned
// code; the breakaway regions shade with the country they belong to; the rest stay unnamed land.
const BY_NAME: Record<string, string> = {
  Kosovo: "XK",
  Somaliland: "SO",
  "N. Cyprus": "CY",
}

// The checker's messages name countries; ISO's names are formal or awkward for some.
const NAMES: Record<string, string> = {
  BN: "Brunei",
  BO: "Bolivia",
  CD: "DR Congo",
  CG: "Republic of the Congo",
  CZ: "Czechia",
  FK: "Falkland Islands",
  FM: "Micronesia",
  GB: "United Kingdom",
  IR: "Iran",
  KP: "North Korea",
  KR: "South Korea",
  LA: "Laos",
  MD: "Moldova",
  MK: "North Macedonia",
  PS: "Palestine",
  RU: "Russia",
  SY: "Syria",
  TW: "Taiwan",
  TZ: "Tanzania",
  US: "United States",
  VA: "Vatican City",
  VE: "Venezuela",
  VG: "British Virgin Islands",
  VI: "US Virgin Islands",
  VN: "Vietnam",
}

const geometries = source.objects.countries.geometries
for (const g of geometries) {
  const code =
    BY_NAME[(g.properties as { name: string }).name] ??
    (g.id === undefined ? undefined : countries.numericToAlpha2(g.id))
  g.id = code
  delete g.properties
}

// The checker's table comes from the full-resolution shapes, before anything is simplified away.
const full = feature(source, source.objects.countries)
const codes = [...new Set(geometries.flatMap((g) => (g.id ? [String(g.id)] : [])))]
codes.sort()
const round = (v: number) => Math.round(v * 100) / 100
const table = codes.map((code) => {
  const parts = full.features.filter((f) => f.id === code)
  const [w, s, e, n] = bounds(parts.flatMap((f) => points(f.geometry)))
  // The anchor is the middle of the country's largest piece: mainland France, not French Guiana.
  const polygons = parts.flatMap((f) =>
    f.geometry.type === "MultiPolygon"
      ? f.geometry.coordinates.map((coordinates) => ({
          type: "Polygon" as const,
          coordinates,
        }))
      : f.geometry.type === "Polygon"
        ? [f.geometry]
        : []
  )
  const largest = polygons.reduce((a, b) => (geoArea(b) > geoArea(a) ? b : a))
  const [lon, lat] = geoCentroid(largest)
  return {
    code,
    name: NAMES[code] ?? countries.getName(code, "en")!,
    a3: countries.alpha2ToAlpha3(code)!,
    box: [round(w), round(s), round(e), round(n)] as const,
    at: [round(lon), round(lat)],
  }
})
// Overseas regions with codes of their own that Natural Earth draws as part of their country.
const PART_OF: Record<string, string> = {
  BQ: "NL",
  GF: "FR",
  GP: "FR",
  MQ: "FR",
  RE: "FR",
  SJ: "NO",
  YT: "FR",
}
const missing = Object.keys(countries.getAlpha2Codes())
  .filter((c) => !codes.includes(c))
  .sort()
  .map((code) => ({
    code,
    name: NAMES[code] ?? countries.getName(code, "en")!,
    partOf: PART_OF[code],
  }))

// Simplify: drop the land object (the countries cover it) and most points, keep every point of a
// country too small to lose any, and snap what's left to the grid.
const topology = presimplify(
  { ...source, objects: { countries: source.objects.countries } },
  sphericalTriangleArea
)
const tiny = new Set(
  table
    .filter(({ box: [w, s, e, n] }) => Math.abs(e - w) < 1 && n - s < 1)
    .map((c) => c.code)
)
for (const g of topology.objects.countries.geometries)
  if (g.id && tiny.has(String(g.id)))
    for (const i of arcIndexes(g))
      for (const point of topology.arcs[i]!) point[2] = Infinity
const simple = simplify(topology, quantile(topology, KEEP))
const out = quantize(
  { ...simple, arcs: simple.arcs.map((arc) => arc.map(([x, y]) => [x!, y!])) },
  GRID
)
delete out.bbox

const here = (path: string) => fileURLToPath(new URL(path, import.meta.url))
writeFileSync(here("../../player-core/src/map-data.json"), JSON.stringify(out))
writeFileSync(
  here("../../spec/src/countries.ts"),
  `// Generated by packages/player/scripts/build-map.ts from Natural Earth's 1:50m countries. Don't edit.

/** A country the map can shade: its name for messages, ISO alpha-3 code, bounding box (west, south, east, north; west > east across the 180th meridian), and where its label goes (lon, lat). */
export interface Country {
  name: string
  a3: string
  box: [number, number, number, number]
  at: [number, number]
}

/** Every country on the map, by ISO 3166-1 alpha-2 code. */
export const COUNTRIES: Record<string, Country> = {
${table.map((c) => `  ${c.code}: { name: ${JSON.stringify(c.name)}, a3: "${c.a3}", box: [${c.box.join(", ")}], at: [${c.at.join(", ")}] },`).join("\n")}
}

/** ISO codes the map can't shade: too small for its data (Tuvalu, Gibraltar), or drawn as part of another country (French Guiana, in France). */
export const NOT_ON_MAP: Record<string, { name: string; partOf?: string }> = {
${missing.map((c) => `  ${c.code}: { name: ${JSON.stringify(c.name)}${c.partOf ? `, partOf: "${c.partOf}"` : ""} },`).join("\n")}
}
`
)
console.log(
  `${codes.length} countries, ${missing.length} ISO codes not on the map, ${JSON.stringify(out).length} bytes of TopoJSON`
)

/** Every position of a polygon or multipolygon. */
function points(g: GeoJSON.Geometry): number[][] {
  return g.type === "Polygon"
    ? g.coordinates.flat()
    : g.type === "MultiPolygon"
      ? g.coordinates.flat(2)
      : []
}

/**
 * The box around some positions: west, south, east, north. Natural Earth splits shapes at the 180th
 * meridian (Fiji, Russia's far east), so when the longitudes are tighter counted from 0° to 360°,
 * the box crosses it and its west is greater than its east.
 */
function bounds(positions: number[][]): [number, number, number, number] {
  const lats = positions.map((p) => p[1]!)
  const lons = positions.map((p) => p[0]!)
  const shifted = lons.map((l) => (l < 0 ? l + 360 : l))
  const span = (ls: number[]) => Math.max(...ls) - Math.min(...ls)
  const wrap = (l: number) => (l > 180 ? l - 360 : l)
  const [w, e] =
    span(shifted) < span(lons)
      ? [wrap(Math.min(...shifted)), wrap(Math.max(...shifted))]
      : [Math.min(...lons), Math.max(...lons)]
  return [w, Math.min(...lats), e, Math.max(...lats)]
}

/** Every arc a shape uses, with reversed arcs (~i) mapped back to their index. */
function arcIndexes(g: object): number[] {
  const flat = (a: unknown): number[] =>
    Array.isArray(a)
      ? a.flatMap(flat)
      : [(a as number) < 0 ? ~(a as number) : (a as number)]
  return "arcs" in g ? flat(g.arcs) : []
}
