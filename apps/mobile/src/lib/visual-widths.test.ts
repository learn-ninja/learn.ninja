import { describe, expect, it } from "vitest"

import { columnWidth, optionCardWidths, orderItemWidth } from "./visual-widths"

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

describe("option card widths", () => {
  it("stacks a pair at the column's width, inside the panel", () => {
    expect(optionCardWidths(402, 2)).toEqual([360])
  })

  it("puts three or more two a row, and an odd last card across the row", () => {
    expect(optionCardWidths(402, 4)).toEqual([169])
    expect(optionCardWidths(402, 3)).toEqual([169, 360])
  })
})
