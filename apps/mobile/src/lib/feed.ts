import type { Level } from "@workspace/spec"

import { apiFetch } from "./api"

// Explore and the profiles from the web app's JSON (apps/web/lib/explore/app-api.ts): the same
// rows the web's pages draw, a page at a time.

/** A lesson as a row shows it (LessonSummary in apps/web/lib/explore/queries.ts). */
export interface LessonRowData {
  id: string
  slug: string
  title: string
  summary: string
  level: Level
  minutes: number
  /** The lesson's language, so its title and summary run the right way. */
  language: string
  author: {
    id: string
    handle: string | null
    name: string
    image: string | null
  } | null
  views: number
  likes: number
  visibility: "public" | "unlisted" | "team"
  hidden: boolean
  createdAt: number
  expiresAt: number | null
  /** On the In progress tab: how far the learner got. */
  progress?: { done: number; total: number }
}

export interface Viewer {
  signedIn: boolean
  liked: string[]
  /** When they first finished each lesson they've finished: id → ms since epoch. */
  completed: Record<string, number>
}

export interface FeedPage {
  lessons: LessonRowData[]
  next: string | null
  viewer: Viewer
}

export interface ActivityCell {
  day: string
  lessons: number
  level: 0 | 1 | 2 | 3 | 4
  rest: boolean
}

export interface ActivityGridData {
  total: number
  /** 53 columns of 7 days, Sunday first; null after today. */
  columns: (ActivityCell | null)[][]
  months: { label: string; column: number }[]
  streak: { current: number; longest: number }
}

export interface ProfileData {
  profile: {
    id: string
    handle: string
    image: string | null
    bio: string | null
    joinedAt: number
  }
  own: boolean
  /** Whether the learner blocked this person: then `lessons` and `likes` are empty. */
  blocked?: boolean
  lessons: LessonRowData[]
  inProgress: LessonRowData[] | null
  likes: LessonRowData[]
  grid: ActivityGridData
  viewer: Viewer
}

export class FeedError extends Error {
  constructor(readonly status: number) {
    super(`The server answered ${status}.`)
  }
}

async function getJson<T>(path: string): Promise<T> {
  const res = await apiFetch(path)
  const body = (await res.json().catch(() => null)) as
    (T & { ok?: boolean }) | null
  if (!res.ok || !body?.ok) throw new FeedError(res.status)
  return body
}

/** One page of Explore's New list; `cursor` is the last page's `next`. */
export const fetchExplore = (cursor?: string | null) =>
  getJson<FeedPage>(
    `/api/explore${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`
  )

/** A profile, with the activity grid ending on the device's today. */
export const fetchProfile = (handle: string) =>
  getJson<ProfileData>(
    `/api/profiles/${encodeURIComponent(handle)}?tz=${encodeURIComponent(
      Intl.DateTimeFormat().resolvedOptions().timeZone
    )}`
  )

/** Likes the lesson, or takes the like back; the server's count. */
export async function setLiked(id: string, liked: boolean) {
  const res = await apiFetch(`/api/lessons/${encodeURIComponent(id)}/like`, {
    method: liked ? "POST" : "DELETE",
  })
  const body = (await res.json().catch(() => null)) as {
    ok?: boolean
    liked?: boolean
    likes?: number
  } | null
  if (!res.ok || !body?.ok) throw new FeedError(res.status)
  return { liked: Boolean(body.liked), likes: body.likes ?? 0 }
}

/** Where a lesson plays: the web's /l/{slug}-{id}, which the app's lesson route shares. */
export const lessonParam = (row: Pick<LessonRowData, "slug" | "id">) =>
  `${row.slug}-${row.id}`
