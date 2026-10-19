import Link from "next/link"
import { PlayIcon } from "lucide-react"

import { stringsFor } from "@workspace/player"
import { cn } from "@workspace/ui/lib/utils"

import { compact } from "@/lib/explore/browser"
import type { LessonSummary } from "@/lib/explore/queries"
import { lessonPath } from "@/lib/publish/paths"

import { LikeButton } from "./like-button"

/** What the viewer can do on a row: like it (signed in) or be told to sign in. Omit for a read-only row. */
export interface Viewer {
  signedIn: boolean
  /** Ids of the lessons the viewer has liked. */
  liked: ReadonlySet<string>
}

const t = stringsFor("en")

/**
 * A lesson as one row of the Explore feed or a profile: the title, up to two lines of summary,
 * then one meta line with who made it, the topic, length and level, and the plays and likes at
 * its end. The whole row opens the lesson; the author and the heart are their own links. Rows
 * sit between hairlines (the list adds them), not in cards. `rank` puts a number in the margin
 * on the Top tab; `showAuthor={false}` drops the handle on a profile, where every row shares it.
 */
export function LessonRow({
  lesson,
  viewer,
  rank,
  showAuthor = true,
  className,
}: {
  lesson: LessonSummary
  viewer?: Viewer
  rank?: number
  showAuthor?: boolean
  className?: string
}) {
  const href = lessonPath(lesson.slug, lesson.id)
  const handle = lesson.author?.handle
  const facts: React.ReactNode[] = []
  if (showAuthor)
    facts.push(
      handle ? (
        <Link
          key="author"
          href={`/u/${handle}`}
          className="relative z-10 min-w-0 truncate rounded-sm text-foreground outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <bdi dir="ltr">@{handle}</bdi>
        </Link>
      ) : (
        <span key="author" className="min-w-0 truncate">
          {lesson.author?.name ?? ""}
        </span>
      )
    )
  if (lesson.topic)
    facts.push(
      <bdi key="topic" lang={lesson.language} className="min-w-0 truncate">
        {lesson.topic}
      </bdi>
    )
  facts.push(
    <span key="minutes" className="shrink-0">
      {t.minutes(lesson.minutes)}
    </span>,
    <span key="level" className="shrink-0">
      {t.levels[lesson.level]}
    </span>
  )
  return (
    <div
      className={cn(
        "relative flex gap-3 py-4 transition-colors has-[[data-slot=row-link]:hover]:bg-muted/50 dark:has-[[data-slot=row-link]:hover]:bg-input/30",
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
        <h3 className="text-base leading-snug font-medium">
          <Link
            href={href}
            data-slot="row-link"
            lang={lesson.language}
            dir="auto"
            className="rounded-sm outline-none after:absolute after:inset-0 focus-visible:after:ring-3 focus-visible:after:ring-ring/50"
          >
            {lesson.title}
          </Link>
        </h3>
        <p
          lang={lesson.language}
          dir="auto"
          className="mt-0.5 line-clamp-2 text-sm text-muted-foreground"
        >
          {lesson.summary}
        </p>
        <div className="mt-2 flex items-center justify-between gap-3 text-sm text-muted-foreground">
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
