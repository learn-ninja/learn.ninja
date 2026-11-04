import { describe, expect, it } from "vitest"

import { overlaysFor } from "./spots"

const spots = [
  { id: "a", label: "A", top: 10, left: 20, width: 100, height: 30 },
  { id: "b", label: "B", top: 50, left: 20, width: 100, height: 30 },
]

describe("hotspot overlays", () => {
  it("draws nothing at rest", () => {
    expect(
      overlaysFor(spots, { selected: [], marks: {}, reveal: false })
    ).toEqual([])
  })

  it("tiles a picked part, grown by the ring", () => {
    expect(
      overlaysFor(spots, { selected: ["a"], marks: {}, reveal: false })
    ).toEqual([
      { id: "a", kind: "tile", top: 6, left: 16, width: 108, height: 38 },
    ])
  })

  it("tiles every part while they're being shown, except marked ones", () => {
    const out = overlaysFor(spots, {
      selected: [],
      marks: { b: "wrong" },
      reveal: true,
    })
    expect(out.map((o) => [o.id, o.kind])).toEqual([
      ["a", "tile"],
      ["b", "wrong"],
    ])
    expect(out[1]).toMatchObject({ top: 48, left: 18, width: 104, height: 34 })
  })

  it("lets a mark outrank the pick", () => {
    const out = overlaysFor(spots, {
      selected: ["a"],
      marks: { a: "correct" },
      reveal: false,
    })
    expect(out).toHaveLength(1)
    expect(out[0]!.kind).toBe("correct")
  })
})
