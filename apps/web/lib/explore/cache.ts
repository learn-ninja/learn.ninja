import { revalidateTag, unstable_cache } from "next/cache"
import { after } from "next/server"

import {
  getDb,
  redisFromEnv,
  StorageNotConfiguredError,
} from "@/lib/publish/store"

import { flushPendingViews } from "./handlers"
import {
  RedisViewCounter,
  WriteThroughViewCounter,
  type ViewCounter,
} from "./views"
import type { Subject } from "@workspace/spec"

import {
  listLessons,
  profileByHandle,
  type ExploreFilter,
  type ExploreSort,
  type LessonSummary,
  type Profile,
} from "./queries"

// The Explore lists and profiles are read from the database through Next's data cache, tagged so a
// like, a publish, or a visibility switch refreshes them at once (revalidateExplore), and refreshed
// anyway every minute so the order and the profiles' totals stay close to live. The feed's view
// counts and "liked by me" are read per request on top (see app/(feed)/explore/page.tsx).

export const EXPLORE_TAG = "explore"
/** The cache tag of one subject's lists, so a publish can refresh just them. revalidateExplore clears every list anyway. */
export const subjectTag = (subject: Subject) => `${EXPLORE_TAG}:${subject}`
const REVALIDATE_SECONDS = 60
/** How many cards one Explore tab shows. */
export const EXPLORE_PAGE_SIZE = 30

/**
 * Marks every cached list stale. "now": the next request waits for fresh lists (a lesson hidden,
 * renamed, or deleted must not show again). "soon": the next request is served the stale lists
 * while fresh ones load, so a like or a new avatar never makes a visitor wait. Call from route
 * handlers and server actions only.
 */
export function revalidateExplore(when: "now" | "soon" = "now") {
  revalidateTag(EXPLORE_TAG, when === "now" ? { expire: 0 } : "max")
}

const shared = globalThis as { learnViews?: ViewCounter }

/** Where views pile up: Redis when it's configured, otherwise straight into Postgres. */
export async function getViewCounter(): Promise<ViewCounter> {
  if (!shared.learnViews) {
    const redis = redisFromEnv()
    shared.learnViews = redis
      ? new RedisViewCounter(redis)
      : new WriteThroughViewCounter(await getDb())
  }
  return shared.learnViews
}

/**
 * The Explore list for one tab, narrowed to a subject and tag when given. Its view counts are
 * the table's; pages add the pending ones per request (liveViewCounts) and flush them after the
 * response (flushViewsLater), so a refill never waits on writes.
 */
export function cachedLessons(
  sort: ExploreSort,
  limit = EXPLORE_PAGE_SIZE,
  { subject, tag }: Pick<ExploreFilter, "subject" | "tag"> = {}
): Promise<LessonSummary[]> {
  return unstable_cache(
    async () => listLessons(await getDb(), sort, limit, { subject, tag }),
    ["explore", sort, subject ?? "all", tag ?? "", String(limit)],
    {
      tags: [EXPLORE_TAG, ...(subject ? [subjectTag(subject)] : [])],
      revalidate: REVALIDATE_SECONDS,
    }
  )()
}

/** How often, at most, a page flushes pending views into the table. */
const FLUSH_EVERY_SECONDS = 60

/**
 * Adds pending views to the table after the response is sent, at most once a minute across
 * servers, so the stored counts (and Top and Trending) stay close to live between daily crons.
 */
export function flushViewsLater() {
  after(async () => {
    try {
      await flushPendingViews(
        { db: await getDb(), views: await getViewCounter() },
        { every: FLUSH_EVERY_SECONDS }
      )
    } catch (e) {
      console.error("Flushing views failed:", e)
    }
  })
}

/** The newest listed lessons for the home page, or none when there's no database to read (a build without one). */
export async function recentLessons(limit = 6): Promise<LessonSummary[]> {
  try {
    return await cachedLessons("new", limit)
  } catch (e) {
    if (e instanceof StorageNotConfiguredError) return []
    throw e
  }
}

export function cachedProfile(handle: string): Promise<Profile | null> {
  return unstable_cache(
    async () => profileByHandle(await getDb(), handle),
    ["profile", handle],
    { tags: [EXPLORE_TAG], revalidate: REVALIDATE_SECONDS }
  )()
}
