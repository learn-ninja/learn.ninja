"use client"

import * as React from "react"

import { savedProgress } from "@workspace/player/progress"
import { stringsFor } from "@workspace/player-core/strings"
import { Tooltip, TooltipTrigger } from "@workspace/ui/components/tooltip"
import { cn } from "@workspace/ui/lib/utils"

const t = stringsFor("en")

/**
 * A lesson's length on its row, or, for a lesson the viewer left midway, the minutes left beside
 * an amber pie filled to the share of katas behind them, with the count on hover or focus.
 * CompletedCheck takes its place once the lesson is finished. The server knows a logged-in
 * viewer's progress (`saved`); this browser's (the player saves it under the lesson's path) is
 * read after hydration and wins, being at least as fresh. Without either the row shows the length.
 */
export function LessonTime({
  minutes,
  progressKey,
  saved = null,
  className,
}: {
  minutes: number
  /** The player's progress key: the lesson's path without the leading slash. */
  progressKey: string
  /** The viewer's progress as their account has it, if they're logged in and left it midway. */
  saved?: { done: number; total: number } | null
  className?: string
}) {
  const [progress, setProgress] = React.useState<{
    done: number
    total: number
  } | null>(saved)
  React.useEffect(() => {
    try {
      const local = savedProgress(localStorage, progressKey)
      if (local) setProgress(local)
    } catch {
      // Storage is blocked: the length stays.
    }
  }, [progressKey])
  if (!progress) return <span className="shrink-0">{t.minutes(minutes)}</span>
  const share = progress.done / progress.total
  const left = Math.max(1, Math.round(minutes * (1 - share)))
  return (
    <TooltipTrigger delay={300}>
      <span
        tabIndex={0}
        className={cn(
          "flex shrink-0 items-center gap-1 rounded-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
          className
        )}
      >
        <svg
          viewBox="0 0 24 24"
          className="size-3.5 text-amber-600 dark:text-amber-500"
          aria-hidden="true"
        >
          <circle
            cx="12"
            cy="12"
            r="8.75"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
          />
          <path d={wedge(share)} fill="currentColor" />
        </svg>
        {left} min left
      </span>
      <Tooltip>
        {progress.done} of {progress.total} katas done
      </Tooltip>
    </TooltipTrigger>
  )
}

/** A wedge of the inner disc from 12 o'clock, clockwise, covering `share` (0 to 1) of it. */
function wedge(share: number): string {
  const r = 5
  if (share <= 0) return ""
  if (share >= 1)
    return `M12 ${12 - r}a${r} ${r} 0 1 1 0 ${2 * r}a${r} ${r} 0 1 1 0 ${-2 * r}Z`
  const angle = share * 2 * Math.PI
  const x = 12 + r * Math.sin(angle)
  const y = 12 - r * Math.cos(angle)
  return `M12 12V${12 - r}A${r} ${r} 0 ${share > 0.5 ? 1 : 0} 1 ${x.toFixed(2)} ${y.toFixed(2)}Z`
}
