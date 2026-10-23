import { and, eq, gt, isNull, or, sql } from "drizzle-orm"

import {
  activityDay,
  completion,
  lesson,
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

// The API behind likes, completions, visibility, reports, and views, independent of Next.js so it can be tested
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
  onChange?: () => void
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
    deps.onChange?.()
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
    deps.onChange?.()
  }
  return { status: 200, body: { ok: true, liked: false, likes } }
}

/**
 * POST /api/lessons/{id}/complete: the logged-in learner reached the wrap-up. Only the first time
 * is kept, so the check on Explore says when they first finished it, and only the first time adds
 * to that day's count in activity_day, the profile's grid and streaks. The day is the learner's
 * calendar day in `tz` (the player sends the browser's), or in UTC without one.
 */
export async function completeLesson(
  req: { id: string; userId: string; tz?: string },
  deps: ExploreDeps
): Promise<Reply> {
  const found = await liveLesson(deps, req.id)
  if (!found) return NOT_FOUND
  const at = new Date(deps.now?.() ?? Date.now())
  const inserted = await deps.db
    .insert(completion)
    .values({ userId: req.userId, lessonId: found.id, completedAt: at })
    .onConflictDoNothing()
    .returning({ completedAt: completion.completedAt })
  if (inserted.length) {
    const day = localDay(at, isTimeZone(req.tz) ? req.tz : "UTC")
    await deps.db
      .insert(activityDay)
      .values({ userId: req.userId, day, lessons: 1 })
      .onConflictDoUpdate({
        target: [activityDay.userId, activityDay.day],
        set: { lessons: sql`${activityDay.lessons} + 1` },
      })
  }
  const [row] = inserted.length
    ? inserted
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
    deps.onChange?.()
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
    deps.onChange?.()
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
 * DELETE /api/lessons/{id}: the owner deletes a lesson for good. Its likes, completions, tags,
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
  deps.onChange?.()
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
  deps: Pick<ExploreDeps, "db" | "views">
): Promise<number> {
  return flushViews(deps.db, deps.views)
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
