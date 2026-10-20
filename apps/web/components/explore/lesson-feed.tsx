import { cn } from "@workspace/ui/lib/utils"

import type { LessonSummary } from "@/lib/explore/queries"

import { LessonRow, type Viewer } from "./lesson-row"

/**
 * The feed: one row per lesson between hairlines, newest or best first, read by scrolling. A hovered
 * row draws its own bordered tile, so the hairlines above and below it hide while it's hovered.
 * `ranked` numbers the rows (the Top tab); `showAuthor={false}` drops the handle (profiles).
 */
export function LessonFeed({
  lessons,
  viewer,
  ranked = false,
  showAuthor = true,
  className,
}: {
  lessons: LessonSummary[]
  viewer?: Viewer
  ranked?: boolean
  showAuthor?: boolean
  className?: string
}) {
  return (
    <ul className={cn("flex flex-col", className)}>
      {lessons.map((lesson, i) => (
        <li
          key={lesson.id}
          className={cn(
            "flex flex-col transition-colors not-first:border-t",
            // The hovered row's tile replaces the line above it and the next row's line below it.
            "has-[[data-slot=row-link]:hover]:border-t-transparent [&:has([data-slot=row-link]:hover)+li]:border-t-transparent"
          )}
        >
          <LessonRow
            lesson={lesson}
            viewer={viewer}
            rank={ranked ? i + 1 : undefined}
            showAuthor={showAuthor}
          />
        </li>
      ))}
    </ul>
  )
}
