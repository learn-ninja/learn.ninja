import Link from "next/link"

import { LearnLogo } from "@workspace/player/logo"
import { stringsFor } from "@workspace/player/strings"
import { cn } from "@workspace/ui/lib/utils"

import { UserAvatar } from "@/components/account/user-avatar"
import type { LessonSummary } from "@/lib/explore/queries"
import { lessonPath } from "@/lib/publish/paths"
import { SITE } from "@/lib/site"

// The lesson cards of the home page's Made this week section (made-this-week.tsx reads the
// lessons; this file only draws them, so Storybook can too).

const t = stringsFor("en")

/** The cards, in two rows offset by half a card, centered on the page and cut by the window. */
export function LessonCards({ lessons }: { lessons: LessonSummary[] }) {
  const half = Math.ceil(lessons.length / 2)
  const rows = [lessons.slice(0, half), lessons.slice(half)]
  return (
    <div className="w-full overflow-hidden mask-x-from-80% mask-x-to-100%">
      <ul className="mx-auto flex w-max flex-col gap-3.5">
        {rows.map((row, i) => (
          <li key={i} className="contents">
            <ul
              className={cn(
                "flex w-max gap-3.5",
                // The second row starts half a card in, so the rows read as one field, not a grid
                i === 1 && "ps-[170px]"
              )}
            >
              {row.map((lesson) => (
                <li key={lesson.id} className="contents">
                  <LessonCard lesson={lesson} />
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </div>
  )
}

/** A lesson's link-preview card: who made it (the mark and the site when nobody's named), the title and summary, its length and level. */
function LessonCard({ lesson }: { lesson: LessonSummary }) {
  const dir = /^(ar|he|fa|ur)\b/i.test(lesson.language) ? "rtl" : "ltr"
  return (
    <Link
      href={lessonPath(lesson.slug, lesson.id)}
      lang={lesson.language}
      dir={dir}
      className="flex w-[326px] shrink-0 flex-col gap-4 rounded-xl bg-card p-5 text-card-foreground ring-1 ring-foreground/10 transition-colors outline-none hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50 dark:hover:bg-input/30"
    >
      <span
        dir="ltr"
        className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground"
      >
        {lesson.author?.handle ? (
          <>
            <UserAvatar
              image={lesson.author.image}
              handle={lesson.author.handle}
              size="row"
            />
            <bdi>{lesson.author.handle}</bdi>
          </>
        ) : (
          <>
            <LearnLogo className="size-4" />
            {SITE.name}
          </>
        )}
      </span>
      <span className="flex flex-col gap-1.5">
        <span className="line-clamp-2 text-base leading-snug font-semibold text-balance">
          {lesson.title}
        </span>
        <span className="line-clamp-2 text-sm text-pretty text-muted-foreground">
          {lesson.summary}
        </span>
      </span>
      <span className="mt-auto flex flex-wrap items-center gap-1.5 text-xs font-medium">
        {[t.minutes(lesson.minutes), t.levels[lesson.level]].map((fact) => (
          <span
            key={fact}
            className="rounded-full border px-2 py-0.5 text-muted-foreground"
          >
            {fact}
          </span>
        ))}
      </span>
    </Link>
  )
}
