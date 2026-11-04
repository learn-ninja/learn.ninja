import { describe, expect, it } from "vitest"

import { binAt, moveItem } from "./sort"

describe("sorting", () => {
  it("moves an item between zones", () => {
    expect(moveItem({ pool: ["a", "b"], x: [] }, "a", "x")).toEqual({
      pool: ["b"],
      x: ["a"],
    })
  })
  it("finds the bin under a drop, or none", () => {
    const bins = [
      { x: 0, y: 100, width: 150, height: 80 },
      { x: 160, y: 100, width: 150, height: 80 },
    ]
    expect(binAt(bins, 10, 110)).toBe(0)
    expect(binAt(bins, 200, 170)).toBe(1)
    expect(binAt(bins, 200, 50)).toBe(-1)
  })
})
