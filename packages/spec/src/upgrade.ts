// Older lesson files, brought up to the current spec. Published lessons and older skills can
// still hand us spec 0.2, 0.3 (with or without a concept brick's `term`, since dropped), or 0.4, so
// the server upgrades them before validating or playing them. 0.3 to 0.4 only added the chart visual
// and 0.4 to 0.5 the diagram visual, so those lessons need nothing but their version changed.

import { SPEC_VERSION } from "./schema"

interface LessonV02 {
  spec: "0.2"
  loops: { concept: Record<string, unknown>; practice: unknown[] }[]
  [key: string]: unknown
}

/** True for data that claims an older spec, or has a concept `term`, that this module can upgrade. */
export function canUpgrade(data: unknown): boolean {
  if (typeof data !== "object" || data === null) return false
  const { spec, bricks } = data as { spec?: unknown; bricks?: unknown }
  return (
    spec === "0.2" ||
    spec === "0.3" ||
    spec === "0.4" ||
    (Array.isArray(bricks) && bricks.some(hasTerm))
  )
}

function hasTerm(brick: unknown): boolean {
  return (
    typeof brick === "object" &&
    brick !== null &&
    (brick as { type?: unknown }).type === "concept" &&
    "term" in brick
  )
}

/**
 * Brings a lesson up to the current spec. From 0.2, each loop's concept becomes a concept brick,
 * followed by its practice bricks. Concept bricks lose their `term`. Anything else comes back
 * unchanged, for validateLesson to judge.
 */
export function upgradeLesson(data: unknown): unknown {
  if (!canUpgrade(data)) return data
  if ((data as { spec?: unknown }).spec !== "0.2") {
    const lesson = data as { bricks?: unknown[] }
    return {
      ...lesson,
      spec: SPEC_VERSION,
      bricks: Array.isArray(lesson.bricks)
        ? lesson.bricks.map(withoutTerm)
        : lesson.bricks,
    }
  }
  const { loops, ...rest } = data as LessonV02
  if (!Array.isArray(loops)) return { ...rest, spec: SPEC_VERSION }
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(rest)) {
    if (key === "challenge")
      out.bricks = loops.flatMap((loop) => [
        conceptBrick(loop?.concept),
        ...(Array.isArray(loop?.practice) ? loop.practice : []),
      ])
    out[key] = key === "spec" ? SPEC_VERSION : value
  }
  return out
}

function conceptBrick(concept: Record<string, unknown> | undefined) {
  const { id, term: _term, ...rest } = concept ?? {}
  return { id, type: "concept", ...rest }
}

function withoutTerm(brick: unknown) {
  if (!hasTerm(brick)) return brick
  const { term: _term, ...rest } = brick as Record<string, unknown>
  return rest
}
