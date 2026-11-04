import { describe, expect, it } from "vitest"

import { binAt, moveItem } from "./sort-drop"

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
  it("places the bins where their row sits in the kata, below the deck", () => {
    // Three bins stacked in their own row, which starts 96 points down, under the deck.
    const bins = [
      { x: 0, y: 0, width: 370, height: 74 },
      { x: 0, y: 82, width: 370, height: 74 },
      { x: 0, y: 164, width: 370, height: 74 },
    ]
    const row = { x: 0, y: 96 }
    // A card dropped on the second bin's middle, in the kata's coordinates.
    expect(binAt(bins, 185, 96 + 82 + 37, row)).toBe(1)
    // Over the deck, above every bin: no bin.
    expect(binAt(bins, 185, 40, row)).toBe(-1)
  })
})
