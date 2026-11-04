import type { Prepared } from "@workspace/player-core/prepared"
import { validateLesson, type Lesson } from "@workspace/spec"

import { API_BASE_URL } from "./config"
import { loadVisualsCss } from "./visuals-css"

export interface LoadedLesson {
  id: string
  lesson: Lesson
  prepared: Prepared
  /** The visuals' shared stylesheet, inlined into each HTML visual; empty if it didn't load. */
  baseCss: string
}

export class LessonError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message)
  }
}

/**
 * A lesson from GET /api/lessons/{param}: a published lesson's "{slug}-{id}" or id, or a bundled
 * test lesson's slug. The lesson is checked against the spec here too, so a player never draws
 * something it can't trust the shape of.
 */
export async function fetchLesson(
  param: string,
  base = API_BASE_URL
): Promise<LoadedLesson> {
  const res = await fetch(`${base}/api/lessons/${encodeURIComponent(param)}`, {
    headers: { accept: "application/json" },
  })
  const body = (await res.json().catch(() => null)) as {
    ok?: boolean
    id?: string
    lesson?: unknown
    prepared?: Prepared
    visualsCssUrl?: string
    message?: string
  } | null
  if (!res.ok || !body?.ok)
    throw new LessonError(
      body?.message ?? `The lesson didn't load (${res.status}).`,
      res.status
    )
  const checked = validateLesson(body.lesson)
  if (!checked.ok)
    throw new LessonError("This lesson doesn't fit the lesson format.", 422)
  // Without it the visuals still show, unstyled by Basecoat, so the lesson plays on.
  const baseCss = await loadVisualsCss(
    body.visualsCssUrl ?? "/lesson-visuals.css",
    base
  ).catch(() => "")
  return {
    id: body.id ?? param,
    baseCss,
    lesson: checked.lesson,
    prepared: body.prepared ?? {
      math: {},
      code: {},
      visualsCss: "",
    },
  }
}
