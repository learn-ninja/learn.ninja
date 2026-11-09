import {
  emptyPrepared,
  type MathSvg,
  type Prepared,
} from "@workspace/player-core/prepared"
import { loadLanguage } from "@workspace/player-core/strings"
import { validateLesson, type Lesson } from "@workspace/spec"

import { createApiFetch, OfflineError } from "./api-fetch"
import { sessionCookie } from "./auth-client"
import { API_BASE_URL } from "./config"
import { cachedLesson, cacheLesson, forgetCachedLesson } from "./lesson-cache"
import { deviceStorage } from "./progress-storage"
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
  /** The copy kept on this phone, played because learn.ninja couldn't be reached. */
  offline?: boolean
  /** Who kept it, for the menu's Report and Block; null for anonymous and bundled lessons (and copies kept before it was sent). */
  author?: { id: string; handle: string | null } | null
}

/** A request to the API, signed in when the app is (the session cookie rides along). */
export const apiFetch = createApiFetch({
  base: API_BASE_URL,
  cookie: sessionCookie,
})

/** A body that stopped arriving (the request timed out) is the server not answering, not bad JSON. */
function readJson(res: Response): Promise<unknown> {
  return res.json().catch((e: unknown) => {
    if (e instanceof Error && e.name === "AbortError")
      throw new OfflineError(true)
    return null
  })
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
  try {
    const data = await requestLesson(param, base)
    cacheLesson(deviceStorage, param, data)
    return data
  } catch (e) {
    // No connection: the copy this phone kept, if there is one. A lesson the server says is gone
    // is gone here too.
    if (e instanceof OfflineError) {
      const kept = cachedLesson(deviceStorage, param)
      if (kept) return kept
    } else if (
      e instanceof LessonError &&
      (e.status === 404 || e.status === 410)
    )
      forgetCachedLesson(deviceStorage, param)
    throw e
  }
}

async function requestLesson(
  param: string,
  base: string
): Promise<LoadedLesson> {
  const res = await createApiFetch({ base, cookie: sessionCookie })(
    `/api/lessons/${encodeURIComponent(param)}`
  )
  const body = (await readJson(res)) as {
    ok?: boolean
    id?: string
    path?: string
    lesson?: unknown
    prepared?: Prepared
    mathSvg?: Record<string, MathSvg>
    visualsCssUrl?: string
    expiresAt?: number | null
    author?: { id: string; handle: string | null } | null
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
    author: body.author ?? null,
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
  // Signed out or in, the same list: no cookie, but the API fetch's timeout.
  const res = await createApiFetch({ base, cookie: async () => "" })(
    "/api/lessons"
  )
  const body = (await readJson(res)) as {
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
