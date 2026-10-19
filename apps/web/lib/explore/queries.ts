import { and, desc, eq, gt, inArray, isNotNull, isNull, or, sql } from "drizzle-orm"

import { lesson, like, user, type Db } from "@workspace/db"
import type { Level } from "@workspace/spec"

// What Explore, profiles, and the settings page read: lessons as cards, straight from the database
// (no listing API in v2). Only what a card shows is selected: a lesson's JSON can be hundreds of
// kilobytes, so the title and the rest come out of the jsonb column one field at a time.

export type Visibility = "public" | "unlisted" | "team"
export type ExploreSort = "new" | "trending" | "top"
export const EXPLORE_SORTS: ExploreSort[] = ["new", "trending", "top"]

/** A lesson as a card shows it. */
export interface LessonSummary {
  id: string
  slug: string
  title: string
  summary: string
  topic: string | null
  level: Level
  minutes: number
  /** The lesson's BCP 47 language, so the card can set `lang` and direction. */
  language: string
  /** Who published it; null for anonymous lessons (never listed) or when the owner is gone. */
  author: { handle: string | null; name: string } | null
  plays: number
  likes: number
  visibility: Visibility
  hidden: boolean
  createdAt: number
}

/** Trending: plays plus three times likes, halved every 48 hours. */
export const TRENDING_HALF_LIFE_SECONDS = 48 * 60 * 60
export const LIKE_WEIGHT = 3

/** Trending as a number, for tests and for the SQL below. */
export function trendingScore(
  row: { plays: number; likes: number; createdAt: number },
  now: number
): number {
  const age = Math.max(0, now - row.createdAt) / 1000
  return (
    (row.plays + LIKE_WEIGHT * row.likes) *
    Math.pow(0.5, age / TRENDING_HALF_LIFE_SECONDS)
  )
}

const field = (name: string) => sql<string>`${lesson.lesson}->>${name}`

const columns = {
  id: lesson.id,
  slug: lesson.slug,
  title: field("title"),
  summary: field("summary"),
  topic: field("topic"),
  level: field("level"),
  minutes: field("estimatedMinutes"),
  language: field("language"),
  plays: lesson.plays,
  likes: lesson.likes,
  visibility: lesson.visibility,
  hidden: lesson.hidden,
  createdAt: lesson.createdAt,
  authorId: lesson.ownerId,
  authorHandle: user.handle,
  authorName: user.name,
}

interface Row {
  id: string
  slug: string
  title: string
  summary: string
  topic: string | null
  level: string
  minutes: string | number
  language: string
  plays: number
  likes: number
  visibility: Visibility
  hidden: boolean
  createdAt: Date
  authorId: string | null
  authorHandle: string | null
  authorName: string | null
}

function toSummary(row: Row): LessonSummary {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    summary: row.summary,
    topic: row.topic || null,
    level: row.level as Level,
    minutes: Number(row.minutes),
    language: row.language,
    author:
      row.authorId && row.authorName !== null
        ? { handle: row.authorHandle, name: row.authorName }
        : null,
    plays: row.plays,
    likes: row.likes,
    visibility: row.visibility,
    hidden: row.hidden,
    createdAt: row.createdAt.getTime(),
  }
}

const live = (now: number) =>
  or(isNull(lesson.expiresAt), gt(lesson.expiresAt, new Date(now)))

/** Owned, public, and not hidden: what Explore and profiles show. Anonymous lessons never qualify. */
const listed = (now: number) =>
  and(
    isNotNull(lesson.ownerId),
    eq(lesson.visibility, "public"),
    eq(lesson.hidden, false),
    live(now)
  )

function orderFor(sort: ExploreSort, now: number) {
  switch (sort) {
    case "new":
      return [desc(lesson.createdAt), desc(lesson.id)]
    case "top":
      return [desc(lesson.likes), desc(lesson.plays), desc(lesson.createdAt)]
    case "trending":
      return [
        desc(
          sql`(${lesson.plays} + ${sql.raw(String(LIKE_WEIGHT))} * ${lesson.likes}) * power(0.5, extract(epoch from (to_timestamp(${sql.raw(String(Math.floor(now / 1000)))}) - ${lesson.createdAt})) / ${sql.raw(`${TRENDING_HALF_LIFE_SECONDS}.0`)})`
        ),
        desc(lesson.createdAt),
      ]
  }
}

/** The Explore list for one tab. */
export async function listLessons(
  db: Db,
  sort: ExploreSort,
  limit: number,
  now = Date.now()
): Promise<LessonSummary[]> {
  const rows = await db
    .select(columns)
    .from(lesson)
    .leftJoin(user, eq(user.id, lesson.ownerId))
    .where(listed(now))
    .orderBy(...orderFor(sort, now))
    .limit(limit)
  return rows.map(toSummary)
}

/** Which of `ids` the user has liked. */
export async function likedIds(
  db: Db,
  userId: string,
  ids: string[]
): Promise<Set<string>> {
  if (!ids.length) return new Set()
  const rows = await db
    .select({ id: like.lessonId })
    .from(like)
    .where(and(eq(like.userId, userId), inArray(like.lessonId, ids)))
  return new Set(rows.map((r) => r.id))
}

export interface Profile {
  id: string
  handle: string
  name: string
  bio: string | null
  joinedAt: number
  /** The person's listed lessons, newest first. */
  lessons: LessonSummary[]
  /** Totals over those lessons. */
  plays: number
  likes: number
}

/** The public profile at /u/{handle}, or null when nobody has that handle. */
export async function profileByHandle(
  db: Db,
  handle: string,
  now = Date.now()
): Promise<Profile | null> {
  const [person] = await db
    .select({
      id: user.id,
      handle: user.handle,
      name: user.name,
      bio: user.bio,
      createdAt: user.createdAt,
    })
    .from(user)
    .where(and(eq(user.handle, handle), eq(user.banned, false)))
  if (!person?.handle) return null
  const rows = await db
    .select(columns)
    .from(lesson)
    .leftJoin(user, eq(user.id, lesson.ownerId))
    .where(and(eq(lesson.ownerId, person.id), listed(now)))
    .orderBy(...orderFor("new", now))
  const lessons = rows.map(toSummary)
  return {
    id: person.id,
    handle: person.handle,
    name: person.name,
    bio: person.bio,
    joinedAt: person.createdAt.getTime(),
    lessons,
    plays: lessons.reduce((n, l) => n + l.plays, 0),
    likes: lessons.reduce((n, l) => n + l.likes, 0),
  }
}

/** Every lesson the user owns, whatever its visibility, newest first: the settings page's list. */
export async function lessonsOwnedBy(
  db: Db,
  ownerId: string
): Promise<LessonSummary[]> {
  const rows = await db
    .select(columns)
    .from(lesson)
    .leftJoin(user, eq(user.id, lesson.ownerId))
    .where(eq(lesson.ownerId, ownerId))
    .orderBy(desc(lesson.createdAt))
  return rows.map(toSummary)
}

/** A lesson owner's public name, for the lesson page. */
export async function authorOf(
  db: Db,
  ownerId: string
): Promise<{ handle: string | null; name: string } | null> {
  const [row] = await db
    .select({ handle: user.handle, name: user.name })
    .from(user)
    .where(eq(user.id, ownerId))
  return row ?? null
}
