import { describe, expect, it } from "vitest"

import { SETTLE_MS, settled } from "./screen-guard"

describe("settled", () => {
  it("ignores Continue while a new screen arrives, then takes it", () => {
    // A double tap 150 ms apart: the second lands on the screen the first opened.
    expect(settled(1000, 1150)).toBe(false)
    expect(settled(1000, 1000 + SETTLE_MS)).toBe(true)
    expect(settled(1000, 5000)).toBe(true)
  })
})
