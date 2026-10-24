import { describe, expect, it } from "vitest"

import type { ChartVisual } from "@workspace/spec"

import { renderChart } from "./chart"
import { chartKey } from "./prepared"

// Charts are drawn on the server into SVG that carries only theme tokens, so one drawing serves
// light and dark and the frame runs no script.

const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun"]
const scatter: ChartVisual = {
  kind: "chart",
  type: "scatter",
  alt: "Drownings rise with ice cream sales.",
  x: { label: "Ice cream sales" },
  y: { label: "Drownings" },
  data: months.map((label, i) => ({ x: 10 + i * 8, y: 2 + i, label })),
}

describe("renderChart", () => {
  it("draws a scatter with axis labels, point labels, and theme colors", () => {
    const svg = renderChart(scatter)
    expect(svg.startsWith("<svg")).toBe(true)
    expect(svg).toContain("Ice cream sales")
    expect(svg).toContain("Drownings")
    expect(svg).toContain(">Mar<")
    expect(svg).toContain("var(--primary)")
    expect(svg).toContain("var(--muted-foreground)")
    expect(svg).not.toContain("<script")
    expect(svg).toMatch(/background:\s*transparent/)
  })

  it("keeps a bar chart's categories in the lesson's order", () => {
    const svg = renderChart({
      kind: "chart",
      type: "bar",
      data: [
        { x: "Sep", y: 3 },
        { x: "Jan", y: 1 },
        { x: "May", y: 2 },
      ],
    })
    const order = ["Sep", "Jan", "May"].map((m) => svg.indexOf(`>${m}<`))
    expect(order.every((i) => i >= 0)).toBe(true)
    expect(order).toEqual([...order].sort((a, b) => a - b))
  })

  it("names each line of a line chart at its end and adds a trend to a scatter", () => {
    const svg = renderChart({
      kind: "chart",
      type: "line",
      data: [
        { x: "Jan", y: 1, series: "Ice cream" },
        { x: "Feb", y: 2, series: "Ice cream" },
        { x: "Jan", y: 4, series: "Drownings" },
        { x: "Feb", y: 3, series: "Drownings" },
      ],
    })
    expect(svg).toContain(">Ice cream<")
    expect(svg).toContain(">Drownings<")
    expect(svg).toContain("var(--chart-2)")
    const trend = renderChart({ ...scatter, trend: true })
    expect(trend.length).toBeGreaterThan(renderChart(scatter).length)
  })

  it("draws smaller for option and item cards, and the same chart the same way", () => {
    const full = renderChart(scatter)
    const compact = renderChart(scatter, true)
    expect(compact).toContain('width="320"')
    expect(full).toContain('width="480"')
    expect(renderChart(scatter)).toBe(full)
  })
})

describe("renderChart (function)", () => {
  const growth: ChartVisual = {
    kind: "chart",
    type: "function",
    alt: "Compound interest pulls away from simple interest.",
    x: { label: "Years", min: 0, max: 30 },
    y: { label: "Balance", min: 0 },
    series: [
      { expression: "1000 * 1.07^x", label: "Compound" },
      { expression: "1000 + 70x", label: "Simple" },
    ],
  }

  it("draws each curve in a series color, named at its end, with axis labels", () => {
    const svg = renderChart(growth)
    expect(svg.startsWith("<svg")).toBe(true)
    expect(svg).toContain("Years")
    expect(svg).toContain("Balance")
    expect(svg).toContain(">Compound<")
    expect(svg).toContain(">Simple<")
    expect(svg).toContain("var(--primary)")
    expect(svg).toContain("var(--chart-2)")
    expect(svg).not.toContain("<script")
    expect(renderChart(growth, true)).toContain('width="320"')
  })

  it("keeps the x range as given and clips curves to the y range", () => {
    const svg = renderChart({
      kind: "chart",
      type: "function",
      alt: "The tangent function.",
      x: { min: -3, max: 3 },
      y: { min: -4, max: 4 },
      series: [{ expression: "tan(x)" }],
    })
    expect(svg).toContain(">−3<")
    expect(svg).toContain(">3<")
    expect(svg).toContain(">4<")
    expect(svg).not.toContain(">5<")
    expect(svg).toContain("clip-path")
    // The curve breaks at each asymptote instead of drawing a vertical line across the frame.
    const curve = svg.match(/<path d="(M[^"]{200,})"/)?.[1] ?? ""
    expect(curve.match(/M/g)).toHaveLength(3)
  })

  it("draws what it can when an expression doesn't read, rather than failing the page", () => {
    const svg = renderChart({
      kind: "chart",
      type: "function",
      alt: "A parabola.",
      x: { min: -2, max: 2 },
      series: [{ expression: "x^2" }, { expression: "nope(x)", label: "?" }],
    })
    expect(svg).toContain(">x^2<")
    expect(svg).toContain("<path")
    expect(() =>
      renderChart({
        kind: "chart",
        type: "function",
        alt: "Nothing.",
        x: { min: -2, max: 2 },
        series: [{ expression: "sqrt(-1 - x^2)" }],
      })
    ).not.toThrow()
  })
})

describe("renderChart (points and planes)", () => {
  it("marks points on a curve with their labels", () => {
    const svg = renderChart({
      kind: "chart",
      type: "function",
      alt: "A parabola with its roots marked.",
      x: { min: -4, max: 4 },
      series: [{ expression: "x^2 - 4" }],
      points: [
        { x: -2, y: 0, label: "root" },
        { x: 0, y: -4 },
      ],
    })
    expect(svg).toContain(">root<")
    expect(svg.match(/<circle/g)).toHaveLength(2)
    expect(svg).toContain('height="300"')
  })

  it("draws points alone as a plane: equal units, the origin in view, a line at every unit", () => {
    const svg = renderChart({
      kind: "chart",
      type: "function",
      alt: "Three points on a plane.",
      x: { min: -5, max: 5 },
      points: [
        { x: 2, y: 3, label: "A" },
        { x: 1, y: -2, label: "C" },
      ],
    })
    // y runs from −3 to 4 (the points with a unit to spare): 7 units against x's 10, so the plot
    // area is 0.7 times as tall as it is wide: 412 × 0.7 plus the margins.
    expect(svg).toContain('height="352"')
    for (const tick of ["−5", "−1", "1", "5", "−3", "4"])
      expect(svg).toContain(`>${tick}<`)
    expect(svg).not.toContain(">4.0<")
  })
})

describe("chartKey", () => {
  it("ignores key order, since Postgres jsonb reorders a stored lesson's keys", () => {
    const reordered = JSON.parse(
      JSON.stringify(Object.fromEntries(Object.entries(scatter).reverse()))
    )
    reordered.data = scatter.data.map((d) =>
      Object.fromEntries(Object.entries(d).reverse())
    )
    expect(chartKey(reordered, false)).toBe(chartKey(scatter, false))
    expect(chartKey(scatter, true)).not.toBe(chartKey(scatter, false))
  })
})
