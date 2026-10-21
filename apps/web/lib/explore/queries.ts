import {
  and,
  desc,
  eq,
  exists,
  gt,
  inArray,
  isNotNull,
  isNull,
  or,
  sql,
} from "drizzle-orm"

import {
  completion,
  lesson,
  lessonTag,
  like,
  user,
  type Db,
} from "@workspace/db"
import {
  canUpgrade,
  isSubject,
  upgradeLesson,
  type Level,
  type Subject,
} from "@workspace/spec"

// What Explore and profiles read: lessons as cards, straight from the database
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
  /** The lesson's subject, for filtering; no card shows it. */
  subject: Subject
  /** The lesson's tag labels as written, in the lesson's language; the card shows the first two. */
  tags: string[]
  level: Level
  minutes: number
  /** The lesson's BCP 47 language, so the card can set `lang` and direction. */
  language: string
  /** Who published it; null for anonymous lessons (never listed) or when the owner is gone. */
  author: {
    /** Their user id, so a page can tell the viewer's own lessons apart. */
    id: string
    handle: string | null
    name: string
    image: string | null
  } | null
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
  spec: lesson.spec,
  title: field("title"),
  summary: field("summary"),
  subject: field("subject"),
  tags: sql<unknown>`${lesson.lesson}->'tags'`,
  // Lessons published before spec 0.6 are stored with a `topic` label instead; see toSummary.
  topic: field("topic"),
  level: field("level"),
  minutes: field("estimatedMinutes"),
  language: field("language"),
  targetLanguage: field("targetLanguage"),
  plays: lesson.plays,
  likes: lesson.likes,
  visibility: lesson.visibility,
  hidden: lesson.hidden,
  createdAt: lesson.createdAt,
  authorId: lesson.ownerId,
  authorHandle: user.handle,
  authorName: user.name,
  authorImage: user.image,
}

interface Row {
  id: string
  slug: string
  spec: string
  title: string
  summary: string
  subject: string | null
  /** The JSON array, or its text, depending on the driver; null when the row predates tags. */
  tags: unknown
  topic: string | null
  level: string
  minutes: string | number
  language: string
  targetLanguage: string | null
  plays: number
  likes: number
  visibility: Visibility
  hidden: boolean
  createdAt: Date
  authorId: string | null
  authorHandle: string | null
  authorName: string | null
  authorImage: string | null
}

/**
 * A row's subject and tag labels, as the lesson page would show them: a row from before the
 * current spec goes through the same upgrade as a lesson page's JSON (an old `topic` becomes a
 * subject and labels, slug tags become labels), so nothing shows a slug. Only the fields the
 * upgrade reads are passed, not the whole JSON.
 */
function metaOf(row: Row): { subject: Subject; tags: string[] } {
  const raw = typeof row.tags === "string" ? JSON.parse(row.tags) : row.tags
  const stored = {
    spec: row.spec,
    subject: row.subject ?? undefined,
    tags: Array.isArray(raw) ? raw : undefined,
    topic: row.topic ?? undefined,
    language: row.language,
    targetLanguage: row.targetLanguage ?? undefined,
  }
  const meta = (canUpgrade(stored) ? upgradeLesson(stored) : stored) as {
    subject?: unknown
    tags?: unknown
  }
  return {
    subject: isSubject(meta.subject) ? meta.subject : "life",
    tags: Array.isArray(meta.tags)
      ? meta.tags.filter((t): t is string => typeof t === "string")
      : [],
  }
}

function toSummary(row: Row): LessonSummary {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    summary: row.summary,
    ...metaOf(row),
    level: row.level as Level,
    minutes: Number(row.minutes),
    language: row.language,
    author:
      row.authorId && row.authorName !== null
        ? {
            id: row.authorId,
            handle: row.authorHandle,
            name: row.authorName,
            image: row.authorImage,
          }
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
export const listed = (now: number) =>
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

/** What narrows an Explore list: one subject, one tag within it, or both. */
export interface ExploreFilter {
  subject?: Subject
  tag?: string
  now?: number
}

/** The Explore list for one tab, optionally narrowed to a subject and a tag. */
export async function listLessons(
  db: Db,
  sort: ExploreSort,
  limit: number,
  { subject, tag, now = Date.now() }: ExploreFilter = {}
): Promise<LessonSummary[]> {
  const rows = await db
    .select(columns)
    .from(lesson)
    .leftJoin(user, eq(user.id, lesson.ownerId))
    .where(
      and(
        listed(now),
        // Served by lesson_subject_idx, which is on this same expression.
        subject ? eq(field("subject"), subject) : undefined,
        tag
          ? exists(
              db
                .select({ one: sql`1` })
                .from(lessonTag)
                .where(
                  and(eq(lessonTag.lessonId, lesson.id), eq(lessonTag.tag, tag))
                )
            )
          : undefined
      )
    )
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

/** When the user first finished each of `ids` they have finished, as lesson id → ms since epoch. */
export async function completedAt(
  db: Db,
  userId: string,
  ids: string[]
): Promise<Map<string, number>> {
  if (!ids.length) return new Map()
  const rows = await db
    .select({ id: completion.lessonId, at: completion.completedAt })
    .from(completion)
    .where(
      and(eq(completion.userId, userId), inArray(completion.lessonId, ids))
    )
  return new Map(rows.map((r) => [r.id, r.at.getTime()]))
}

export interface Profile {
  id: string
  handle: string
  name: string
  image: string | null
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
      image: user.image,
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
    image: person.image,
    bio: person.bio,
    joinedAt: person.createdAt.getTime(),
    lessons,
    plays: lessons.reduce((n, l) => n + l.plays, 0),
    likes: lessons.reduce((n, l) => n + l.likes, 0),
  }
}

/** Every lesson the user owns, whatever its visibility, newest first: the list on the owner's own profile. */
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

/**
 * The lessons the user liked, most recently liked first: their profile's Likes tab. Visitors get
 * `listedOnly`, so only what Explore shows; the user themself also sees liked lessons that went
 * unlisted, since they had the link. Expired lessons and ones hidden after a report drop out.
 */
export async function lessonsLikedBy(
  db: Db,
  userId: string,
  {
    listedOnly = false,
    now = Date.now(),
  }: { listedOnly?: boolean; now?: number } = {}
): Promise<LessonSummary[]> {
  const rows = await db
    .select(columns)
    .from(like)
    .innerJoin(lesson, eq(lesson.id, like.lessonId))
    .leftJoin(user, eq(user.id, lesson.ownerId))
    .where(
      and(
        eq(like.userId, userId),
        listedOnly ? listed(now) : and(eq(lesson.hidden, false), live(now))
      )
    )
    .orderBy(desc(like.createdAt), desc(lesson.id))
  return rows.map(toSummary)
}

/** A lesson owner's public name, for the lesson page. */
export async function authorOf(
  db: Db,
  ownerId: string
): Promise<{
  handle: string | null
  name: string
  image: string | null
} | null> {
  const [row] = await db
    .select({ handle: user.handle, name: user.name, image: user.image })
    .from(user)
    .where(eq(user.id, ownerId))
  return row ?? null
}
