import { describe, expect, it } from "vitest"

import { smokeWords } from "./smoke-words"

describe("smokeWords", () => {
  it("keeps a space after every word but the last, one iOS won't trim", () => {
    expect(smokeWords("  Button   hierarchy ")).toEqual([
      "Button ",
      "hierarchy",
    ])
    expect(smokeWords("Solo")).toEqual(["Solo"])
  })
})
