import { describe, expect, it } from "vitest"

import { alpha, mix, parseColor } from "./color"

describe("colors", () => {
  it("reads hex and rgba", () => {
    expect(parseColor("#00a63e")).toEqual([0, 166, 62, 1])
    expect(parseColor("#fff")).toEqual([255, 255, 255, 1])
    expect(parseColor("rgba(255, 255, 255, 0.1)")).toEqual([255, 255, 255, 0.1])
    expect(parseColor("rgb(1 2 3 / 50%)")).toEqual([1, 2, 3, 0.5])
    expect(parseColor("var(--x)")).toBeNull()
  })

  it("tints at an opacity, keeping an rgba's own", () => {
    expect(alpha("#00a63e", 0.1)).toBe("rgba(0, 166, 62, 0.1)")
    expect(alpha("rgba(255, 255, 255, 0.15)", 0.3)).toBe(
      "rgba(255, 255, 255, 0.045)"
    )
  })

  it("mixes two colors as color-mix does", () => {
    expect(mix("#ffffff", 50, "#000000")).toBe("#808080")
    expect(mix("#00a63e", 10, "#121212")).toBe("#102116")
    // A transparent color weighs by its alpha: 50% of a 0.5-alpha white over black is a quarter white.
    expect(mix("rgba(255, 255, 255, 0.5)", 50, "#000000")).toBe(
      "rgba(85, 85, 85, 0.75)"
    )
  })
})
