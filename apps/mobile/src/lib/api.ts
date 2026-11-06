import {
  emptyPrepared,
  type MathSvg,
  type Prepared,
} from "@workspace/player-core/prepared"
import { loadLanguage } from "@workspace/player-core/strings"
import { validateLesson, type Lesson } from "@workspace/spec"

import { createApiFetch } from "./api-fetch"
import { sessionCookie } from "./auth-client"
import { API_BASE_URL } from "./config"
import type { Send } from "./progress-sync"
import { loadVisualsCss } from "./visuals-css"

export interface LoadedLesson {
  id: string
  /** Where the web plays it: /l/{slug}-{id} for a published lesson, /lessons/{slug} for a bundled one. */
  path: string
  lesson: Lesson
  prepared: Prepared
  /** The lesson's formulas drawn as SVG, keyed like prepared.math. */
  mathSvg: Record<string, MathSvg>
  /** The visuals' shared stylesheet, inlined into each HTML visual; empty if it didn't load. */
  baseCss: string
  /** When a published lesson's link stops working (ms since epoch); null once it's kept. */
  expiresAt: number | null
}

/** A request to the API, signed in when the app is (the session cookie rides along). */
export const apiFetch = createApiFetch({
  base: API_BASE_URL,
  cookie: sessionCookie,
})

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
  const res = await createApiFetch({ base, cookie: sessionCookie })(
    `/api/lessons/${encodeURIComponent(param)}`
  )
  const body = (await res.json().catch(() => null)) as {
    ok?: boolean
    id?: string
    path?: string
    lesson?: unknown
    prepared?: Prepared
    mathSvg?: Record<string, MathSvg>
    visualsCssUrl?: string
    expiresAt?: number | null
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
  const [baseCss] = await Promise.all([
    // Without it the visuals still show, unstyled by Basecoat, so the lesson plays on.
    loadVisualsCss(body.visualsCssUrl ?? "/lesson-visuals.css", base).catch(
      () => ""
    ),
    // The player's strings in the lesson's language, so stringsFor() has them; English if it fails.
    loadLanguage(checked.lesson.language).catch(() => null),
  ])
  return {
    id: body.id ?? param,
    path: body.path ?? `/l/${param}`,
    baseCss,
    lesson: checked.lesson,
    prepared: body.prepared ?? emptyPrepared,
    mathSvg: body.mathSvg ?? {},
    expiresAt: body.expiresAt ?? null,
  }
}

/** A request to the API on the learner's behalf, for progress-sync.ts. */
export const sendToApi: Send = async (path, { method, body }) => {
  const res = await apiFetch(path, {
    method,
    headers: { "content-type": "application/json" },
    body,
  })
  return { status: res.status }
}

export interface TestLesson {
  slug: string
  title: string
  summary: string
}

/** The test lessons the web app bundles (examples/), from GET /api/lessons. */
export async function fetchTestLessons(
  base = API_BASE_URL
): Promise<TestLesson[]> {
  const res = await fetch(`${base}/api/lessons`, {
    headers: { accept: "application/json" },
  })
  const body = (await res.json().catch(() => null)) as {
    ok?: boolean
    lessons?: TestLesson[]
  } | null
  if (!res.ok || !body?.ok || !Array.isArray(body.lessons))
    throw new LessonError(
      `The lessons didn't load (${res.status}).`,
      res.status
    )
  return body.lessons
}
