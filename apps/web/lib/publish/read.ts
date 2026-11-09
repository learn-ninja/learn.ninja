import type { MathSvg, Prepared } from "@workspace/player-core/prepared"
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
  /** The visuals' shared stylesheet (Basecoat and the theme), versioned: /lesson-visuals.css?v={hash}. */
  visualsCssUrl: string
  /** Charts drawn at read time for lessons stored before their charts were prepared. */
  withCharts?: (lesson: Lesson, prepared: Prepared) => Prepared
  /** The lesson's formulas drawn as SVG, for a player that can't show KaTeX's HTML (math-svg.ts). */
  drawMath?: (prepared: Prepared) => Record<string, MathSvg>
  /** The owner's handle, so the app's lesson menu can name who it would block. */
  handleOf?: (ownerId: string) => Promise<string | null>
}

export interface LessonReply {
  ok: true
  id: string
  /** Where the web page plays it. */
  path: string
  lesson: Lesson
  prepared: Prepared
  /** The formulas in `prepared.math`, drawn as SVG by the same keys; one MathJax can't read is left out. */
  mathSvg: Record<string, MathSvg>
  /**
   * The stylesheet every HTML visual loads before the lesson's own prepared CSS, with a hash of
   * its content, so a player can fetch it once and keep it until it changes.
   */
  visualsCssUrl: string
  /** Milliseconds since the epoch; null for lessons that don't expire (owned, or bundled). */
  expiresAt: number | null
  updatedAt: number | null
  /** Who kept it (the lesson menu's Report and Block); null for anonymous and bundled lessons. */
  author: { id: string; handle: string | null } | null
  /** In Explore and on the owner's profile: owned, public, and not hidden. */
  listed: boolean
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
      mathSvg: deps.drawMath?.(bundled.prepared) ?? {},
      visualsCssUrl: deps.visualsCssUrl,
      expiresAt: null,
      updatedAt: null,
      author: null,
      listed: false,
    }
    return { status: 200, body: { ...body } }
  }

  const id = idFromParam(req.param)
  const record = id ? await deps.store.get(id) : null
  // A hidden lesson only opens for its owner on the web page; the app doesn't sign in yet.
  if (!record || record.hidden) return NOT_FOUND
  // Lessons published before spec 0.3 may still be live.
  const lesson = upgradeLesson(record.lesson) as Lesson
  const prepared = deps.withCharts
    ? deps.withCharts(lesson, record.prepared)
    : record.prepared
  const body: LessonReply = {
    ok: true,
    id: record.id,
    path: `/l/${record.slug}-${record.id}`,
    lesson,
    prepared,
    mathSvg: deps.drawMath?.(prepared) ?? {},
    visualsCssUrl: deps.visualsCssUrl,
    expiresAt: record.expiresAt,
    updatedAt: record.updatedAt ?? null,
    author: record.ownerId
      ? {
          id: record.ownerId,
          handle: (await deps.handleOf?.(record.ownerId)) ?? null,
        }
      : null,
    listed: record.ownerId !== null && record.visibility === "public",
  }
  return { status: 200, body: { ...body } }
}
