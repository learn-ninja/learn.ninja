import {
  addDays,
  dayStreak,
  weekdayOf,
  streakAfterFinish,
  type Day,
  type DayState,
  type DayStreak,
  type StreakDay,
} from "@workspace/player-core/streak"

// The day streak on the device. On the web a signed-in learner's streak is kept by the server
// from the days they finished a lesson; the app has no sign-in until phase 4, so it keeps those
// days itself and walks them with the same rules (@workspace/player-core/streak): a rest day keeps
// the streak on a day without a lesson but never adds to it.
//
// Two records, for two jobs:
// - `learn:days`: every calendar day (on the device's clock) with a finished lesson, which the
//   streak is walked from. The app's own key: the web keeps no streak for a logged-out learner.
// - `learn:finished:{id}`: a published lesson's last finish, `{ at }`, under the web's own key and
//   shape (apps/web/lib/explore/finishes.ts). On the web, signing in sends each to
//   POST /api/lessons/{id}/complete with its time, so it counts on the profile as if they'd been
//   signed in; phase 4's sign-in does the same from here, which carries the streak's recent days
//   over (the server takes finishes up to a week old, as long as a lesson lives).

export const DAYS_KEY = "learn:days"
export const FINISHED_PREFIX = "learn:finished:"
/** Days kept: enough for the longest streak a learner could see without an account, and then some. */
const KEEP_DAYS = 800

export interface StreakStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

/** The streak as the wrap-up shows it: today's, and whether this finish lit today's lantern. */
export interface Streak {
  streak: DayStreak
  /** The day's first finished lesson: the streak screen comes first and the lantern lights. */
  lit: boolean
}

/** The calendar day it is on the device's clock, as YYYY-MM-DD (the learner's own day). */
export function localDay(at: Date = new Date()): Day {
  const two = (n: number) => String(n).padStart(2, "0")
  return `${at.getFullYear()}-${two(at.getMonth() + 1)}-${two(at.getDate())}`
}

const DAY = /^\d{4}-\d{2}-\d{2}$/

/** The days with a finished lesson, oldest first. Unreadable storage is none. */
export function readDays(storage: StreakStorage): Day[] {
  try {
    const saved = JSON.parse(storage.getItem(DAYS_KEY) ?? "[]") as unknown
    if (!Array.isArray(saved)) return []
    return [
      ...new Set(
        saved.filter((d): d is Day => typeof d === "string" && DAY.test(d))
      ),
    ].sort()
  } catch {
    return []
  }
}

/** The streak as of `today`, from the days kept. */
export function currentStreak(storage: StreakStorage, today: Day): DayStreak {
  return dayStreak(readDays(storage), today)
}

/**
 * Keeps a finished lesson: today joins the learning days, and a published lesson's finish is kept
 * for sign-in under the web's key. Returns the streak after it, lit when this was the day's first
 * finished lesson (a replay, or a second lesson the same day, lights nothing new).
 */
export function recordFinish(
  storage: StreakStorage,
  { today, id, at = Date.now() }: { today: Day; id?: string; at?: number }
): Streak {
  const days = readDays(storage)
  const lit = streakAfterFinish(days, today)
  const kept = lit ? [...days, today].sort().slice(-KEEP_DAYS) : days
  try {
    if (lit) storage.setItem(DAYS_KEY, JSON.stringify(kept))
    if (id) storage.setItem(FINISHED_PREFIX + id, JSON.stringify({ at }))
  } catch {
    // Not kept (full or blocked); the lesson was still finished.
  }
  return { streak: lit ?? dayStreak(kept, today), lit: Boolean(lit) }
}

/**
 * This calendar week, from the weekday its region starts on (`firstDay`, 0 for Sunday) to the
 * same weekday next week: the days so far from `days` (the last seven, ending today), then the
 * days still to come.
 */
export function weekOf(
  days: StreakDay[],
  firstDay: number
): { day: Day; state: DayState | "ahead" }[] {
  const today = days.at(-1)?.day
  if (!today) return []
  const sinceStart = (weekdayOf(today) - firstDay + 7) % 7
  return [
    ...days.slice(days.length - 1 - sinceStart),
    ...Array.from({ length: 6 - sinceStart }, (_, i) => ({
      day: addDays(today, i + 1),
      state: "ahead" as const,
    })),
  ]
}
