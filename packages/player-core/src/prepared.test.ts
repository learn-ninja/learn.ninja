import { describe, expect, it } from "vitest"

import { mathKey, parseMathKey } from "./prepared"

describe("math keys", () => {
  it("read back as the formula and its kind", () => {
    for (const [tex, display] of [
      ["x^2", false],
      ["\\frac{a:b}{c}", true],
      ["", false],
    ] as const)
      expect(parseMathKey(mathKey(tex, display))).toEqual({ tex, display })
  })

  it("aren't anything else", () => {
    expect(parseMathKey("c:abc")).toBeNull()
    expect(parseMathKey("x")).toBeNull()
  })
})
