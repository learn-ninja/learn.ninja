import type { Metadata } from "next"

import { ExploreTabs } from "@/components/explore/explore-tabs"
import { LessonFeed } from "@/components/explore/lesson-feed"
import { currentActor } from "@/lib/auth/session"
import { cachedLessons } from "@/lib/explore/cache"
import { EXPLORE_SORTS, likedIds } from "@/lib/explore/queries"
import { getDb } from "@/lib/publish/store"
import { SITE } from "@/lib/site"

export const metadata: Metadata = {
  title: "Explore",
  description: `Lessons people made with ${SITE.name} and chose to share.`,
  alternates: { canonical: "/explore" },
}

// The lists come from the data cache (lib/explore/cache.ts); only the session and "liked by me"
// are read per request. The frame around the list is the (feed) layout's; loading.tsx beside this
// file stands in for the list until it arrives.
export const dynamic = "force-dynamic"

export default async function ExplorePage({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string | string[] }>
}) {
  const wanted = (await searchParams).sort
  const sort = EXPLORE_SORTS.find((s) => s === wanted) ?? "new"
  const [actor, lessons] = await Promise.all([
    currentActor(),
    cachedLessons(sort),
  ])
  const liked = actor
    ? await likedIds(
        await getDb(),
        actor.userId,
        lessons.map((l) => l.id)
      )
    : new Set<string>()
  return (
    <>
      {/* The list is the page: no heading or blurb, only a name for assistive tech. */}
      <h1 className="sr-only">Explore</h1>
      <ExploreTabs sort={sort} />
      {lessons.length ? (
        <LessonFeed
          lessons={lessons}
          viewer={{ signedIn: actor !== null, liked }}
          ranked={sort === "top"}
        />
      ) : (
        <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
          Nothing here yet. Be the first: ask your agent for a lesson, say keep
          it, and list it from your settings.
        </p>
      )}
    </>
  )
}
