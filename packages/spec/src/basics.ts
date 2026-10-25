import type { Brick, Lesson, Visual } from "./schema"

// Small values and helpers the player shares with the checker, kept apart from Zod (schema.ts) and
// KaTeX (rules.ts) so importing them doesn't pull either into the browser's bundle.

/** Who a lesson is for, from least to most prior knowledge. The skill's `levels/` guides say how each one teaches. */
export const LEVELS = ["beginner", "intermediate", "advanced"] as const
export type Level = (typeof LEVELS)[number]

export const LIMITS = {
  /** Series a chart visual can show (lines on a line chart, colors on a scatter). */
  chartSeries: 3,
  /** Colors a map can shade countries in, each named in its legend. */
  mapGroups: 3,
  /** Numbered ticks on a number line, so the numbers stay readable on a phone. */
  numberLineTicks: 21,
  concepts: { min: 1, max: 4 },
  /** Question bricks after each concept brick. */
  practicePerConcept: { min: 2, max: 4 },
  practiceTotal: { min: 3, max: 12 },
  promptWords: 40,
  /** An explanation is shown in the ninja's speech bubble, so it stays short. */
  explanationWords: 30,
  conceptBodyWords: 80,
  htmlVisualBytes: 20 * 1024,
  lessonBytes: 500 * 1024,
} as const

/**
 * The n of a number line step that is 1/n (2 to 12), or undefined. JSON can't hold 1/3 exactly, so
 * a step written to 3 places (0.333, 0.167, 0.083) counts; the ticks are then placed at exactly
 * 1/n. Shared with the player's ticks.
 */
export function fractionStep(step: number): number | undefined {
  const n = Math.round(1 / step)
  return n >= 2 && n <= 12 && Math.abs(n * step - 1) < 6e-3 ? n : undefined
}

/** Every visual in the lesson with its path: on bricks, on options, and on items. */
export function everyVisual(
  lesson: Lesson
): { visual: Visual; path: string }[] {
  const out: { visual: Visual; path: string }[] = []
  const bricks: { brick: Brick; path: string }[] = [
    { brick: lesson.hook, path: "hook" },
    ...lesson.bricks.map((brick, i) => ({ brick, path: `bricks[${i}]` })),
    { brick: lesson.challenge, path: "challenge" },
  ]
  for (const { brick, path } of bricks) {
    if ("visual" in brick && brick.visual)
      out.push({ visual: brick.visual, path: `${path}.visual` })
    if ("options" in brick)
      brick.options.forEach((o, j) => {
        if ("visual" in o && o.visual)
          out.push({ visual: o.visual, path: `${path}.options[${j}].visual` })
      })
    if ("items" in brick)
      brick.items.forEach((it, j) => {
        if ("visual" in it && it.visual)
          out.push({ visual: it.visual, path: `${path}.items[${j}].visual` })
      })
  }
  return out
}
