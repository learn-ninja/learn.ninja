import { describe, expect, it } from "vitest"

import { validateLesson, type Lesson } from "@workspace/spec"

import buttonHierarchy from "../../../examples/button-hierarchy.json"
import {
  checkFunctionCharts,
  parseExpression,
  SAMPLES,
  sampleExpression,
} from "./curve"

// Function charts are drawn from LLM-written expressions, so the parser only lets arithmetic and a
// list of functions through, and anything that doesn't draw is rejected with a message that says
// what to fix.

const f = (expression: string) => {
  const parsed = parseExpression(expression)
  if ("error" in parsed) throw new Error(parsed.error)
  return parsed.f
}
const errorOf = (expression: string, x = { min: -5, max: 5 }) => {
  const sampled = sampleExpression(expression, x)
  if (!("error" in sampled)) throw new Error(`"${expression}" was accepted`)
  return sampled.error
}

describe("parseExpression", () => {
  it("reads arithmetic, powers, implicit multiplication, constants, and common functions", () => {
    expect(f("2x^2 - 3x + 1")(2)).toBe(3)
    expect(f("1000 * 1.05^x")(2)).toBeCloseTo(1102.5)
    expect(f("sin(x)")(Math.PI / 2)).toBeCloseTo(1)
    expect(f("e^x")(1)).toBeCloseTo(Math.E)
    expect(f("ln(x)")(Math.E)).toBeCloseTo(1)
    expect(f("log(x, 10)")(1000)).toBeCloseTo(3)
    expect(f("2 pi x")(1)).toBeCloseTo(2 * Math.PI)
    expect(f("x!")(4)).toBe(24)
    expect(f("abs(x) + max(x, 0) - floor(x)")(-1.5)).toBe(3.5)
    expect(f("-x mod 3")(5)).toBe(1)
  })

  it("gives NaN, not a complex number or an error, where there's no real value", () => {
    expect(f("sqrt(x)")(-1)).toBeNaN()
    expect(f("ln(x)")(-1)).toBeNaN()
    expect(f("1 / x")(0)).toBe(Infinity)
  })

  it("rejects anything that isn't a formula in x, saying what to write instead", () => {
    const rejected: [string, RegExp][] = [
      ["x = 2", /no "=", lists, conditions, or indexes/],
      ["f(x) = x^2", /no "="/],
      ["[1, 2, 3]", /no "="/],
      ["x > 1 ? 1 : 0", /conditions/],
      ["x[1]", /indexes/],
      ["x.constructor", /indexes/],
      ["1:3", /formula in x/],
      ["{a: 1}", /formula in x/],
      ["import({})", /"import" isn't a function a chart can draw/],
      ['evaluate("1")', /"evaluate" isn't a function/],
      [
        "gamma(x)",
        /isn't a function a chart can draw\. The functions are sin, cos/,
      ],
      ["5 cm", /"cm" isn't known in a chart expression: the variable is "x"/],
      ["y + 1", /"y" isn't known/],
      ["sin x", /"sin" is a function, so it needs parentheses: "sin\(x\)"/],
      ["x'", /operator "'" can't be used/],
      ["x == 1", /operator "==" can't be used/],
      ["true", /Only numbers/],
      ['"text"', /Only numbers/],
      ["2 +", /Can't read the expression "2 \+": Unexpected end of expression/],
    ]
    for (const [expression, message] of rejected) {
      const parsed = parseExpression(expression)
      expect(parsed, expression).toHaveProperty("error")
      expect(("error" in parsed && parsed.error) || "", expression).toMatch(
        message
      )
    }
  })
})

describe("sampleExpression", () => {
  it("samples evenly across the range, with gaps where the value isn't finite", () => {
    const sampled = sampleExpression("sqrt(x)", { min: -2, max: 2 })
    if ("error" in sampled) throw new Error(sampled.error)
    expect(sampled.points).toHaveLength(SAMPLES)
    expect(sampled.points[0]).toEqual({ x: -2, y: NaN })
    expect(sampled.points.at(-1)).toEqual({ x: 2, y: Math.SQRT2 })
    const gaps = sampled.points.filter((p) => Number.isNaN(p.y)).length
    expect(gaps).toBeGreaterThan(SAMPLES / 2 - 2)
    expect(gaps).toBeLessThan(SAMPLES / 2 + 2)
  })

  it("rejects a curve with no finite point in the range, or one that takes too long", () => {
    expect(errorOf("sqrt(x)", { min: -5, max: -1 })).toMatch(
      /"sqrt\(x\)" has no finite value anywhere from x = -5 to -1 .*Change the expression or the x range/
    )
    expect(errorOf("1 / 0")).toMatch(/no finite value/)
    const slow = sampleExpression("x", { min: 0, max: 1 }, -1)
    expect("error" in slow && slow.error).toMatch(/takes too long to compute/)
  })

  it("samples a curve once for the check and every drawing of it", () => {
    const first = sampleExpression("x^3 - x", { min: -2, max: 2 })
    expect(sampleExpression("x^3 - x", { min: -2, max: 2 })).toBe(first)
    expect(sampleExpression("x^3 - x", { min: -2, max: 3 })).not.toBe(first)
  })
})

describe("checkFunctionCharts", () => {
  it("reports each unreadable or undrawable curve at its path", () => {
    const result = validateLesson(buttonHierarchy)
    if (!result.ok) throw new Error("example invalid")
    const lesson: Lesson = structuredClone(result.lesson)
    const brick = lesson.bricks[0]!
    if (brick.type !== "concept") throw new Error("expected a concept")
    brick.visual = {
      kind: "chart",
      type: "function",
      alt: "Three curves.",
      x: { min: 1, max: 5 },
      series: [
        { expression: "x^2" },
        { expression: "sqrt(-x)" },
        { expression: "x = 1" },
      ],
    }
    expect(validateLesson(lesson).ok).toBe(true)
    const issues = checkFunctionCharts(lesson)
    expect(issues.map((i) => i.path)).toEqual([
      "bricks[0].visual.series[1].expression",
      "bricks[0].visual.series[2].expression",
    ])
    expect(issues[0]!.message).toMatch(/no finite value/)
    expect(issues[1]!.message).toMatch(/formula in x/)
    expect(issues.every((i) => i.kind === "structure")).toBe(true)
  })

  it("rejects one end of the y axis that the curves never reach past", () => {
    const result = validateLesson(buttonHierarchy)
    if (!result.ok) throw new Error("example invalid")
    const lesson: Lesson = structuredClone(result.lesson)
    const brick = lesson.bricks[0]!
    if (brick.type !== "concept") throw new Error("expected a concept")
    const chart = (y: { min?: number; max?: number }) => ({
      kind: "chart" as const,
      type: "function" as const,
      alt: "A parabola.",
      x: { min: -1, max: 1 },
      y,
      series: [{ expression: "x^2" }],
    })
    brick.visual = chart({ min: 2 })
    expect(checkFunctionCharts(lesson)).toEqual([
      expect.objectContaining({
        path: "bricks[0].visual.y.min",
        message: expect.stringMatching(/stay at or below "y.min" \(2\)/),
      }),
    ])
    brick.visual = chart({ max: -1 })
    expect(checkFunctionCharts(lesson).map((i) => i.path)).toEqual([
      "bricks[0].visual.y.max",
    ])
    // Reaching past the given end, or with both ends given, is fine.
    brick.visual = chart({ min: 0.5 })
    expect(checkFunctionCharts(lesson)).toEqual([])
    brick.visual = chart({ min: 2, max: 3 })
    expect(checkFunctionCharts(lesson)).toEqual([])
  })
})
