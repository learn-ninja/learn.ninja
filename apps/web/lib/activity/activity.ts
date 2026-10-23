// The profile's activity grid and streaks: calendar-day math in the learner's time zone, the shade
// each day gets, and the streak counts. Pure, so activity.test.ts covers it without a database.
//
// The grid copies GitHub's contribution graph: 53 week columns ending today, Sunday-first, five
// shades. The shade is relative to the person: four equal-width bands between zero and their
// busiest day of the displayed year (after trimming the top 1% of active days, the stand-in for
// GitHub's undisclosed outlier rule). A new record day re-shades the older ones.

/** A calendar day as YYYY-MM-DD. */
export type Day = string

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

/** Midnight UTC of `day`, in ms: the number line the day math runs on. */
export function dayToUtc(day: Day): number {
  const [y, m, d] = day.split("-").map(Number) as [number, number, number]
  return Date.UTC(y, m - 1, d)
}

export function utcToDay(ms: number): Day {
  return new Date(ms).toISOString().slice(0, 10)
}

export const DAY_MS = 864e5

export function addDays(day: Day, n: number): Day {
  return utcToDay(dayToUtc(day) + n * DAY_MS)
}

/** Days from `a` to `b`: 1 when b is the day after a. */
export function dayDiff(a: Day, b: Day): number {
  return Math.round((dayToUtc(b) - dayToUtc(a)) / DAY_MS)
}

/** 0 for Sunday through 6 for Saturday. */
export function weekdayOf(day: Day): number {
  return new Date(dayToUtc(day)).getUTCDay()
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
  const trimmed = active.slice(0, active.length - Math.floor(active.length / 100))
  const cap = trimmed.at(-1) ?? 0
  return {
    cap,
    levelOf: (count) =>
      count <= 0 || cap <= 0
        ? 0
        : (Math.min(4, Math.ceil(count / (cap / 4))) as Level),
  }
}

/**
 * Streaks over `activeDays` (any order, duplicates fine). The current streak is the run that ends
 * today or yesterday, so it survives until the day actually ends. The longest is over every day
 * given, not just the displayed year.
 */
export function streaks(
  activeDays: Day[],
  today: Day
): { current: number; longest: number } {
  const days = [...new Set(activeDays)].sort()
  let longest = 0
  let run = 0
  let current = 0
  for (let i = 0; i < days.length; i++) {
    run = i > 0 && dayDiff(days[i - 1]!, days[i]!) === 1 ? run + 1 : 1
    longest = Math.max(longest, run)
    const gap = dayDiff(days[i]!, today)
    if (gap === 0 || gap === 1) current = run
  }
  return { current, longest }
}

export interface ActivityCell {
  day: Day
  lessons: number
  level: Level
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

/** The grid for `today`, from every day row the person has (older rows only feed the longest streak). */
export function buildGrid(
  rows: { day: Day; lessons: number }[],
  today: Day
): ActivityGridData {
  const yearAgo = addDays(today, -364)
  const start = addDays(yearAgo, -weekdayOf(yearAgo))
  const byDay = new Map(rows.map((r) => [r.day, r.lessons]))
  const inWindow = rows.filter((r) => r.day >= start && r.day <= today)
  const { cap, levelOf } = activityLevels(inWindow.map((r) => r.lessons))
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
        return { day, lessons, level: levelOf(lessons) }
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
    streak: streaks(
      rows.filter((r) => r.lessons > 0).map((r) => r.day),
      today
    ),
  }
}

/** "2 lessons on October 21st", the tooltip and label of one day. */
export function describeDay(cell: ActivityCell): string {
  const [, m, d] = cell.day.split("-").map(Number) as [number, number, number]
  const when = `${MONTH_NAMES[m - 1]} ${ordinal(d)}`
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
