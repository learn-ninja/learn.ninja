import { describe, expect, it } from "vitest"

import { moveSlot, slotAfterDrag } from "./order-drag"

describe("dragging a placed order item", () => {
  const heights = [40, 40, 40, 40]
  it("stays put under half a row", () => {
    expect(slotAfterDrag(heights, 1, 20, 8)).toBe(1)
    expect(slotAfterDrag(heights, 1, -20, 8)).toBe(1)
  })
  it("moves a row per row's height, up or down, within the list", () => {
    expect(slotAfterDrag(heights, 0, 48, 8)).toBe(1)
    expect(slotAfterDrag(heights, 0, 100, 8)).toBe(2)
    expect(slotAfterDrag(heights, 0, 1000, 8)).toBe(3)
    expect(slotAfterDrag(heights, 3, -1000, 8)).toBe(0)
  })
  it("shifts the items between to make room", () => {
    expect(moveSlot(["a", "b", "c", null], 0, 2)).toEqual(["b", "c", "a", null])
    expect(moveSlot(["a", "b", "c", null], 2, 0)).toEqual(["c", "a", "b", null])
  })
})
