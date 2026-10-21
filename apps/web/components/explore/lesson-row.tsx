import Link from "next/link"
import { PlayIcon } from "lucide-react"

import { stringsFor, TimeAgo } from "@workspace/player"
import { cn } from "@workspace/ui/lib/utils"

import { UserAvatar } from "@/components/account/user-avatar"
import { compact } from "@/lib/explore/browser"
import type { LessonSummary } from "@/lib/explore/queries"
import { lessonPath } from "@/lib/publish/paths"

import { CompletedCheck } from "./completed-check"
import { LessonMenu } from "./lesson-menu"
import { LikeButton } from "./like-button"
import { ProgressPie } from "./progress-pie"

/** What the viewer can do on a row: like it (signed in) or be told to sign in. Omit for a read-only row. */
export interface Viewer {
  signedIn: boolean
  /** Ids of the lessons the viewer has liked. */
  liked: ReadonlySet<string>
  /** When the viewer first finished each lesson they've finished, as lesson id → ms since epoch. */
  completed?: ReadonlyMap<string, number>
  /** The viewer's user id, so their own rows get the menu to unpublish, rename, or delete them. */
  userId?: string
}

const t = stringsFor("en")

/** The title link, stretched over the whole row. */
const ROW_LINK =
  "rounded-sm outline-none after:absolute after:inset-0 focus-visible:after:ring-3 focus-visible:after:ring-ring/50"

/**
 * A lesson as one row of the Explore feed or a profile. A byline first: who made it (their
 * picture and handle) at the start and how long ago at the end, so the ages line up as a column
 * down the feed. Then the title, up to two lines of summary, and one meta line with the lesson's
 * first two tags (its label, then the product or field, as the agent wrote them), length and level
 * (then a green check when the viewer has finished it, or an amber pie of how far they got
 * when this browser holds their progress), and the plays and likes at its end. The
 * subject is never shown: it's for filters. The whole row opens the lesson; the author, the check,
 * and the heart are their own targets. Rows sit between hairlines (the list adds them), not in
 * cards. Hovering one turns it into a bordered, filled tile that reaches past the column into the
 * gutter (negative margin, matching padding), so the text stays lined up with the page and the
 * tile has room around it; the list hides the two hairlines it would touch. `rank` puts a number
 * in the margin on the Top tab. The author shows on a profile too, though every row shares it. The
 * viewer's own rows open a menu on right click to unpublish, rename, or delete them (LessonMenu).
 */
export function LessonRow({
  lesson,
  viewer,
  rank,
  className,
}: {
  lesson: LessonSummary
  viewer?: Viewer
  rank?: number
  className?: string
}) {
  const href = lessonPath(lesson.slug, lesson.id)
  const completedAt = viewer?.completed?.get(lesson.id)
  const author = lesson.author
  const mine = viewer?.userId !== undefined && author?.id === viewer.userId
  const byline = author ? (
    author.handle ? (
      <Link
        href={`/u/${author.handle}`}
        className="relative z-10 flex min-w-0 items-center gap-1.5 rounded-sm text-foreground outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <UserAvatar image={author.image} handle={author.handle} size="row" />
        <bdi dir="ltr" className="min-w-0 truncate">
          {author.handle}
        </bdi>
      </Link>
    ) : (
      <span className="flex min-w-0 items-center gap-1.5">
        <UserAvatar image={author.image} handle={null} size="row" />
        <span className="min-w-0 truncate">{author.name}</span>
      </span>
    )
  ) : null
  const facts: React.ReactNode[] = [
    ...lesson.tags.slice(0, 2).map((tag, i) => (
      <bdi key={`tag-${i}`} lang={lesson.language} className="min-w-0 truncate">
        {tag}
      </bdi>
    )),
    <span key="minutes" className="shrink-0">
      {t.minutes(lesson.minutes)}
    </span>,
    <span key="level" className="shrink-0">
      {t.levels[lesson.level]}
    </span>,
  ]
  return (
    <div
      className={cn(
        "relative -mx-3 flex gap-3 rounded-xl border border-transparent px-3 py-5 transition-colors has-[[data-slot=row-link]:hover]:border-border has-[[data-slot=row-link]:hover]:bg-muted/50 sm:-mx-4 sm:px-4 dark:has-[[data-slot=row-link]:hover]:bg-input/30",
        className
      )}
    >
      {rank !== undefined ? (
        <span
          className="w-6 shrink-0 pt-0.5 font-mono text-sm text-muted-foreground tabular-nums"
          aria-label={`Number ${rank}`}
        >
          {String(rank).padStart(2, "0")}
        </span>
      ) : null}
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center justify-between gap-3 text-sm text-muted-foreground">
          {byline}
          <TimeAgo
            at={lesson.createdAt}
            lang="en"
            className="ms-auto shrink-0"
          />
        </div>
        <h3 className="mt-2 text-base leading-snug font-medium">
          {mine ? (
            <LessonMenu
              lesson={{
                id: lesson.id,
                title: lesson.title,
                language: lesson.language,
                visibility: lesson.visibility,
              }}
              href={href}
              className={ROW_LINK}
            >
              {lesson.title}
            </LessonMenu>
          ) : (
            <Link
              href={href}
              data-slot="row-link"
              lang={lesson.language}
              dir="auto"
              className={ROW_LINK}
            >
              {lesson.title}
            </Link>
          )}
        </h3>
        <p
          lang={lesson.language}
          dir="auto"
          className="mt-1 line-clamp-2 text-sm text-muted-foreground"
        >
          {lesson.summary}
        </p>
        <div className="mt-3 flex items-center justify-between gap-3 text-sm text-muted-foreground">
          <p className="flex min-w-0 flex-1 basis-0 flex-wrap items-center gap-x-1.5">
            {facts.map((fact, i) => (
              <span key={i} className="contents">
                {i > 0 ? (
                  <span aria-hidden="true" className="text-muted-foreground/60">
                    ·
                  </span>
                ) : null}
                {fact}
              </span>
            ))}
            {completedAt !== undefined ? (
              <CompletedCheck at={completedAt} className="relative z-10" />
            ) : (
              <ProgressPie
                progressKey={href.slice(1)}
                className="relative z-10"
              />
            )}
          </p>
          <span className="ms-auto flex shrink-0 items-center gap-3">
            <span
              className="flex items-center gap-1 tabular-nums"
              aria-label={`${lesson.plays} ${lesson.plays === 1 ? "play" : "plays"}`}
            >
              <PlayIcon className="size-3.5" aria-hidden="true" />
              {compact(lesson.plays)}
            </span>
            {viewer ? (
              <LikeButton
                id={lesson.id}
                likes={lesson.likes}
                liked={viewer.liked.has(lesson.id)}
                signedIn={viewer.signedIn}
                className="relative z-10 -me-2"
              />
            ) : (
              <span
                className="flex items-center gap-1 tabular-nums"
                aria-label={`${lesson.likes} ${lesson.likes === 1 ? "like" : "likes"}`}
              >
                <HeartGlyph />
                {compact(lesson.likes)}
              </span>
            )}
          </span>
        </div>
      </div>
    </div>
  )
}

function HeartGlyph() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-3.5"
      aria-hidden="true"
    >
      <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
    </svg>
  )
}
