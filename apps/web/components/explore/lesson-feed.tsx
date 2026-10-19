import { cn } from "@workspace/ui/lib/utils"

import type { LessonSummary } from "@/lib/explore/queries"

import { LessonRow, type Viewer } from "./lesson-row"

/**
 * The feed: one row per lesson between hairlines, newest or best first, read by scrolling.
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
    <ul className={cn("flex flex-col divide-y", className)}>
      {lessons.map((lesson, i) => (
        <li key={lesson.id} className="flex flex-col">
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
