import Link from "next/link"
import { PlayIcon, UserRoundIcon } from "lucide-react"

import { stringsFor } from "@workspace/player"
import { Badge } from "@workspace/ui/components/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { cn } from "@workspace/ui/lib/utils"

import { compact } from "@/lib/explore/browser"
import type { LessonSummary } from "@/lib/explore/queries"
import { lessonPath } from "@/lib/publish/paths"

import { LikeButton } from "./like-button"

/** What the viewer can do on a card: like it (signed in) or be told to sign in. Omit for a read-only card. */
export interface Viewer {
  signedIn: boolean
  /** Ids of the lessons the viewer has liked. */
  liked: ReadonlySet<string>
}

const t = stringsFor("en")

/**
 * A lesson in Explore, on a profile, or in the home page's strip: title, summary, the same three
 * badges as the lesson's title screen, then who made it and how it's doing. The whole card opens
 * the lesson; the author and the heart are their own links.
 */
export function LessonCard({
  lesson,
  viewer,
  className,
}: {
  lesson: LessonSummary
  viewer?: Viewer
  className?: string
}) {
  const href = lessonPath(lesson.slug, lesson.id)
  const handle = lesson.author?.handle
  return (
    <Card
      className={cn(
        "relative shadow-xs transition-colors has-[[data-slot=card-link]:hover]:bg-muted/50 dark:has-[[data-slot=card-link]:hover]:bg-input/30",
        className
      )}
    >
      <CardHeader>
        <CardTitle>
          <Link
            href={href}
            data-slot="card-link"
            lang={lesson.language}
            dir="auto"
            className="rounded-md outline-none after:absolute after:inset-0 after:rounded-xl focus-visible:after:ring-3 focus-visible:after:ring-ring/50"
          >
            {lesson.title}
          </Link>
        </CardTitle>
        <CardDescription
          lang={lesson.language}
          dir="auto"
          className="line-clamp-2"
        >
          {lesson.summary}
        </CardDescription>
      </CardHeader>
      <CardContent className="mt-auto flex flex-wrap gap-1.5">
        {lesson.topic ? (
          <Badge variant="outline" lang={lesson.language} dir="auto">
            {lesson.topic}
          </Badge>
        ) : null}
        <Badge variant="outline">{t.minutes(lesson.minutes)}</Badge>
        <Badge variant="outline">{t.levels[lesson.level]}</Badge>
      </CardContent>
      <CardFooter className="gap-3 py-2 text-sm text-muted-foreground">
        {handle ? (
          <Link
            href={`/u/${handle}`}
            className="relative z-10 flex min-w-0 items-center gap-1 rounded-md outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <UserRoundIcon className="size-3.5 shrink-0" aria-hidden="true" />
            <bdi dir="ltr" className="truncate">
              @{handle}
            </bdi>
          </Link>
        ) : (
          <span className="min-w-0 truncate">{lesson.author?.name ?? ""}</span>
        )}
        <span
          className="ms-auto flex shrink-0 items-center gap-1 tabular-nums"
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
            className="flex shrink-0 items-center gap-1 tabular-nums"
            aria-label={`${lesson.likes} ${lesson.likes === 1 ? "like" : "likes"}`}
          >
            <HeartGlyph />
            {compact(lesson.likes)}
          </span>
        )}
      </CardFooter>
    </Card>
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
