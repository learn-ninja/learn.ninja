import "server-only"

import * as Plot from "@observablehq/plot"
import { parseHTML } from "linkedom"

import type { ChartVisual, FunctionChartVisual } from "@workspace/spec"

import { sampleExpression, type Point } from "./curve"

// Server-only: draws a lesson's chart visuals with Observable Plot into plain SVG, once per lesson,
// so the learner's browser loads no chart library and the frame runs no script. Colors are the
// theme's tokens, so one drawing serves light and dark.

/** One series takes the primary color; more take these, in order. */
const SERIES_COLORS = [
  "var(--primary)",
  "var(--chart-2)",
  "var(--muted-foreground)",
]
const TREND_COLOR = "var(--chart-2)"

// linkedom, not jsdom: jsdom crashed the publish routes on Vercel, and Plot only needs to build elements.
let doc: Document | null = null
const documentFor = () =>
  (doc ??= parseHTML("<!doctype html><html><body></body></html>")
    .document as unknown as Document)

/** The chart as an SVG string. `compact` is for option and item cards, which are narrower. */
export function renderChart(chart: ChartVisual, compact = false): string {
  if (chart.type === "function") return renderFunctionChart(chart, compact)
  const data = chart.data
  const series = [
    ...new Set(data.map((d) => d.series).filter(Boolean)),
  ] as string[]
  const byseries = series.length > 0
  const numericX = data.every((d) => typeof d.x === "number")
  const categories = [...new Set(data.map((d) => String(d.x)))]
  const color = {
    domain: series,
    range: SERIES_COLORS.slice(0, Math.max(1, series.length)),
  }
  const fill = byseries ? "series" : SERIES_COLORS[0]
  const marks: Plot.Markish[] = []
  const x: Plot.ScaleOptions = { label: chart.x?.label ?? null, nice: true }
  const y: Plot.ScaleOptions = {
    label: chart.y?.label ?? null,
    nice: true,
    grid: true,
  }

  if (chart.type === "scatter") {
    x.grid = true
    if (chart.trend)
      marks.push(
        Plot.linearRegressionY(data, {
          x: "x",
          y: "y",
          ci: 0,
          stroke: byseries ? "series" : TREND_COLOR,
        })
      )
    marks.push(Plot.dot(data, { x: "x", y: "y", r: compact ? 3.5 : 4.5, fill }))
    if (data.some((d) => d.label))
      marks.push(
        Plot.text(data, {
          x: "x",
          y: "y",
          text: "label",
          dy: compact ? -9 : -11,
          fill: "var(--muted-foreground)",
        })
      )
    // The legend: a swatch and name per series, in the top start corner.
    series.forEach((name, i) => {
      const dy = 6 + i * (compact ? 15 : 17)
      marks.push(
        Plot.dot([name], {
          frameAnchor: "top-left",
          dx: 10,
          dy,
          r: 4,
          fill: () => name,
        }),
        Plot.text([name], {
          frameAnchor: "top-left",
          dx: 20,
          dy,
          text: (d: string) => d,
          textAnchor: "start",
          fill: () => name,
        })
      )
    })
  } else {
    // Bars and lines keep the lesson's order: the months stay Jan to Dec, not alphabetical.
    if (chart.type === "bar" || !numericX) x.domain = categories
    if (chart.type === "bar") {
      x.nice = false
      marks.push(
        Plot.barY(data, { x: "x", y: "y", fill, rx: 3 }),
        Plot.ruleY([0])
      )
    } else {
      marks.push(
        Plot.lineY(data, { x: "x", y: "y", stroke: fill, strokeWidth: 2 })
      )
      if (data.length <= 24)
        marks.push(Plot.dot(data, { x: "x", y: "y", r: 3, fill }))
      // Each line is named at its end, where a legend would make the reader look away.
      if (byseries) {
        const ends = series.map((name) =>
          data.filter((d) => d.series === name).at(-1)!
        )
        marks.push(
          Plot.text(ends, {
            x: "x",
            y: "y",
            text: "series",
            dx: 8,
            textAnchor: "start",
            fill: "series",
          })
        )
      }
    }
  }

  return plot({
    compact,
    labelsAtEnd: chart.type === "line" && byseries,
    x,
    y,
    color,
    marks,
  })
}

/**
 * A function chart: each expression sampled across the x range (curve.ts) and drawn as a line,
 * broken where it has no finite value, clipped to the y range when the lesson gives one, with the
 * axes through the origin when it's in view. Curves are named at their ends, like a line chart's.
 */
function renderFunctionChart(
  chart: FunctionChartVisual,
  compact: boolean
): string {
  interface Sample {
    x: number
    y: number
    series: string
  }
  const names = chart.series.map((s) => s.label ?? s.expression)
  const byseries = names.length > 1
  const curves = chart.series.map((s) => {
    const sampled = sampleExpression(s.expression, chart.x)
    // checkFunctionCharts() rejects these at publish time; a stored lesson draws what it can.
    return "error" in sampled ? [] : sampled.points
  })
  const ys = curves.flat().map((p) => p.y).filter(Number.isFinite)
  const given = { min: chart.y?.min, max: chart.y?.max }
  const yMin = given.min ?? (ys.length ? Math.min(...ys) : -1)
  const yMax = given.max ?? (ys.length ? Math.max(...ys) : 1)
  const ranged = given.min !== undefined || given.max !== undefined
  const data: Sample[] = curves.flatMap((points, i) =>
    breakAsymptotes(points, yMax - yMin).map((p) => ({
      ...p,
      series: names[i]!,
    }))
  )
  const x: Plot.ScaleOptions = {
    label: chart.x.label ?? null,
    domain: [chart.x.min, chart.x.max],
    grid: true,
  }
  const y: Plot.ScaleOptions = {
    label: chart.y?.label ?? null,
    grid: true,
    ...(ranged ? { domain: [yMin, yMax] } : { nice: true }),
  }
  const stroke = byseries ? "series" : SERIES_COLORS[0]
  const marks: Plot.Markish[] = []
  if (chart.x.min <= 0 && chart.x.max >= 0) marks.push(Plot.ruleX([0]))
  if (yMin <= 0 && yMax >= 0) marks.push(Plot.ruleY([0]))
  marks.push(
    Plot.lineY(data, {
      x: "x",
      y: "y",
      z: "series",
      stroke,
      strokeWidth: 2,
      clip: true,
    })
  )
  if (byseries) {
    // Each curve is named where it ends: its last point that's finite and inside the y range.
    const inRange = (d: Sample) =>
      Number.isFinite(d.y) && (!ranged || (d.y >= yMin && d.y <= yMax))
    const ends = names.flatMap((name) => {
      const end = data.filter((d) => d.series === name && inRange(d)).at(-1)
      return end ? [end] : []
    })
    marks.push(
      Plot.text(ends, {
        x: "x",
        y: "y",
        text: "series",
        dx: 8,
        textAnchor: "start",
        fill: "series",
      })
    )
  }
  return plot({
    compact,
    labelsAtEnd: byseries,
    x,
    y,
    color: { domain: names, range: SERIES_COLORS.slice(0, names.length) },
    marks,
  })
}

/**
 * A gap where a curve jumps across the whole frame between two samples with opposite signs (tan(x)
 * at pi/2, 1/x at 0): it's an asymptote, not a line to draw. A steep but real curve moves far less
 * than the frame's height in a two-hundredth of the x range.
 */
function breakAsymptotes(points: Point[], span: number): Point[] {
  const out: Point[] = []
  points.forEach((p, i) => {
    const prev = points[i - 1]
    if (
      prev &&
      Number.isFinite(prev.y) &&
      Number.isFinite(p.y) &&
      Math.sign(prev.y) !== Math.sign(p.y) &&
      Math.abs(p.y - prev.y) > span
    )
      out.push({ x: (prev.x + p.x) / 2, y: NaN })
    out.push(p)
  })
  return out
}

/** Draws the marks at the chart's two sizes, in the theme's colors and the lesson's font. */
function plot({
  compact,
  labelsAtEnd,
  x,
  y,
  color,
  marks,
}: {
  compact: boolean
  /** Room on the end side for the names of lines labelled at their ends. */
  labelsAtEnd: boolean
  x: Plot.ScaleOptions
  y: Plot.ScaleOptions
  color: Plot.ScaleOptions
  marks: Plot.Markish[]
}): string {
  const svg = Plot.plot({
    document: documentFor(),
    className: "chart",
    width: compact ? 320 : 480,
    height: compact ? 220 : 300,
    marginLeft: compact ? 40 : 48,
    marginBottom: compact ? 36 : 44,
    marginRight: labelsAtEnd ? (compact ? 64 : 80) : compact ? 16 : 20,
    style: {
      background: "transparent",
      color: "var(--muted-foreground)",
      fontFamily: "inherit",
      fontSize: compact ? "11px" : "12px",
      overflow: "visible",
    },
    x,
    y,
    color,
    marks,
  })
  return (svg as unknown as Element).outerHTML
}
