"use client"

import { CircleCheckIcon } from "lucide-react"

import { Tooltip, TooltipTrigger } from "@workspace/ui/components/tooltip"
import { cn } from "@workspace/ui/lib/utils"

const when = new Intl.DateTimeFormat("en", {
  dateStyle: "medium",
  timeStyle: "short",
})

/**
 * A solid green check for a lesson the viewer has finished, with when they first finished it on
 * hover or focus. The time is formatted only when the tooltip opens, in the browser, so it's in the
 * viewer's own time zone and the server's render never disagrees with it.
 */
export function CompletedCheck({
  at,
  className,
}: {
  /** When the viewer first finished the lesson, in ms since epoch. */
  at: number
  className?: string
}) {
  return (
    <TooltipTrigger delay={300}>
      <span
        role="img"
        aria-label="Completed"
        tabIndex={0}
        className={cn(
          "flex shrink-0 rounded-full outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
          className
        )}
      >
        <CircleCheckIcon
          className="size-4 fill-green-600 text-background"
          aria-hidden="true"
        />
      </span>
      <Tooltip>Completed {when.format(at)}</Tooltip>
    </TooltipTrigger>
  )
}
