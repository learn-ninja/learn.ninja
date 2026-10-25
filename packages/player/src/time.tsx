import * as React from "react"

import { stringsFor } from "./strings"

// How long ago a lesson was published. On screen it's the short form feeds use: "33m", "3h",
// "2d" for the first week, then the date ("Oct 14", with the year once it isn't this year's).
// The units are one letter, so "33m" in the byline doesn't read as the lesson's length ("12 min")
// on the meta line. Screen readers get the full words instead: "just now", "5 minutes ago",
// "yesterday". Intl says both in every player language; only "just now" is the player's own
// string, since Intl's "now" reads like a status.

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

/** The short age of `at` at `now`: "just now", "33m", "3h", "2d", "Oct 14", "Oct 14, 2025". */
export function shortTimeAgo(at: number, now: number, lang: string): string {
  const age = now - at
  if (age < MINUTE) return stringsFor(lang).justNow
  const say = (unit: "minute" | "hour" | "day", size: number) =>
    new Intl.NumberFormat(lang, {
      style: "unit",
      unit,
      unitDisplay: "narrow",
    }).format(Math.floor(age / size))
  if (age < HOUR) return say("minute", MINUTE)
  if (age < DAY) return say("hour", HOUR)
  if (age < WEEK) return say("day", DAY)
  const sameYear = new Date(at).getFullYear() === new Date(now).getFullYear()
  return new Intl.DateTimeFormat(lang, {
    month: "short",
    day: "numeric",
    year: sameYear ? undefined : "numeric",
  }).format(at)
}

/** The date, for a tooltip: "20 Oct 2026". The date only: a clock time rendered on the server would be in its time zone, not the reader's. */
export function exactTime(at: number, lang: string): string {
  return new Intl.DateTimeFormat(lang, { dateStyle: "medium" }).format(at)
}

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

/** Time left on a published link. */
export type TimeLeft = { unit: "days" | "hours"; count: number }

/**
 * Time until the link expires: whole days (rounded) from 24 hours up, hours (rounded down, at
 * least 1) below.
 */
export function timeLeft(ms: number): TimeLeft {
  const hours = ms / 3.6e6
  return hours >= 24
    ? { unit: "days", count: Math.round(hours / 24) }
    : { unit: "hours", count: Math.max(1, Math.floor(hours)) }
}
