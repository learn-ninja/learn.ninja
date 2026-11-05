import * as React from "react"

import { exactTime, shortTimeAgo, timeAgo } from "@workspace/player-core/time"

// The age of a published lesson as a <time>. The words come from player-core/time.ts, which the
// iOS app shares.

export {
  exactTime,
  shortTimeAgo,
  timeAgo,
  timeLeft,
  type TimeLeft,
} from "@workspace/player-core/time"

/**
 * "33m" as a <time>, with the date on hover and "33 minutes ago" for screen readers. The age is taken at render, so
 * the server's and the browser's can differ by a few seconds; the warning is suppressed since
 * that only matters right at a boundary, and the browser's text wins on the next render.
 */
export function TimeAgo({
  at,
  now = Date.now(),
  lang,
  className,
}: {
  at: number
  /** The clock to measure from; defaults to the moment of rendering. */
  now?: number
  lang: string
  className?: string
}) {
  return (
    <time
      dateTime={new Date(at).toISOString()}
      title={exactTime(at, lang)}
      className={className}
      suppressHydrationWarning
    >
      <span aria-hidden="true">{shortTimeAgo(at, now, lang)}</span>
      <span className="sr-only">{timeAgo(at, now, lang)}</span>
    </time>
  )
}

