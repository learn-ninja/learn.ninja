import type { Metadata } from "next"
import { headers } from "next/headers"

import { ExploreGreeting } from "@/components/explore/explore-greeting"
import { LessonFeed } from "@/components/explore/lesson-feed"
import { RefreshAfterView } from "@/components/explore/refresh-after-view"
import { currentActor } from "@/lib/auth/session"
import {
  cachedLessons,
  flushViewsLater,
  getViewCounter,
} from "@/lib/explore/cache"
import { greetingFor, localHour } from "@/lib/explore/greeting"
import { liveViewCounts } from "@/lib/explore/handlers"
import { blockedIds, completedAt, likedIds } from "@/lib/explore/queries"
import { getDb } from "@/lib/publish/store"
import { SITE } from "@/lib/site"

export const metadata: Metadata = {
  title: "Explore",
  description: `Lessons people made with ${SITE.name} and chose to share.`,
  alternates: { canonical: "/explore" },
}

// The lists come from the data cache (lib/explore/cache.ts); only the session, the view counts, and
// what the viewer liked and finished are read per request. The frame around the list is the (feed) layout's;
// loading.tsx beside this file stands in for the list until it arrives.
export const dynamic = "force-dynamic"

// Newest first, for now: Trending and Top are still in lib/explore/queries.ts for when the feed
// is big enough to need them. Narrowing by subject or tag is there too (cachedLessons takes both);
// nothing links to it until tags are governed well enough to show (plans/subjects-and-tags.md).
export default async function ExplorePage() {
  const [actor, cached, h] = await Promise.all([
    currentActor(),
    cachedLessons("new"),
    headers(),
  ])
  // Vercel names the visitor's time zone from their IP, so the greeting fits their hour.
  const greeting = greetingFor(
    localHour(new Date(), h.get("x-vercel-ip-timezone"))
  )
  flushViewsLater()
  const db = await getDb()
  // The list is everyone's, from the cache; the people the viewer blocked come out of it here.
  const blocked = actor ? await blockedIds(db, actor.userId) : null
  const lessons = blocked?.size
    ? cached.filter((l) => !l.author || !blocked.has(l.author.id))
    : cached
  const ids = lessons.map((l) => l.id)
  const [views, liked, completed] = await Promise.all([
    liveViewCounts(ids, { db, views: await getViewCounter() }),
    actor ? likedIds(db, actor.userId, ids) : new Set<string>(),
    actor ? completedAt(db, actor.userId, ids) : new Map<string, number>(),
  ])
  return (
    <>
      {/* The list is the page: a greeting over it, and a name only for assistive tech. */}
      <h1 className="sr-only">Explore</h1>
      <ExploreGreeting greeting={greeting} />
      <RefreshAfterView />
      {lessons.length ? (
        <LessonFeed
          lessons={lessons.map((l) => ({
            ...l,
            views: views.get(l.id) ?? l.views,
          }))}
          viewer={{
            signedIn: actor !== null,
            liked,
            completed,
            userId: actor?.userId,
          }}
        />
      ) : (
        <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
          Nothing here yet. Be the first: ask your agent for a lesson and say
          keep it.
        </p>
      )}
    </>
  )
}
