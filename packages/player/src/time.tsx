import * as React from "react"

import { stringsFor } from "./strings"

// How long ago a lesson was published, as people say it: "just now", "5 minutes ago", "yesterday",
// "2 weeks ago", "last year". Full words, never "5m", so it can't be read as a lesson's length
// ("12 min") on the same row. Intl.RelativeTimeFormat says it in every player language; only
// "just now" is the player's own string, since Intl's "now" reads like a status.

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR
const WEEK = 7 * DAY
const MONTH = 30 * DAY
const YEAR = 365 * DAY

/** The age of `at` at `now`, in the language's words. A time in the future reads as just now. */
export function timeAgo(at: number, now: number, lang: string): string {
  const age = now - at
  if (age < MINUTE) return stringsFor(lang).justNow
  const rtf = new Intl.RelativeTimeFormat(lang, { numeric: "auto" })
  const say = (unit: Intl.RelativeTimeFormatUnit, size: number) =>
    rtf.format(-Math.floor(age / size), unit)
  if (age < HOUR) return say("minute", MINUTE)
  if (age < DAY) return say("hour", HOUR)
  if (age < WEEK) return say("day", DAY)
  if (age < MONTH) return say("week", WEEK)
  if (age < YEAR) return say("month", MONTH)
  return say("year", YEAR)
}

/** The exact moment, for a tooltip: "20 Oct 2026, 11:17". */
export function exactTime(at: number, lang: string): string {
  return new Intl.DateTimeFormat(lang, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(at)
}

/**
 * "5 minutes ago" as a <time>, with the exact moment on hover. The age is taken at render, so
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
      {timeAgo(at, now, lang)}
    </time>
  )
}
