import { describe, expect, it } from "vitest"

import { columnWidth, orderItemWidth } from "./visual-widths"

describe("visual widths", () => {
  it("keeps the column inside the window's padding, up to max-w-2xl", () => {
    expect(columnWidth(402)).toBe(370)
    expect(columnWidth(1024)).toBe(672)
  })

  it("lays an order kata's visual out at half the column, inside the card", () => {
    // Two cards a row with gap-2, each with p-2 and a border.
    expect(orderItemWidth(402)).toBe(181 - 18)
    expect(orderItemWidth(375)).toBe(167 - 18)
    expect(orderItemWidth(1024)).toBe(332 - 18)
  })
})
