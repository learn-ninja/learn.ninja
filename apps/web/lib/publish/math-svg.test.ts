import { describe, expect, it } from "vitest"

import { emptyPrepared, mathKey } from "@workspace/player-core/prepared"

import { drawLessonMath, drawMath } from "./math-svg"

describe("formulas drawn for the app", () => {
  it("draws a formula as a sizeless SVG in currentColor, measured in em from the baseline", () => {
    const half = drawMath("\\frac{1}{2}", false)!
    expect(half.svg).toMatch(
      /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" viewBox="[^"]+">/
    )
    expect(/^<svg[^>]*>/.exec(half.svg)?.[0]).not.toMatch(/width|height|style/)
    expect(half.svg).not.toContain("data-")
    expect(half.svg).toContain('fill="currentColor"')
    // A fraction stands on the baseline's axis: well above it and a little below.
    expect(half.ascent).toBeGreaterThan(0.8)
    expect(half.descent).toBeGreaterThan(0.2)
    expect(half.width).toBeGreaterThan(0.5)
    // A lowercase x sits on the baseline, about an x-height tall.
    const x = drawMath("x", false)!
    expect(x.ascent).toBeCloseTo(0.442, 2)
    expect(x.descent).toBeLessThan(0.02)
  })

  it("leaves out what MathJax can't read, so the app shows its source", () => {
    expect(drawMath("\\notacommand", false)).toBeNull()
    expect(drawMath("\\frac{1}", false)).toBeNull()
  })

  it("draws every formula the lesson prepared, by the same keys", () => {
    const prepared = {
      ...emptyPrepared,
      math: {
        [mathKey("x^2", false)]: "<span>…</span>",
        [mathKey("\\sum_i i", true)]: "<span>…</span>",
        [mathKey("\\oops", false)]: "<span>…</span>",
      },
    }
    expect(Object.keys(drawLessonMath(prepared)).sort()).toEqual(
      [mathKey("x^2", false), mathKey("\\sum_i i", true)].sort()
    )
  })
})
