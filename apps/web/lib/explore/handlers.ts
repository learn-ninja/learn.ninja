import { and, eq, gt, isNull, or, sql } from "drizzle-orm"

import {
  activityDay,
  completion,
  lesson,
  lessonProgress,
  like,
  report,
  type Db,
} from "@workspace/db"

import { isTimeZone, localDay } from "@/lib/activity/activity"
import type { Reply } from "@/lib/publish/handlers"
import { hashToken, lessonPath, newToken } from "@/lib/publish/ids"
import type { RateLimiter } from "@/lib/publish/rate-limit"

import { REASON_MAX, TITLE_MAX } from "./browser"
import { flushViews, type ViewCounter } from "./views"
import { viewCounts, type Visibility } from "./queries"
import type { ReportSender } from "./report-email"

export { REASON_MAX, TITLE_MAX }

// The API behind likes, completions, progress, visibility, reports, and views, independent of Next.js so it can be tested
// directly. Routes under app/api/lessons/[id]/ call these.

export interface ExploreDeps {
  db: Db
  views: ViewCounter
  /** Reports per client. */
  limiter: RateLimiter
  sendReport: ReportSender
  /** Origin for the links in emails, e.g. https://learn.ninja */
  origin: string
  /** Called after a change that Explore and profiles show (a like, a visibility switch). */
  /**
   * Called after a change the Explore lists show: "now" when the lists must not show the old state
   * again (visibility, a rename, a delete), "soon" when a moment of the old one is fine (a like).
   */
  onChange?: (when: "now" | "soon") => void
  now?: () => number
}

const NOT_FOUND: Reply = {
  status: 404,
  body: {
    ok: false,
    error: "not_found",
    message: "This lesson doesn't exist or has expired.",
  },
}

function notOwner(what: string): Reply {
  return {
    status: 403,
    body: {
      ok: false,
      error: "not_owner",
      message: `Only the lesson's owner can ${what}.`,
    },
  }
}

/** The lesson, if it's still live (hidden ones included: their owner can still open them). */
async function liveLesson(deps: ExploreDeps, id: string) {
  const now = new Date(deps.now?.() ?? Date.now())
  const [row] = await deps.db
    .select({
      id: lesson.id,
      slug: lesson.slug,
      title: sql<string>`${lesson.lesson}->>'title'`,
      ownerId: lesson.ownerId,
      visibility: lesson.visibility,
      likes: lesson.likes,
    })
    .from(lesson)
    .where(
      and(
        eq(lesson.id, id),
        or(isNull(lesson.expiresAt), gt(lesson.expiresAt, now))
      )
    )
  return row ?? null
}

/** POST /api/lessons/{id}/like: one like per user per lesson. Liking twice is fine and changes nothing. */
export async function likeLesson(
  req: { id: string; userId: string },
  deps: ExploreDeps
): Promise<Reply> {
  const found = await liveLesson(deps, req.id)
  if (!found) return NOT_FOUND
  const inserted = await deps.db
    .insert(like)
    .values({ userId: req.userId, lessonId: found.id })
    .onConflictDoNothing()
    .returning({ lessonId: like.lessonId })
  let likes = found.likes
  if (inserted.length) {
    const [row] = await deps.db
      .update(lesson)
      .set({ likes: sql`${lesson.likes} + 1` })
      .where(eq(lesson.id, found.id))
      .returning({ likes: lesson.likes })
    likes = row?.likes ?? likes + 1
    deps.onChange?.("soon")
  }
  return { status: 200, body: { ok: true, liked: true, likes } }
}

/** DELETE /api/lessons/{id}/like */
export async function unlikeLesson(
  req: { id: string; userId: string },
  deps: ExploreDeps
): Promise<Reply> {
  const found = await liveLesson(deps, req.id)
  if (!found) return NOT_FOUND
  const deleted = await deps.db
    .delete(like)
    .where(and(eq(like.userId, req.userId), eq(like.lessonId, found.id)))
    .returning({ lessonId: like.lessonId })
  let likes = found.likes
  if (deleted.length) {
    const [row] = await deps.db
      .update(lesson)
      .set({ likes: sql`greatest(${lesson.likes} - 1, 0)` })
      .where(eq(lesson.id, found.id))
      .returning({ likes: lesson.likes })
    likes = row?.likes ?? Math.max(0, likes - 1)
    deps.onChange?.("soon")
  }
  return { status: 200, body: { ok: true, liked: false, likes } }
}

/**
 * POST /api/lessons/{id}/complete: the logged-in learner reached the wrap-up. The first finish's time
 * is kept, so the check on Explore says when they first finished it. Every finish, replays too,
 * adds to that day's count in activity_day (the profile's grid and streaks), but each lesson only
 * once a day. The day is the learner's calendar day in `tz` (the player sends the browser's), or
 * in UTC without one.
 *
 * `at` (ms) is when a finish made logged out happened, sent once the browser that kept it is logged
 * in: the finish counts then, on that day. It's taken only from the last week (a lesson's life), and
 * never after now. Such a late finish never counts on a day before one this lesson already counted
 * on, so a replay can't be counted twice.
 */
export async function completeLesson(
  req: { id: string; userId: string; tz?: string; at?: unknown },
  deps: ExploreDeps
): Promise<Reply> {
  const found = await liveLesson(deps, req.id)
  if (!found) return NOT_FOUND
  const now = deps.now?.() ?? Date.now()
  const late =
    typeof req.at === "number" &&
    Number.isFinite(req.at) &&
    req.at <= now &&
    req.at >= now - LATE_FINISH_MS
  const at = new Date(late ? (req.at as number) : now)
  const day = localDay(at, isTimeZone(req.tz) ? req.tz : "UTC")
  // A first finish inserts the row; a finish on a later day moves counted_day. Either returns a row
  // only when this finish counts.
  const counted = await deps.db
    .insert(completion)
    .values({
      userId: req.userId,
      lessonId: found.id,
      completedAt: at,
      countedDay: day,
    })
    .onConflictDoUpdate({
      target: [completion.userId, completion.lessonId],
      set: { countedDay: day },
      setWhere: sql`${completion.countedDay} is null or ${completion.countedDay} < ${day}`,
    })
    .returning({ completedAt: completion.completedAt })
  // A late finish from before the first one recorded is the first.
  if (late)
    await deps.db
      .update(completion)
      .set({ completedAt: sql`least(${completion.completedAt}, ${at.toISOString()}::timestamptz)` })
      .where(
        and(
          eq(completion.userId, req.userId),
          eq(completion.lessonId, found.id)
        )
      )
  // Finished, so no longer in progress.
  await deps.db
    .delete(lessonProgress)
    .where(
      and(
        eq(lessonProgress.userId, req.userId),
        eq(lessonProgress.lessonId, found.id)
      )
    )
  if (counted.length) {
    await deps.db
      .insert(activityDay)
      .values({ userId: req.userId, day, lessons: 1 })
      .onConflictDoUpdate({
        target: [activityDay.userId, activityDay.day],
        set: { lessons: sql`${activityDay.lessons} + 1` },
      })
  }
  const [row] = counted.length
    ? counted
    : await deps.db
        .select({ completedAt: completion.completedAt })
        .from(completion)
        .where(
          and(
            eq(completion.userId, req.userId),
            eq(completion.lessonId, found.id)
          )
        )
  return {
    status: 200,
    body: { ok: true, completedAt: row?.completedAt.toISOString() ?? null },
  }
}

/** How far back a late finish (`at`) may be: as long as a lesson lives. */
const LATE_FINISH_MS = 7 * 24 * 3.6e6

/** The most katas a lesson's progress may name: well above any lesson the spec allows. */
const PROGRESS_MAX = 200

/**
 * PUT /api/lessons/{id}/progress with { done, total }: the logged-in learner moved past a kata, for
 * their profile's In progress tab. `done` counts the katas behind them, out of `total`; nothing
 * behind them (still on the first) isn't progress yet, so it's ignored, and finishing deletes the
 * row (completeLesson).
 */
export async function recordProgress(
  req: { id: string; userId: string; done: unknown; total: unknown },
  deps: ExploreDeps
): Promise<Reply> {
  const { done, total } = req
  if (
    !Number.isInteger(done) ||
    !Number.isInteger(total) ||
    (done as number) < 0 ||
    (done as number) >= (total as number) ||
    (total as number) > PROGRESS_MAX
  ) {
    return {
      status: 400,
      body: {
        ok: false,
        error: "bad_request",
        message:
          'Send { "done": n, "total": m } with whole numbers, done below total.',
      },
    }
  }
  const found = await liveLesson(deps, req.id)
  if (!found) return NOT_FOUND
  if (done === 0) return { status: 200, body: { ok: true, recorded: false } }
  const values = {
    done: done as number,
    total: total as number,
    updatedAt: new Date(deps.now?.() ?? Date.now()),
  }
  await deps.db
    .insert(lessonProgress)
    .values({ userId: req.userId, lessonId: found.id, ...values })
    .onConflictDoUpdate({
      target: [lessonProgress.userId, lessonProgress.lessonId],
      set: values,
    })
  return { status: 200, body: { ok: true, recorded: true } }
}

/**
 * PATCH /api/lessons/{id} with { visibility }: the owner publishes a lesson to Explore ("public") or
 * makes it private again ("unlisted", link only). "team" waits for teams.
 */
export async function setVisibility(
  req: { id: string; userId: string; visibility: unknown },
  deps: ExploreDeps
): Promise<Reply> {
  if (req.visibility !== "public" && req.visibility !== "unlisted") {
    return {
      status: 422,
      body: {
        ok: false,
        error: "invalid_visibility",
        message:
          req.visibility === "team"
            ? "Team visibility isn't available yet."
            : 'Send { "visibility": "public" } or { "visibility": "unlisted" }.',
      },
    }
  }
  const found = await liveLesson(deps, req.id)
  if (!found) return NOT_FOUND
  if (found.ownerId !== req.userId) return notOwner("change who sees it")
  const visibility: Visibility = req.visibility
  if (found.visibility !== visibility) {
    await deps.db
      .update(lesson)
      .set({ visibility, updatedAt: new Date(deps.now?.() ?? Date.now()) })
      .where(eq(lesson.id, found.id))
    deps.onChange?.("now")
  }
  return {
    status: 200,
    body: {
      ok: true,
      id: found.id,
      url: deps.origin + lessonPath(found.slug, found.id),
      visibility,
    },
  }
}

/**
 * PATCH /api/lessons/{id} with { title }: the owner renames a lesson. Only the title in the stored
 * JSON changes; the link keeps its slug, so links already shared still open it.
 */
export async function renameLesson(
  req: { id: string; userId: string; title: unknown },
  deps: ExploreDeps
): Promise<Reply> {
  const title =
    typeof req.title === "string" ? req.title.trim().replace(/\s+/g, " ") : ""
  if (!title || title.length > TITLE_MAX) {
    return {
      status: 422,
      body: {
        ok: false,
        error: "invalid_title",
        message: `Give the lesson a title of up to ${TITLE_MAX} characters.`,
      },
    }
  }
  const found = await liveLesson(deps, req.id)
  if (!found) return NOT_FOUND
  if (found.ownerId !== req.userId) return notOwner("rename it")
  if (found.title !== title) {
    await deps.db
      .update(lesson)
      .set({
        lesson: sql`jsonb_set(${lesson.lesson}, '{title}', to_jsonb(${title}::text))`,
        updatedAt: new Date(deps.now?.() ?? Date.now()),
      })
      .where(eq(lesson.id, found.id))
    deps.onChange?.("now")
  }
  return {
    status: 200,
    body: {
      ok: true,
      id: found.id,
      url: deps.origin + lessonPath(found.slug, found.id),
      title,
    },
  }
}

/**
 * DELETE /api/lessons/{id}: the owner deletes a lesson for good. Its likes, completions, progress, tags,
 * and reports go with it (the foreign keys cascade), and its link stops working.
 */
export async function deleteLesson(
  req: { id: string; userId: string },
  deps: ExploreDeps
): Promise<Reply> {
  const found = await liveLesson(deps, req.id)
  if (!found) return NOT_FOUND
  if (found.ownerId !== req.userId) return notOwner("delete it")
  await deps.db.delete(lesson).where(eq(lesson.id, found.id))
  deps.onChange?.("now")
  return { status: 200, body: { ok: true, id: found.id, deleted: true } }
}

/**
 * POST /api/lessons/{id}/report with { reason }: anyone, rate-limited per client. The report is
 * kept (with a hash of the reporter's address, never the address) and emailed to the maker. A
 * second report of the same lesson from the same place is accepted but not emailed again.
 */
export async function reportLesson(
  req: { id: string; reason: unknown; client: string },
  deps: ExploreDeps
): Promise<Reply> {
  if (!(await deps.limiter.allow(req.client))) {
    return {
      status: 429,
      body: {
        ok: false,
        error: "rate_limited",
        message: "Too many reports from here recently. Try again later.",
      },
    }
  }
  const reason = typeof req.reason === "string" ? req.reason.trim() : ""
  if (!reason || reason.length > REASON_MAX) {
    return {
      status: 400,
      body: {
        ok: false,
        error: "bad_request",
        message: `Say what's wrong in up to ${REASON_MAX} characters.`,
      },
    }
  }
  const found = await liveLesson(deps, req.id)
  if (!found) return NOT_FOUND
  const reporterIpHash = hashToken(req.client)
  const [earlier] = await deps.db
    .select({ id: report.id })
    .from(report)
    .where(
      and(
        eq(report.lessonId, found.id),
        eq(report.reporterIpHash, reporterIpHash)
      )
    )
    .limit(1)
  const id = newToken().slice(0, 16)
  await deps.db.insert(report).values({
    id,
    lessonId: found.id,
    reason,
    reporterIpHash,
    createdAt: new Date(deps.now?.() ?? Date.now()),
  })
  if (!earlier) {
    await deps.sendReport({
      reportId: id,
      lessonId: found.id,
      title: found.title,
      url: deps.origin + lessonPath(found.slug, found.id),
      reason,
      reporterIpHash,
    })
  }
  return { status: 201, body: { ok: true } }
}

/** POST /api/lessons/{id}/view: one more view, counted after the response is sent. */
export async function recordView(
  id: string,
  deps: Pick<ExploreDeps, "views">
): Promise<void> {
  await deps.views.record(id)
}

/** Adds pending views to lesson.views (the daily cron, and the Explore lists when they refresh). */
export async function flushPendingViews(
  deps: Pick<ExploreDeps, "db" | "views">,
  options?: { every?: number }
): Promise<number> {
  return flushViews(deps.db, deps.views, options)
}

/**
 * The current view counts of `ids`: the stored ones plus those still pending. Explore reads these
 * per request over its cached lists, so a view shows when the visitor comes back to the list.
 */
export async function liveViewCounts(
  ids: string[],
  deps: Pick<ExploreDeps, "db" | "views">
): Promise<Map<string, number>> {
  const [stored, pending] = await Promise.all([
    viewCounts(deps.db, ids),
    deps.views.pending(ids),
  ])
  for (const [id, n] of pending) stored.set(id, (stored.get(id) ?? 0) + n)
  return stored
}
