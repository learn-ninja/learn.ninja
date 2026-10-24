import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import type {
  ClockVisual,
  FractionVisual,
  NumberLineVisual,
} from "@workspace/spec"

import { Clock, Fractions, NumberLine } from "./figures"

// The math figures are laid out from a few numbers, so the drawing has to say what the numbers do.

const line = (over: Partial<NumberLineVisual>) =>
  renderToStaticMarkup(
    createElement(NumberLine, {
      line: { kind: "numberline", alt: "A line.", min: 0, max: 4, ...over },
    })
  )
const labels = (svg: string) =>
  [...svg.matchAll(/<text[^>]*>([^<]*)<\/text>/g)].map((m) => m[1])

describe("NumberLine", () => {
  it("numbers every tick, without float noise and with a real minus sign", () => {
    expect(labels(line({ min: -2, max: 2 }))).toEqual([
      "−2",
      "−1",
      "0",
      "1",
      "2",
    ])
    expect(labels(line({ min: 0, max: 0.3, step: 0.1 }))).toEqual([
      "0",
      "0.1",
      "0.2",
      "0.3",
    ])
  })

  it("numbers the ticks as fractions in lowest terms when asked", () => {
    expect(
      labels(line({ min: 0, max: 1.5, step: 0.25, fractions: true }))
    ).toEqual(["0", "1/4", "1/2", "3/4", "1", "5/4", "3/2"])
    // A third written as 0.334 still reaches 2 in exact thirds.
    expect(
      labels(line({ min: 0, max: 2, step: 0.334, fractions: true }))
    ).toEqual(["0", "1/3", "2/3", "1", "4/3", "5/3", "2"])
  })

  it("draws a jump's label and a point's label", () => {
    const svg = line({
      jumps: [{ from: 1, to: 3, label: "+2" }],
      points: [{ value: 3, label: "A", open: true }],
    })
    expect(labels(svg)).toContain("+2")
    expect(labels(svg)).toContain("A")
    expect(svg).toContain("<path")
  })
})

describe("Fractions", () => {
  const figure = (over: Partial<FractionVisual>) =>
    renderToStaticMarkup(
      createElement(Fractions, {
        figure: {
          kind: "fraction",
          alt: "Fractions.",
          fractions: [
            { parts: 4, shaded: 3 },
            { parts: 2, shaded: 1, label: "half" },
          ],
          ...over,
        },
      })
    )

  it("cuts each whole into its parts and shades the numerator", () => {
    const bars = figure({})
    expect(bars.match(/<rect/g)).toHaveLength(6)
    expect(bars.match(/fill="var\(--chart-2\)"/g)).toHaveLength(4)
    expect(labels(bars)).toEqual(["3", "4", "half"])
    const circles = figure({ shape: "circle" })
    expect(circles.match(/<path/g)).toHaveLength(6)
    expect(circles.match(/fill="var\(--chart-2\)"/g)).toHaveLength(4)
  })
})

describe("Clock", () => {
  const hands = (time: string, over: Partial<ClockVisual> = {}) => {
    const svg = renderToStaticMarkup(
      createElement(Clock, {
        clock: { kind: "clock", alt: "A clock.", time, ...over },
      })
    )
    // The last two lines are the hands, hour then minute: where each one's tip is.
    const tips = [...svg.matchAll(/<line[^>]*x2="([^"]+)" y2="([^"]+)"/g)]
      .slice(-2)
      .map((m) => [Math.round(Number(m[1])), Math.round(Number(m[2]))])
    return { svg, tips }
  }

  it("points the hands where the time says, 12- or 24-hour", () => {
    // 3:00: the hour hand at 3 (right of the center), the minute hand at 12 (above it).
    expect(hands("3:00").tips).toEqual([
      [164, 120],
      [120, 56],
    ])
    expect(hands("15:00").tips).toEqual(hands("3:00").tips)
    // 6:30: the hour hand halfway from 6 to 7, the minute hand straight down.
    const [hour, minute] = hands("6:30").tips
    expect(minute).toEqual([120, 184])
    expect(hour![0]).toBeLessThan(120)
  })

  it("numbers the face unless told not to", () => {
    expect(labels(hands("3:00").svg)).toHaveLength(12)
    expect(labels(hands("3:00", { numbers: false }).svg)).toHaveLength(0)
  })
})
