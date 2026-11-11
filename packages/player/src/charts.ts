import "server-only"

import type { ChartVisual, Lesson } from "@workspace/spec"

import { renderChart } from "./chart"
import { chartKey, type Prepared } from "@workspace/player-core/prepared"

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

/** The lesson's chart visuals: a kata's own at full size, an option's or item's compact. */
export function chartsIn(
  lesson: Lesson
): { chart: ChartVisual; compact: boolean }[] {
  const out: { chart: ChartVisual; compact: boolean }[] = []
  for (const kata of [lesson.hook, ...lesson.katas, lesson.challenge]) {
    if ("visual" in kata && kata.visual?.kind === "chart")
      out.push({ chart: kata.visual, compact: false })
    if ("reveal" in kata && kata.reveal?.kind === "chart")
      out.push({ chart: kata.reveal, compact: false })
    const cards = [
      ...("options" in kata ? kata.options : []),
      ...("items" in kata ? kata.items : []),
    ]
    for (const card of cards)
      if ("visual" in card && card.visual?.kind === "chart")
        out.push({ chart: card.visual, compact: true })
  }
  return out
}
