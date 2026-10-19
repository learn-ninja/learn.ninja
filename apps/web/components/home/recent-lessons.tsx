import { LessonFeed } from "@/components/explore/lesson-feed"
import { ButtonLink } from "@/components/site/button-link"
import { LogoDivider } from "@/components/site/logo-divider"
import { recentLessons } from "@/lib/explore/cache"

/** The newest listed lessons, six of them, with a way into Explore. Nothing at all until someone lists one. */
export async function RecentLessons() {
  const lessons = await recentLessons(6)
  if (!lessons.length) return null
  return (
    <section className="mx-auto flex w-full max-w-3xl flex-col gap-20 px-4 pb-20 sm:gap-28 sm:px-6 sm:pb-28">
      <LogoDivider />
      <div className="flex flex-col gap-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Recent lessons
          </h2>
          <ButtonLink href="/explore" variant="outline" size="sm">
            Explore all
          </ButtonLink>
        </div>
        <LessonFeed lessons={lessons} />
      </div>
    </section>
  )
}
