import { cn } from "@workspace/ui/lib/utils"

import type { LessonSummary } from "@/lib/explore/queries"

import { LessonCard, type Viewer } from "./lesson-card"

/** The feed: cards stacked in one column, newest or best first, read by scrolling. */
export function LessonFeed({
  lessons,
  viewer,
  className,
}: {
  lessons: LessonSummary[]
  viewer?: Viewer
  className?: string
}) {
  return (
    <ul className={cn("flex flex-col gap-4", className)}>
      {lessons.map((lesson) => (
        <li key={lesson.id} className="flex">
          <LessonCard lesson={lesson} viewer={viewer} className="flex-1" />
        </li>
      ))}
    </ul>
  )
}
