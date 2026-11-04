import type { Prepared } from "@workspace/player-core/prepared"
import { upgradeLesson, type Lesson } from "@workspace/spec"

import type { Reply } from "./handlers"
import { idFromParam } from "./ids"
import type { RateLimiter } from "./rate-limit"
import type { LessonStore } from "./store"

// GET /api/lessons/{id}: a lesson and what was prepared for it at publish time, as JSON, for a
// player that isn't the web page (the iOS app). The param is a lesson's id or its whole
// "{slug}-{id}" link segment, or the slug of a bundled test lesson (/lessons/{slug}), so the app
// can be built against a dev server with an empty database.

export interface ReadDeps {
  store: LessonStore
  limiter: RateLimiter
  /** A bundled test lesson by slug, prepared; null when there's none by that name. */
  bundled: (
    slug: string
  ) => Promise<{ lesson: Lesson; prepared: Prepared } | null>
  /** Charts drawn at read time for lessons stored before their charts were prepared. */
  withCharts?: (lesson: Lesson, prepared: Prepared) => Prepared
}

export interface LessonReply {
  ok: true
  id: string
  /** Where the web page plays it. */
  path: string
  lesson: Lesson
  prepared: Prepared
  /** Milliseconds since the epoch; null for lessons that don't expire (owned, or bundled). */
  expiresAt: number | null
  updatedAt: number | null
}

const NOT_FOUND: Reply = {
  status: 404,
  body: {
    ok: false,
    error: "not_found",
    message:
      "No lesson here: it expired 7 days after it was published, or the link is wrong.",
  },
}

export async function readLesson(
  req: { param: string; client: string },
  deps: ReadDeps
): Promise<Reply> {
  if (!(await deps.limiter.allow(req.client)))
    return {
      status: 429,
      body: {
        ok: false,
        error: "rate_limited",
        message: "Too many lessons opened. Try again in a while.",
      },
    }

  const bundled = await deps.bundled(req.param)
  if (bundled) {
    const body: LessonReply = {
      ok: true,
      id: req.param,
      path: `/lessons/${req.param}`,
      lesson: bundled.lesson,
      prepared: bundled.prepared,
      expiresAt: null,
      updatedAt: null,
    }
    return { status: 200, body: { ...body } }
  }

  const id = idFromParam(req.param)
  const record = id ? await deps.store.get(id) : null
  // A hidden lesson only opens for its owner on the web page; the app doesn't sign in yet.
  if (!record || record.hidden) return NOT_FOUND
  // Lessons published before spec 0.3 may still be live.
  const lesson = upgradeLesson(record.lesson) as Lesson
  const body: LessonReply = {
    ok: true,
    id: record.id,
    path: `/l/${record.slug}-${record.id}`,
    lesson,
    prepared: deps.withCharts
      ? deps.withCharts(lesson, record.prepared)
      : record.prepared,
    expiresAt: record.expiresAt,
    updatedAt: record.updatedAt ?? null,
  }
  return { status: 200, body: { ...body } }
}
