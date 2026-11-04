import { describe, expect, it } from "vitest"

import { DRAWN_SIZES } from "@workspace/spec"

import {
  nearestSmall,
  outlinesFor,
  placeLabels,
  pointsFor,
  shadedFor,
  spotsFor,
} from "./map-draw"

describe("the map's geometry", () => {
  it("frames a region with its outlines", () => {
    const o = outlinesFor("eastern-mediterranean")
    expect(o.height).toBeGreaterThan(100)
    expect(o.land).toMatch(/^M/)
    expect(o.borders).toMatch(/^M/)
  })

  it("lists every country the checker allows on the region, west to east", () => {
    const spots = spotsFor("europe")
    expect(spots.map((s) => s.code).sort()).toEqual(
      Object.keys(DRAWN_SIZES.europe).sort()
    )
    for (let i = 1; i < spots.length; i++)
      expect(spots[i]!.x).toBeGreaterThanOrEqual(spots[i - 1]!.x)
  })

  it("shades a country and projects a point", () => {
    const [fr] = shadedFor({
      kind: "map",
      region: "europe",
      countries: [{ code: "FR", label: "France" }],
    })
    expect(fr!.d).toMatch(/^M/)
    expect(fr!.at).not.toBeNull()
    const [paris] = pointsFor({
      kind: "map",
      region: "europe",
      points: [{ lat: 48.86, lon: 2.35, label: "Paris" }],
    })
    expect(paris!.x).toBeGreaterThan(0)
  })

  it("finds the small country nearest a tap, within reach", () => {
    const spots = spotsFor("europe")
    const lu = spots.find((s) => s.code === "LU")!
    expect(nearestSmall(lu.x + 2, lu.y - 2, spots, 1)).toBe("LU")
    expect(nearestSmall(lu.x + 200, lu.y, spots, 1)).not.toBe("LU")
  })

  it("keeps names off each other and off the dots", () => {
    // A place's name goes after its dot; with another dot in the way there, before it.
    const out = placeLabels(
      [
        {
          text: "Paris",
          x: 100,
          y: 100,
          half: [4, 4],
          onTop: false,
          place: true,
        },
        {
          text: "Lyon",
          x: 150,
          y: 140,
          half: [4, 4],
          onTop: false,
          place: true,
        },
      ],
      [
        { x: 100, y: 100 },
        { x: 150, y: 140 },
        { x: 170, y: 140 },
      ],
      1,
      300
    )
    expect(out[0]).toMatchObject({ anchor: "start", x: 107, y: 100 })
    expect(out[1]).toMatchObject({ anchor: "end", x: 143, y: 140 })
  })
})
