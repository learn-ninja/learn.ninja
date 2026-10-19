import { revalidateTag, unstable_cache } from "next/cache"

import { getDb, redisFromEnv, StorageNotConfiguredError } from "@/lib/publish/store"

import { flushPendingPlays } from "./handlers"
import {
  RedisPlayCounter,
  WriteThroughPlayCounter,
  type PlayCounter,
} from "./plays"
import {
  listLessons,
  profileByHandle,
  type ExploreSort,
  type LessonSummary,
  type Profile,
} from "./queries"

// The Explore lists and profiles are read from the database through Next's data cache, tagged so a
// like, a publish, or a visibility switch refreshes them at once (revalidateExplore), and refreshed
// anyway every minute so play counts stay close to live. "Liked by me" is read per request on top
// (see app/explore/page.tsx).

export const EXPLORE_TAG = "explore"
const REVALIDATE_SECONDS = 60
/** How many cards one Explore tab shows. */
export const EXPLORE_PAGE_SIZE = 30

/** Marks every cached list stale, so the next request reads fresh. Call from route handlers and server actions only. */
export function revalidateExplore() {
  revalidateTag(EXPLORE_TAG, { expire: 0 })
}

const shared = globalThis as { learnPlays?: PlayCounter }

/** Where plays pile up: Redis when it's configured, otherwise straight into Postgres. */
export async function getPlayCounter(): Promise<PlayCounter> {
  if (!shared.learnPlays) {
    const redis = redisFromEnv()
    shared.learnPlays = redis
      ? new RedisPlayCounter(redis)
      : new WriteThroughPlayCounter(await getDb())
  }
  return shared.learnPlays
}

/** The Explore list for one tab. Pending plays are added to the table first, so the counts are current. */
export function cachedLessons(
  sort: ExploreSort,
  limit = EXPLORE_PAGE_SIZE
): Promise<LessonSummary[]> {
  return unstable_cache(
    async () => {
      const db = await getDb()
      await flushPendingPlays({ db, plays: await getPlayCounter() })
      return listLessons(db, sort, limit)
    },
    ["explore", sort, String(limit)],
    { tags: [EXPLORE_TAG], revalidate: REVALIDATE_SECONDS }
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
