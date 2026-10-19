import type { Metadata } from "next"

import { ExploreTabs } from "@/components/explore/explore-tabs"
import { LessonFeed } from "@/components/explore/lesson-feed"
import { SiteFooter } from "@/components/site/site-footer"
import { SiteHeader } from "@/components/site/site-header"
import { currentActor } from "@/lib/auth/session"
import { cachedLessons } from "@/lib/explore/cache"
import { EXPLORE_SORTS, likedIds, type ExploreSort } from "@/lib/explore/queries"
import { getDb } from "@/lib/publish/store"
import { SITE } from "@/lib/site"

export const metadata: Metadata = {
  title: "Explore",
  description: `Lessons people made with ${SITE.name} and chose to share.`,
  alternates: { canonical: "/explore" },
}

// The lists come from the data cache (lib/explore/cache.ts); only the session and "liked by me"
// are read per request.
export const dynamic = "force-dynamic"

const TITLES: Record<ExploreSort, string> = {
  new: "The newest lessons people chose to share.",
  trending: "Played and liked the most lately.",
  top: "Liked the most, all time.",
}

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
    <div className="flex min-h-svh flex-col">
      <SiteHeader handle={actor ? (actor.handle ?? "") : null} />
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-4 py-12 sm:px-6 sm:py-16">
        <div className="flex flex-col gap-4">
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Explore
          </h1>
          <p className="max-w-xl text-base text-pretty text-muted-foreground sm:text-lg">
            {TITLES[sort]} Lessons land here when their makers save them to an
            account and list them.
          </p>
        </div>
        <ExploreTabs sort={sort} />
        {lessons.length ? (
          <LessonFeed
            lessons={lessons}
            viewer={{ signedIn: actor !== null, liked }}
          />
        ) : (
          <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
            Nothing here yet. Be the first: ask your agent for a lesson, keep
            it, and list it from your settings.
          </p>
        )}
      </main>
      <SiteFooter className="max-w-2xl" />
    </div>
  )
}
