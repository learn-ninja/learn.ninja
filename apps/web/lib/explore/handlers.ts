import { and, eq, gt, isNull, or, sql } from "drizzle-orm"

import { lesson, like, report, type Db } from "@workspace/db"

import type { Reply } from "@/lib/publish/handlers"
import { hashToken, lessonPath, newToken } from "@/lib/publish/ids"
import type { RateLimiter } from "@/lib/publish/rate-limit"

import { REASON_MAX } from "./browser"
import { flushPlays, type PlayCounter } from "./plays"
import type { Visibility } from "./queries"
import type { ReportSender } from "./report-email"

export { REASON_MAX }

// The API behind likes, visibility, reports, and plays, independent of Next.js so it can be tested
// directly. Routes under app/api/lessons/[id]/ call these.

export interface ExploreDeps {
  db: Db
  plays: PlayCounter
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
 * PATCH /api/lessons/{id} with { visibility }: the owner lists a lesson in Explore ("public") or
 * takes it back to link-only ("unlisted"). "team" waits for teams.
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
  if (found.ownerId !== req.userId) {
    return {
      status: 403,
      body: {
        ok: false,
        error: "not_owner",
        message: "Only the lesson's owner can change who sees it.",
      },
    }
  }
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

/** POST /api/lessons/{id}/play: one more play, counted after the response is sent. */
export async function recordPlay(
  id: string,
  deps: Pick<ExploreDeps, "plays">
): Promise<void> {
  await deps.plays.record(id)
}

/** Adds pending plays to lesson.plays (the daily cron, and the Explore lists when they refresh). */
export async function flushPendingPlays(
  deps: Pick<ExploreDeps, "db" | "plays">
): Promise<number> {
  return flushPlays(deps.db, deps.plays)
}
