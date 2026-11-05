import type { Db } from "@workspace/db"

import {
  buildGrid,
  isTimeZone,
  localDay,
  type ActivityGridData,
} from "@/lib/activity/activity"
import type { Actor } from "@/lib/auth/actor"
import { normalizeHandle } from "@/lib/auth/handle-rules"
import type { Reply } from "@/lib/publish/handlers"
import type { RateLimiter } from "@/lib/publish/rate-limit"

import { liveViewCounts } from "./handlers"
import {
  activityDays,
  completedAt,
  lessonsInProgress,
  lessonsLikedBy,
  lessonsOwnedBy,
  likedIds,
  listLessons,
  profileByHandle,
  type InProgress,
  type LessonSummary,
} from "./queries"
import type { ViewCounter } from "./views"

// Explore and the profiles as JSON, for the iOS app: the same queries, visibility, and viewer state
// as the pages (app/(feed)/explore/page.tsx and app/(feed)/u/[handle]/page.tsx), which render them
// on the server. GET /api/explore pages through the New list; GET /api/profiles/{handle} is one
// person's profile. Like the pages, both answer anyone; a signed-in viewer also gets what they
// liked and finished, and their own profile shows everything they own and their In progress tab.
// Independent of Next.js so it's tested directly.

/** How many lessons one page of the feed holds, as the Explore page shows (EXPLORE_PAGE_SIZE). */
export const FEED_PAGE_SIZE = 30

export interface AppApiDeps {
  db: Db
  views: ViewCounter
  /** Reads per client (the `read` limit the lesson JSON has). */
  limiter: RateLimiter
  now?: () => number
}

/** What the viewer has done to the lessons on a page: liked, and when they first finished each. */
export interface ViewerState {
  signedIn: boolean
  liked: string[]
  completed: Record<string, number>
}

const TOO_MANY: Reply = {
  status: 429,
  body: {
    ok: false,
    error: "rate_limited",
    message: "Too many requests. Try again in a few minutes.",
  },
}

const NO_PROFILE: Reply = {
  status: 404,
  body: { ok: false, error: "not_found", message: "Nobody has this handle." },
}

/** A page's cursor: the last lesson's time and id, so the next page starts after it. */
export function encodeCursor(row: Pick<LessonSummary, "createdAt" | "id">) {
  return `${row.createdAt}.${row.id}`
}

export function decodeCursor(
  cursor: string | null
): { createdAt: number; id: string } | null {
  const match = cursor?.match(/^(\d{1,15})\.([A-Za-z0-9_-]{1,64})$/)
  return match ? { createdAt: Number(match[1]), id: match[2]! } : null
}

async function viewerState(
  db: Db,
  actor: Actor | null,
  ids: string[]
): Promise<ViewerState> {
  if (!actor) return { signedIn: false, liked: [], completed: {} }
  const [liked, completed] = await Promise.all([
    likedIds(db, actor.userId, ids),
    completedAt(db, actor.userId, ids),
  ])
  return {
    signedIn: true,
    liked: [...liked],
    completed: Object.fromEntries(completed),
  }
}

/** The rows with their live view counts (stored plus pending), as the Explore page shows them. */
async function withLiveViews<T extends LessonSummary>(
  rows: T[],
  deps: AppApiDeps
): Promise<T[]> {
  if (!rows.length) return rows
  const views = await liveViewCounts(
    rows.map((r) => r.id),
    deps
  )
  return rows.map((r) => ({ ...r, views: views.get(r.id) ?? r.views }))
}

/** GET /api/explore[?cursor=…]: a page of the New list, newest first, and `next` for the page after. */
export async function exploreFeed(
  req: { actor: Actor | null; cursor: string | null; client: string },
  deps: AppApiDeps
): Promise<Reply> {
  if (!(await deps.limiter.allow(req.client))) return TOO_MANY
  const now = deps.now?.() ?? Date.now()
  const before = decodeCursor(req.cursor) ?? undefined
  const rows = await listLessons(deps.db, "new", FEED_PAGE_SIZE + 1, {
    now,
    before,
  })
  const page = rows.slice(0, FEED_PAGE_SIZE)
  const last = page.at(-1)
  const lessons = await withLiveViews(page, deps)
  return {
    status: 200,
    body: {
      ok: true,
      lessons,
      next: rows.length > FEED_PAGE_SIZE && last ? encodeCursor(last) : null,
      viewer: await viewerState(
        deps.db,
        req.actor,
        lessons.map((l) => l.id)
      ),
    },
  }
}

export interface ProfileReply {
  ok: true
  profile: {
    id: string
    handle: string
    image: string | null
    bio: string | null
    joinedAt: number
    views: number
    likes: number
  }
  /** Whether it's the viewer's own: then `lessons` is everything they own, and `inProgress` is set. */
  own: boolean
  lessons: LessonSummary[]
  inProgress: InProgress[] | null
  likes: LessonSummary[]
  /** A year of their learning, ending on the viewer's today in `tz`. */
  grid: ActivityGridData
  viewer: ViewerState
}

/**
 * GET /api/profiles/{handle}?tz=…: the profile page's data. Visitors see the listed lessons and the
 * listed lessons liked; the person themself sees every lesson they own (private and hidden ones
 * too), the liked lessons that went unlisted, and what they left midway.
 */
export async function profileFeed(
  req: {
    handle: string
    actor: Actor | null
    tz: string | null
    client: string
  },
  deps: AppApiDeps
): Promise<Reply> {
  if (!(await deps.limiter.allow(req.client))) return TOO_MANY
  const now = deps.now?.() ?? Date.now()
  const handle = normalizeHandle(req.handle)
  const profile = handle ? await profileByHandle(deps.db, handle, now) : null
  if (!profile) return NO_PROFILE
  const own = req.actor?.userId === profile.id
  const [owned, started, liked, days] = await Promise.all([
    own ? lessonsOwnedBy(deps.db, profile.id) : null,
    own ? lessonsInProgress(deps.db, profile.id, now) : null,
    lessonsLikedBy(deps.db, profile.id, { listedOnly: !own, now }),
    activityDays(deps.db, profile.id),
  ])
  const tz = isTimeZone(req.tz) ? req.tz : "UTC"
  const lessons = await withLiveViews(owned ?? profile.lessons, deps)
  const ids = [...lessons, ...(started ?? []), ...liked].map((l) => l.id)
  const body: ProfileReply = {
    ok: true,
    profile: {
      id: profile.id,
      handle: profile.handle,
      image: profile.image,
      bio: profile.bio,
      joinedAt: profile.joinedAt,
      views: profile.views,
      likes: profile.likes,
    },
    own,
    lessons,
    inProgress: started,
    likes: liked,
    grid: buildGrid(days, localDay(new Date(now), tz)),
    viewer: await viewerState(deps.db, req.actor, [...new Set(ids)]),
  }
  return { status: 200, body: body as unknown as Record<string, unknown> }
}
