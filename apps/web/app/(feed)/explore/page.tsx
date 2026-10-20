import type { Metadata } from "next"

import { LessonFeed } from "@/components/explore/lesson-feed"
import { currentActor } from "@/lib/auth/session"
import { cachedLessons } from "@/lib/explore/cache"
import { completedAt, likedIds } from "@/lib/explore/queries"
import { getDb } from "@/lib/publish/store"
import { SITE } from "@/lib/site"

export const metadata: Metadata = {
  title: "Explore",
  description: `Lessons people made with ${SITE.name} and chose to share.`,
  alternates: { canonical: "/explore" },
}

// The lists come from the data cache (lib/explore/cache.ts); only the session and what the viewer
// liked and finished are read per request. The frame around the list is the (feed) layout's;
// loading.tsx beside this file stands in for the list until it arrives.
export const dynamic = "force-dynamic"

// Newest first, for now: Trending and Top are still in lib/explore/queries.ts for when the feed
// is big enough to need them.
export default async function ExplorePage() {
  const [actor, lessons] = await Promise.all([
    currentActor(),
    cachedLessons("new"),
  ])
  const ids = lessons.map((l) => l.id)
  const [liked, completed] = actor
    ? await getDb().then((db) =>
        Promise.all([
          likedIds(db, actor.userId, ids),
          completedAt(db, actor.userId, ids),
        ])
      )
    : [new Set<string>(), new Map<string, number>()]
  return (
    <>
      {/* The list is the page: no heading or blurb, only a name for assistive tech. */}
      <h1 className="sr-only">Explore</h1>
      {lessons.length ? (
        <LessonFeed
          lessons={lessons}
          viewer={{ signedIn: actor !== null, liked, completed }}
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
