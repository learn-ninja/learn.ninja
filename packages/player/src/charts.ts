import "server-only"

import type { ChartVisual, Lesson } from "@workspace/spec"

import { renderChart } from "./chart"
import { chartKey, type Prepared } from "./prepared"

// Charts drawn on the server, apart from the rest of the preparer: a published lesson's page calls
// withCharts on every view, and importing it from prepare.ts would load KaTeX, Shiki, D2, and
// OpenChemLib on every cold start.

/**
 * Draws any chart the prepared data is missing. Lessons published before chart keys ignored key
 * order were prepared under keys that no longer match once Postgres reordered them; this redraws
 * those on read, which is cheap (no Shiki or Tailwind).
 */
export function withCharts(lesson: Lesson, prepared: Prepared): Prepared {
  const missing = chartsIn(lesson).filter(
    ({ chart, compact }) => !prepared.charts?.[chartKey(chart, compact)]
  )
  if (missing.length === 0) return prepared
  const charts = { ...prepared.charts }
  for (const { chart, compact } of missing)
    charts[chartKey(chart, compact)] = renderChart(chart, compact)
  return { ...prepared, charts }
}

/** The lesson's chart visuals: a brick's own at full size, an option's or item's compact. */
export function chartsIn(
  lesson: Lesson
): { chart: ChartVisual; compact: boolean }[] {
  const out: { chart: ChartVisual; compact: boolean }[] = []
  for (const brick of [lesson.hook, ...lesson.bricks, lesson.challenge]) {
    if ("visual" in brick && brick.visual?.kind === "chart")
      out.push({ chart: brick.visual, compact: false })
    const cards = [
      ...("options" in brick ? brick.options : []),
      ...("items" in brick ? brick.items : []),
    ]
    for (const card of cards)
      if ("visual" in card && card.visual?.kind === "chart")
        out.push({ chart: card.visual, compact: true })
  }
  return out
}
