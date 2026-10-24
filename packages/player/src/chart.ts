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
 * axes through the origin when it's in view. Curves are named at their ends, like a line chart's,
 * and marked points carry their labels. Points with no curves make a coordinate plane, drawn with
 * equal units on both axes so a square on it looks square.
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
  const series = chart.series ?? []
  const points = chart.points ?? []
  const names = series.map((s) => s.label ?? s.expression)
  const byseries = names.length > 1
  const curves = series.map((s) => {
    const sampled = sampleExpression(s.expression, chart.x)
    // checkFunctionCharts() rejects these at publish time; a stored lesson draws what it can.
    return "error" in sampled ? [] : sampled.points
  })
  const plane = series.length === 0
  const given = { min: chart.y?.min, max: chart.y?.max }
  const broken = curves.map((c) =>
    breakAsymptotes(
      c,
      given.min !== undefined && given.max !== undefined
        ? given.max - given.min
        : undefined
    )
  )
  const poles = broken.some((c, i) => c.length > curves[i]!.length)
  const ys = [...curves.flat(), ...points]
    .map((p) => p.y)
    .filter(Number.isFinite)
  // A plane fits its points with a unit to spare, and keeps the origin in view. Curves with
  // asymptotes fit their bulk, not the spikes beside each asymptote, which would flatten the rest.
  const fit = plane
    ? [
        Math.min(0, Math.floor(Math.min(...ys)) - 1),
        Math.max(0, Math.ceil(Math.max(...ys)) + 1),
      ]
    : !ys.length
      ? [-1, 1]
      : poles
        ? bulk(
            curves
              .flat()
              .map((p) => p.y)
              .filter(Number.isFinite),
            points.map((p) => p.y)
          )
        : [Math.min(...ys), Math.max(...ys)]
  let yMin = given.min ?? fit[0]!
  let yMax = given.max ?? fit[1]!
  // With one end given, the curves may stay on its far side (checkFunctionCharts() rejects that at
  // publish time); keep the axis the right way up.
  if (!(yMin < yMax)) {
    if (given.min === undefined) yMin = yMax - 1
    else yMax = yMin + 1
  }
  const ranged =
    plane || poles || given.min !== undefined || given.max !== undefined
  const data: Sample[] = broken.flatMap((points, i) =>
    points.map((p) => ({ ...p, series: names[i]! }))
  )
  const x: Plot.ScaleOptions = {
    label: chart.x.label ?? null,
    domain: [chart.x.min, chart.x.max],
    grid: true,
  }
  const y: Plot.ScaleOptions = {
    label: chart.y?.label ?? null,
    grid: true,
    ...(ranged
      ? {
          domain: [yMin, yMax],
          // A fitted bulk rounds out to whole ticks; a range the lesson gives is kept as given.
          nice: !plane && given.min === undefined && given.max === undefined,
        }
      : { nice: true }),
  }
  if (plane) {
    // A plane is read square by square: a grid line at every whole unit, while there are few enough.
    const units = (lo: number, hi: number) =>
      hi - lo <= 16
        ? Array.from(
            { length: Math.floor(hi) - Math.ceil(lo) + 1 },
            (_, i) => Math.ceil(lo) + i
          )
        : undefined
    x.ticks = units(chart.x.min, chart.x.max)
    y.ticks = units(yMin, yMax)
    if (x.ticks) x.tickFormat = "d"
    if (y.ticks) y.tickFormat = "d"
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
  if (points.length) {
    // Each point is ringed in the background color, so it stands out on a curve of any color.
    marks.push(
      Plot.dot(points, {
        x: "x",
        y: "y",
        r: compact ? 3.5 : 4.5,
        fill: "var(--foreground)",
        stroke: "var(--background)",
        strokeWidth: 1.5,
      })
    )
    if (points.some((p) => p.label))
      marks.push(
        Plot.text(points, {
          x: "x",
          y: "y",
          text: "label",
          dy: compact ? -10 : -12,
          fill: "var(--foreground)",
          stroke: "var(--background)",
          strokeWidth: 3,
          paintOrder: "stroke",
        })
      )
  }
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
    unitRatio: plane ? (yMax - yMin) / (chart.x.max - chart.x.min) : undefined,
  })
}

const median = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b)
  const mid = sorted.length / 2
  return sorted.length % 2
    ? sorted[Math.floor(mid)]!
    : (sorted[mid - 1]! + sorted[mid]!) / 2
}

/**
 * A gap where a curve leaps from one side of its middle to the other between two samples (tan(x)
 * at pi/2, 1/x at 0): it's an asymptote, not a line to draw. Both samples are far out, many times
 * the curve's usual distance from its middle; a steep but real curve crosses its middle with one
 * of them close to it. With a y range given, a leap across the whole frame is one too.
 */
export function breakAsymptotes(points: Point[], span?: number): Point[] {
  const ys = points.map((p) => p.y).filter(Number.isFinite)
  if (ys.length < 2) return points
  const middle = median(ys)
  const spread = median(ys.map((y) => Math.abs(y - middle)))
  const out: Point[] = []
  points.forEach((p, i) => {
    const prev = points[i - 1]
    if (prev && Number.isFinite(prev.y) && Number.isFinite(p.y)) {
      const a = prev.y - middle
      const b = p.y - middle
      if (
        Math.sign(a) * Math.sign(b) < 0 &&
        (Math.min(Math.abs(a), Math.abs(b)) > 4 * spread ||
          (span !== undefined && Math.abs(p.y - prev.y) > span))
      )
        out.push({ x: (prev.x + p.x) / 2, y: NaN })
    }
    out.push(p)
  })
  return out
}

/**
 * The y range of curves' bulk: their middle 90%, with a quarter of that to spare on each side, and
 * every marked point in view.
 */
function bulk(ys: number[], marked: number[]): [number, number] {
  const sorted = [...ys].sort((a, b) => a - b)
  const lo = sorted[Math.floor(sorted.length * 0.05)]!
  const hi = sorted[Math.ceil(sorted.length * 0.95) - 1]!
  const pad = (hi - lo) / 4 || 1
  return [Math.min(lo - pad, ...marked), Math.max(hi + pad, ...marked)]
}

/** Draws the marks at the chart's two sizes, in the theme's colors and the lesson's font. */
function plot({
  compact,
  labelsAtEnd,
  x,
  y,
  color,
  marks,
  unitRatio,
}: {
  compact: boolean
  /** Room on the end side for the names of lines labelled at their ends. */
  labelsAtEnd: boolean
  x: Plot.ScaleOptions
  y: Plot.ScaleOptions
  color: Plot.ScaleOptions
  marks: Plot.Markish[]
  /** The y range over the x range, for a chart whose units must match on both axes (a plane). */
  unitRatio?: number
}): string {
  const width = compact ? 320 : 480
  const marginLeft = compact ? 40 : 48
  const marginBottom = compact ? 36 : 44
  const marginRight = labelsAtEnd ? (compact ? 64 : 80) : compact ? 16 : 20
  const marginTop = 20
  // Equal units: the plot area is as much taller than wide as the y range is longer than the x
  // range, within a height a phone can show (beyond it, the units stretch).
  const height =
    unitRatio === undefined
      ? compact
        ? 220
        : 300
      : Math.round(
          Math.min(
            Math.max(
              (width - marginLeft - marginRight) * unitRatio +
                marginTop +
                marginBottom,
              compact ? 180 : 220
            ),
            compact ? 320 : 480
          )
        )
  const svg = Plot.plot({
    document: documentFor(),
    className: "chart",
    width,
    height,
    marginTop,
    marginLeft,
    marginBottom,
    marginRight,
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
