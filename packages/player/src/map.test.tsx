import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import { feature } from "topojson-client"
import type { GeometryCollection, Topology } from "topojson-specification"
import {
  COUNTRIES,
  DRAWN_SIZES,
  MAP_REGION_NAMES,
  NOT_ON_MAP,
  type MapVisual,
} from "@workspace/spec"

import type { Mark } from "./check"
import WorldMap from "./map"
import data from "./map-data.json"
import { frameFor } from "./map-frame"

// The map's shapes and the checker's table of countries are built together by scripts/build-map.ts;
// they have to agree, or a code the checker accepts would shade nothing.

const draw = (map: Omit<MapVisual, "kind">) =>
  renderToStaticMarkup(
    createElement(WorldMap, { map: { kind: "map", ...map }, plain: false })
  )
const labels = (svg: string) =>
  [...svg.matchAll(/<text[^>]*>([^<]*)<\/text>/g)].map((m) => m[1])

describe("map data", () => {
  it("has a shape for every country the checker accepts, and no other codes", () => {
    const ids = new Set(
      data.objects.countries.geometries.flatMap((g) =>
        "id" in g && g.id ? [g.id] : []
      )
    )
    expect([...ids].sort()).toEqual(Object.keys(COUNTRIES).sort())
    for (const code of Object.keys(NOT_ON_MAP))
      expect(ids.has(code)).toBe(false)
  })

  it("matches the checker's table of drawn sizes (run `npm run map -w @workspace/player` after changing a region)", () => {
    const topology = data as unknown as Topology<{
      countries: GeometryCollection
    }>
    const shapes = feature(topology, topology.objects.countries).features
    for (const region of MAP_REGION_NAMES) {
      const { path } = frameFor(region)
      const drawn: Record<string, number> = {}
      for (const code of Object.keys(COUNTRIES)) {
        const [[x0, y0], [x1, y1]] = path.bounds({
          type: "FeatureCollection",
          features: shapes.filter((f) => f.id === code),
        })
        const size = Math.round(Math.max(x1 - x0, y1 - y0))
        if (Number.isFinite(size) && size >= 1) drawn[code] = size
      }
      expect(drawn, region).toEqual(DRAWN_SIZES[region])
    }
  })
})

describe("WorldMap", () => {
  it("draws every region", () => {
    for (const region of MAP_REGION_NAMES) {
      const svg = draw({ region, alt: region, countries: [{ code: "FR" }] })
      expect(svg).toMatch(/viewBox="0 0 480 \d+"/)
    }
  })

  it("shades each country and names it", () => {
    const svg = draw({
      region: "europe",
      alt: "France and Germany.",
      countries: [
        { code: "FR", label: "France" },
        { code: "DE", label: "Germany" },
      ],
    })
    expect(svg.match(/class="fill-chart-2\/70"/g)).toHaveLength(2)
    expect(labels(svg)).toEqual(["France", "Germany"])
  })

  it("puts places first, and rings a country too small to see", () => {
    const svg = draw({
      alt: "Singapore and Sydney.",
      countries: [{ code: "SG", label: "Singapore" }],
      points: [{ lat: -33.87, lon: 151.21, label: "Sydney" }],
    })
    expect(labels(svg)).toEqual(["Sydney", "Singapore"])
    expect(svg).toMatch(/<circle[^>]*fill="none"[^>]*class="stroke-chart-2"/)
  })

  it("colors each group and names it in a legend", () => {
    const svg = draw({
      alt: "Allies and Axis.",
      countries: [
        { code: "US", group: "Allies" },
        { code: "DE", group: "Axis" },
      ],
    })
    expect(svg).toContain('class="fill-chart-2/70"')
    expect(svg).toContain('class="fill-foreground/40"')
    expect(svg).toMatch(/<li[^>]*>.*Allies<\/li><li[^>]*>.*Axis<\/li>/)
  })
})

describe("WorldMap as a hotspot", () => {
  const tap = (selected: string[], marks: Record<string, Mark> = {}) =>
    renderToStaticMarkup(
      createElement(WorldMap, {
        map: {
          kind: "map",
          region: "eastern-mediterranean",
          alt: "The eastern Mediterranean.",
        },
        plain: false,
        hotspots: { selected, marks, onToggle: () => {}, disabled: false },
      })
    )

  it("makes every country the region draws a toggle, named, with one tab stop", () => {
    const html = tap([])
    const toggles = [...html.matchAll(/data-country="(\w+)"/g)].map((m) => m[1])
    expect([...toggles].sort()).toEqual(
      Object.keys(DRAWN_SIZES["eastern-mediterranean"]).sort()
    )
    // West to east: Italy's heel first, Georgia last.
    expect(toggles[0]).toBe("IT")
    expect(toggles.at(-1)).toBe("GE")
    expect(html).toContain('aria-label="Syria"')
    expect(html.match(/tabindex="0"/g)).toHaveLength(1)
  })

  it("outlines nothing before a pick, then the pick and the marks", () => {
    expect(tap([])).not.toMatch(/stroke-(primary|green-600|yellow-500)/)
    expect(tap(["TR"])).toMatch(/stroke-primary/)
    const checked = tap(["SY"], { SY: "wrong", TR: "correct" })
    expect(checked).toMatch(/stroke-yellow-500/)
    expect(checked).toMatch(/stroke-green-600/)
  })
})
