"use client"

import * as React from "react"
import Link from "next/link"
import { EyeIcon, EyeOffIcon, HeartIcon } from "lucide-react"

import { Badge } from "@workspace/ui/components/badge"
import { Label } from "@workspace/ui/components/label"
import { Switch } from "@workspace/ui/components/switch"

import { compact, exploreApi, type ExploreApi } from "@/lib/explore/browser"
import type { LessonSummary, Visibility } from "@/lib/explore/queries"
import { lessonPath } from "@/lib/publish/paths"

import { FormError } from "./form-error"

/**
 * The lessons in the account, newest first, each with a switch that lists it in Explore or takes
 * it back to link-only. Shown on the owner's own profile, so it always has a handle to credit.
 * A lesson the maker hid stays reachable by its link but can't be listed.
 */
export function YourLessons({
  initial,
  api = exploreApi,
}: {
  initial: LessonSummary[]
  api?: ExploreApi
}) {
  const [lessons, setLessons] = React.useState(initial)
  const [error, setError] = React.useState<string | null>(null)

  async function setVisibility(lesson: LessonSummary, visibility: Visibility) {
    const was = lesson.visibility
    const patch = (v: Visibility) =>
      setLessons((all) =>
        all.map((l) => (l.id === lesson.id ? { ...l, visibility: v } : l))
      )
    patch(visibility)
    setError(null)
    const result = await api.setVisibility(lesson.id, visibility)
    if (result.error) {
      patch(was)
      setError(result.error)
    }
  }

  if (!lessons.length) {
    return (
      <p className="text-sm text-muted-foreground">
        No lessons yet. Ask your agent for one; signed in, it&apos;s saved here.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-muted-foreground">
        Listed lessons show in{" "}
        <Link
          href="/explore"
          className="underline underline-offset-3 hover:text-foreground"
        >
          Explore
        </Link>{" "}
        and on this page for everyone. Unlisted ones open only from their link.
      </p>
      <ul className="flex flex-col divide-y rounded-xl border">
        {lessons.map((lesson) => {
          const switchId = `listed-${lesson.id}`
          return (
            <li
              key={lesson.id}
              className="flex items-center justify-between gap-4 px-4 py-3"
            >
              <div className="flex min-w-0 flex-col gap-0.5">
                <Link
                  href={lessonPath(lesson.slug, lesson.id)}
                  lang={lesson.language}
                  dir="auto"
                  className="truncate text-sm font-medium underline-offset-3 hover:underline"
                >
                  {lesson.title}
                </Link>
                <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground tabular-nums">
                  <span className="flex items-center gap-1">
                    <EyeIcon className="size-3.5" aria-hidden="true" />
                    {compact(lesson.views)}
                    <span className="sr-only">views</span>
                  </span>
                  <span className="flex items-center gap-1">
                    <HeartIcon className="size-3.5" aria-hidden="true" />
                    {compact(lesson.likes)}
                    <span className="sr-only">likes</span>
                  </span>
                  {lesson.hidden ? (
                    <Badge variant="secondary">
                      <EyeOffIcon aria-hidden="true" />
                      Hidden after a report
                    </Badge>
                  ) : null}
                </span>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Label htmlFor={switchId} className="text-muted-foreground">
                  {lesson.visibility === "public" ? "Listed" : "Unlisted"}
                </Label>
                <Switch
                  id={switchId}
                  aria-label={`List ${lesson.title} in Explore`}
                  isSelected={lesson.visibility === "public"}
                  isDisabled={lesson.hidden}
                  onChange={(on) =>
                    void setVisibility(lesson, on ? "public" : "unlisted")
                  }
                />
              </div>
            </li>
          )
        })}
      </ul>
      <FormError>{error}</FormError>
    </div>
  )
}
