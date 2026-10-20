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
