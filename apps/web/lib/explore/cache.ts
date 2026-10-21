import { revalidateTag, unstable_cache } from "next/cache"

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
// anyway every minute so view counts stay close to live. "Liked by me" is read per request on top
// (see app/(feed)/explore/page.tsx).

export const EXPLORE_TAG = "explore"
/** The cache tag of one subject's lists, so a publish can refresh just them. revalidateExplore clears every list anyway. */
export const subjectTag = (subject: Subject) => `${EXPLORE_TAG}:${subject}`
const REVALIDATE_SECONDS = 60
/** How many cards one Explore tab shows. */
export const EXPLORE_PAGE_SIZE = 30

/** Marks every cached list stale, so the next request reads fresh. Call from route handlers and server actions only. */
export function revalidateExplore() {
  revalidateTag(EXPLORE_TAG, { expire: 0 })
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

/** The Explore list for one tab, narrowed to a subject and tag when given. Pending views are added to the table first, so the counts are current. */
export function cachedLessons(
  sort: ExploreSort,
  limit = EXPLORE_PAGE_SIZE,
  { subject, tag }: Pick<ExploreFilter, "subject" | "tag"> = {}
): Promise<LessonSummary[]> {
  return unstable_cache(
    async () => {
      const db = await getDb()
      await flushPendingViews({ db, views: await getViewCounter() })
      return listLessons(db, sort, limit, { subject, tag })
    },
    ["explore", sort, subject ?? "all", tag ?? "", String(limit)],
    {
      tags: [EXPLORE_TAG, ...(subject ? [subjectTag(subject)] : [])],
      revalidate: REVALIDATE_SECONDS,
    }
  )()
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
