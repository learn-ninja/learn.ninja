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

// The day streak the app shows: at the end of a lesson (the streak screen), on the widget, and in
// the evening reminders, walked with the profile's rules (@workspace/player-core/streak): a rest
// day keeps the streak on a day without a lesson but never adds to it.
//
// Signed in, the streak is the account's, as the profile shows it: the days come from the server
// (GET /api/account/days), kept here so the streak screen knows them offline and before the
// request lands, and each finish adds today until the server has it too. Logged out, the device
// keeps its own days.
//
// Three records:
// - `learn:account-days`: the signed-in account's days, `{ user, days }`, from the server plus the
//   finishes made here since. Present only while signed in (SessionEffects forgets it on sign-out).
// - `learn:days`: every calendar day (on the device's clock) with a lesson finished logged out. The
//   app's own key: the web keeps no streak for a logged-out learner.
// - `learn:finished:{id}`: a published lesson's last finish, `{ at }`, under the web's own key and
//   shape (apps/web/lib/explore/finishes.ts). On the web, signing in sends each to
//   POST /api/lessons/{id}/complete with its time, so it counts on the profile as if they'd been
//   signed in; the app's sign-in does the same (finishes.ts), which carries the streak's recent
//   days over (the server takes finishes up to a week old, as long as a lesson lives).

export const DAYS_KEY = "learn:days"
export const ACCOUNT_DAYS_KEY = "learn:account-days"
export const FINISHED_PREFIX = "learn:finished:"
/**
 * Days a finish made here stays in the account's days though the server hasn't got it yet: as long
 * as the server takes a late finish, which the progress sync sends once it can.
 */
const PENDING_DAYS = 7
/** Days kept: enough for the longest streak a learner could see without an account, and then some. */
const KEEP_DAYS = 800

export interface StreakStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
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

/** Well-formed days, unique, oldest first. */
function cleanDays(saved: unknown): Day[] {
  if (!Array.isArray(saved)) return []
  return [
    ...new Set(
      saved.filter((d): d is Day => typeof d === "string" && DAY.test(d))
    ),
  ].sort()
}

function parse(storage: StreakStorage, key: string): unknown {
  try {
    return JSON.parse(storage.getItem(key) ?? "null") as unknown
  } catch {
    return null
  }
}

/** The signed-in account's days kept on the device, or null when none are (logged out). */
function readAccount(
  storage: StreakStorage
): { user: string; days: Day[] } | null {
  const saved = parse(storage, ACCOUNT_DAYS_KEY) as {
    user?: unknown
    days?: unknown
  } | null
  if (!saved || typeof saved.user !== "string") return null
  return { user: saved.user, days: cleanDays(saved.days) }
}

/**
 * The days the streak is walked from, oldest first: the signed-in account's while it has them,
 * else the device's own. Unreadable storage is none.
 */
export function readDays(storage: StreakStorage): Day[] {
  return readAccount(storage)?.days ?? cleanDays(parse(storage, DAYS_KEY))
}

/**
 * Keeps the account's days from the server (GET /api/account/days) for `user`. Finishes made here
 * in the last week that the server doesn't have yet stay: their requests may still be on the way.
 * Another account's days are dropped.
 */
export function keepAccountDays(
  storage: StreakStorage,
  { user, days, today }: { user: string; days: unknown; today: Day }
) {
  const kept = readAccount(storage)
  const since = addDays(today, -PENDING_DAYS)
  const pending =
    kept?.user === user ? kept.days.filter((d) => d >= since) : []
  const merged = cleanDays([...cleanDays(days), ...pending]).slice(-KEEP_DAYS)
  try {
    storage.setItem(ACCOUNT_DAYS_KEY, JSON.stringify({ user, days: merged }))
  } catch {
    // Not kept; the next sign-in or lesson asks again.
  }
}

/** Signed out: the streak is the device's own again. True when there were account days to forget. */
export function forgetAccountDays(storage: StreakStorage): boolean {
  try {
    if (storage.getItem(ACCOUNT_DAYS_KEY) === null) return false
    storage.removeItem(ACCOUNT_DAYS_KEY)
    return true
  } catch {
    return false
  }
}

/** The streak as of `today`, from the days kept. */
export function currentStreak(storage: StreakStorage, today: Day): DayStreak {
  return dayStreak(readDays(storage), today)
}

/**
 * Keeps a finished lesson: today joins the learning days (the signed-in account's, else the
 * device's), and a published lesson's finish is kept for sign-in under the web's key. Returns the
 * streak after it, lit when this was the day's first finished lesson (a replay, or a second lesson
 * the same day, here or on the web, lights nothing new).
 */
export function recordFinish(
  storage: StreakStorage,
  { today, id, at = Date.now() }: { today: Day; id?: string; at?: number }
): Streak {
  const account = readAccount(storage)
  const days = readDays(storage)
  const lit = streakAfterFinish(days, today)
  const kept = lit ? [...days, today].sort().slice(-KEEP_DAYS) : days
  try {
    if (lit)
      storage.setItem(
        account ? ACCOUNT_DAYS_KEY : DAYS_KEY,
        JSON.stringify(account ? { user: account.user, days: kept } : kept)
      )
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
