// The day streak's rules, shared by the server that keeps a signed-in learner's streak
// (apps/web/lib/activity) and by the iOS app, which keeps one on the device until it signs in:
// the calendar-day math, the walk from the first day with a lesson to today, and the streak the
// lanterns show. Pure, so both sides' tests cover it.
//
// A new streak starts with one rest day, every second learning day saves another, up to two, and
// a day without a lesson spends one: it keeps the streak without adding to it. With none saved,
// the streak ends. While both are saved, learning days don't count toward a third.

/** Learning days that recharge one rest day, in a row or not, as long as the streak holds. */
export const LEARN_PER_REST = 2
/** The most rest days a learner can have saved. */
export const MAX_REST = 2
/** Rest days a new streak starts with, so missing day 2 doesn't end it. The info copy says "one". */
export const START_REST = 1

/** A calendar day as YYYY-MM-DD. */
export type Day = string

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

/** How a day stands in the streak: learned, kept by a rest day, missed, or today and still open. */
export type DayState = "lit" | "rest" | "missed" | "open"

/** One calendar day ("2026-10-26") and how it stands. */
export interface StreakDay {
  day: string
  state: DayState
}

/** The learner's streak, as of today. */
export interface DayStreak {
  /** Learning days in the run (rest days keep it going without adding to it). */
  current: number
  /** The longest run ever, `current` included. */
  longest: number
  /** Rest days saved, for days without a lesson. */
  rest: number
  /** Learning days toward the next rest day, below LEARN_PER_REST; 0 while MAX_REST are saved. */
  toward: number
  /** Whether today's lesson recharged a rest day. */
  recharged: boolean
  /** The last seven days, oldest first, ending today. */
  days: StreakDay[]
}

/**
 * The streak rules, walked day by day from the first day with a lesson to today. A run starts with
 * START_REST rest days saved. Each day with a finished lesson adds one to the run, and every
 * LEARN_PER_REST of them saves a rest day (MAX_REST
 * at most; while that many are saved, learning days don't count toward the next, so spending one
 * starts its bar from empty). A day without one spends a saved rest day, which keeps the run
 * without adding to it; with none saved, the run ends, and so do the saved days. Today stays open
 * until it's over.
 */
export function walkStreak(activeDays: Day[], today: Day) {
  const active = new Set(activeDays.filter((d) => d <= today))
  const states = new Map<Day, DayState>()
  let run = 0
  let longest = 0
  let rest = 0
  let toward = 0
  let recharged = false
  const first = [...active].sort()[0]
  for (let day = first; day && day <= today; day = addDays(day, 1)) {
    if (active.has(day)) {
      if (run === 0) rest = START_REST
      run++
      longest = Math.max(longest, run)
      if (rest < MAX_REST && ++toward === LEARN_PER_REST) {
        toward = 0
        rest++
        recharged = day === today
      }
      states.set(day, "lit")
    } else if (day === today) {
      states.set(day, "open")
    } else if (run > 0 && rest > 0) {
      rest--
      states.set(day, "rest")
    } else {
      run = 0
      rest = 0
      toward = 0
      states.set(day, "missed")
    }
  }
  return { current: run, longest, rest, toward, recharged, states }
}

/**
 * Streaks over `activeDays` (any order, duplicates fine), by the rules in walkStreak: the current run,
 * alive through today while today is open, and the longest run over every day given, not just the
 * displayed year.
 */
export function streaks(
  activeDays: Day[],
  today: Day
): { current: number; longest: number } {
  const { current, longest } = walkStreak(activeDays, today)
  return { current, longest }
}

/**
 * The streak the header and the streak screen show: the counts, the rest days saved and the
 * learning days toward the next, and the last seven days.
 */
export function dayStreak(activeDays: Day[], today: Day): DayStreak {
  const { current, longest, rest, toward, recharged, states } = walkStreak(
    activeDays,
    today
  )
  return {
    current,
    longest,
    rest,
    toward,
    recharged,
    days: Array.from({ length: 7 }, (_, i) => {
      const day = addDays(today, i - 6)
      return {
        day,
        state: states.get(day) ?? (day === today ? "open" : "missed"),
      }
    }),
  }
}

/**
 * The streak a lesson finished today would show on the streak screen, or null when finishing it
 * won't light today's lantern because today already has a lesson.
 */
export function streakAfterFinish(
  activeDays: Day[],
  today: Day
): DayStreak | null {
  if (activeDays.includes(today)) return null
  return dayStreak([...activeDays, today], today)
}

/** The rest days as they stood before today's lesson, for the moment before its lantern lights. */
export function restBeforeToday(streak: DayStreak): DayStreak {
  // Today started the streak: there were none until its lesson.
  if (streak.current === 1)
    return { ...streak, rest: 0, toward: 0, recharged: false }
  if (streak.recharged)
    return {
      ...streak,
      rest: streak.rest - 1,
      toward: LEARN_PER_REST - 1,
      recharged: false,
    }
  if (streak.toward > 0) return { ...streak, toward: streak.toward - 1 }
  return streak
}
