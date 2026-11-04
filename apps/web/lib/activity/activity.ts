// The profile's activity grid and streaks: calendar-day math in the learner's time zone, the shade
// each day gets, and the streak counts. Pure, so activity.test.ts covers it without a database.
//
// The grid copies GitHub's contribution graph: 53 week columns ending today, Sunday-first, five
// shades. The shade is relative to the person: four equal-width bands between zero and their
// busiest day of the displayed year (after trimming the top 1% of active days, the stand-in for
// GitHub's undisclosed outlier rule). A new record day re-shades the older ones.

import {
  addDays,
  walkStreak,
  weekdayOf,
  type Day,
} from "@workspace/player-core/streak"

// The calendar-day math and the streak rules live in player-core, where the iOS app reads them too.
export {
  addDays,
  DAY_MS,
  dayDiff,
  dayStreak,
  dayToUtc,
  streakAfterFinish,
  streaks,
  utcToDay,
  weekdayOf,
  type Day,
} from "@workspace/player-core/streak"

/** Whether `tz` is an IANA time zone this runtime knows ("Europe/Rome"). */
export function isTimeZone(tz: unknown): tz is string {
  if (typeof tz !== "string" || !tz) return false
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz })
    return true
  } catch {
    return false
  }
}

const formats = new Map<string, Intl.DateTimeFormat>()

/** The calendar day it is at `at` in `tz`. */
export function localDay(at: Date, tz: string): Day {
  let f = formats.get(tz)
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
    formats.set(tz, f)
  }
  const p: Record<string, string> = {}
  for (const part of f.formatToParts(at)) p[part.type] = part.value
  return `${p.year}-${p.month}-${p.day}`
}

export type Level = 0 | 1 | 2 | 3 | 4

/**
 * The shade scale for one person's displayed year. `cap` is their busiest day after trimming the
 * top 1% of active days; a day's level is which quarter of [0, cap] its count falls in, and
 * anything past the cap is level 4. One lesson a day, every day, is level 4: it's their maximum.
 */
export function activityLevels(counts: number[]): {
  cap: number
  levelOf: (count: number) => Level
} {
  const active = counts.filter((c) => c > 0).sort((a, b) => a - b)
  const trimmed = active.slice(
    0,
    active.length - Math.floor(active.length / 100)
  )
  const cap = trimmed.at(-1) ?? 0
  return {
    cap,
    levelOf: (count) =>
      count <= 0 || cap <= 0
        ? 0
        : (Math.min(4, Math.ceil(count / (cap / 4))) as Level),
  }
}

export interface ActivityCell {
  day: Day
  lessons: number
  level: Level
  /** A day without a lesson that a saved rest day kept in the streak, drawn in the lantern's blue. */
  rest: boolean
}

export interface ActivityGridData {
  /** Lessons finished in the displayed year. */
  total: number
  /** 53 columns of 7 days, Sunday first; null after today. */
  columns: (ActivityCell | null)[][]
  /** Month labels and the column each sits above. */
  months: { label: string; column: number }[]
  /** The level scale's cap, for tests and stories. */
  cap: number
  streak: { current: number; longest: number }
}

export const GRID_WEEKS = 53

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
]

/**
 * The grid for `today`, from every day row the person has (older rows only feed the longest
 * streak). Rest days come from the same walk as the streak, so the grid and the lanterns agree.
 */
export function buildGrid(
  rows: { day: Day; lessons: number }[],
  today: Day
): ActivityGridData {
  const yearAgo = addDays(today, -364)
  const start = addDays(yearAgo, -weekdayOf(yearAgo))
  const byDay = new Map(rows.map((r) => [r.day, r.lessons]))
  const inWindow = rows.filter((r) => r.day >= start && r.day <= today)
  const { cap, levelOf } = activityLevels(inWindow.map((r) => r.lessons))
  const { current, longest, states } = walkStreak(
    rows.filter((r) => r.lessons > 0).map((r) => r.day),
    today
  )
  const columns: (ActivityCell | null)[][] = []
  const months: { label: string; column: number }[] = []
  for (let c = 0; c < GRID_WEEKS; c++) {
    const first = addDays(start, 7 * c)
    const month = Number(first.slice(5, 7)) - 1
    const prev = c ? months.at(-1) : undefined
    if (!prev || month !== Number(addDays(start, 7 * (c - 1)).slice(5, 7)) - 1)
      months.push({ label: MONTHS[month]!, column: c })
    columns.push(
      Array.from({ length: 7 }, (_, d) => {
        const day = addDays(first, d)
        if (day > today) return null
        const lessons = byDay.get(day) ?? 0
        return {
          day,
          lessons,
          level: levelOf(lessons),
          rest: states.get(day) === "rest",
        }
      })
    )
  }
  // A label in the first column needs three columns before the next month's label.
  if (months[1] && months[1].column < 3) months.shift()
  return {
    total: inWindow.reduce((n, r) => n + r.lessons, 0),
    columns,
    months,
    cap,
    streak: { current, longest },
  }
}

/** "2 lessons on October 21st" or "Rest day on October 21st", the tooltip and label of one day. */
export function describeDay(cell: ActivityCell): string {
  const [, m, d] = cell.day.split("-").map(Number) as [number, number, number]
  const when = `${MONTH_NAMES[m - 1]} ${ordinal(d)}`
  if (cell.rest) return `Rest day on ${when}`
  if (cell.lessons === 0) return `No lessons on ${when}`
  return `${cell.lessons} ${cell.lessons === 1 ? "lesson" : "lessons"} on ${when}`
}

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
]

function ordinal(n: number): string {
  const rest = n % 100
  if (rest >= 11 && rest <= 13) return `${n}th`
  const last = n % 10
  return `${n}${last === 1 ? "st" : last === 2 ? "nd" : last === 3 ? "rd" : "th"}`
}
