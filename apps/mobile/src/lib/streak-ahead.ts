import {
  addDays,
  dayStreak,
  type Day,
  type StreakDay,
} from "@workspace/player-core/streak"

// The streak for today and the days after it, as it will stand if the learner finishes no more
// lessons: what the evening reminder (reminders.ts) and the home screen widget need to know days
// ahead, since neither runs the app on those days. Walked with the same rules as the streak screen
// (player-core's dayStreak), so it never disagrees with what the app shows.

/** What missing a day's lesson would cost: nothing, a saved rest day, or the streak itself. */
export type Stake = "none" | "rest" | "end"

export interface DayAhead {
  day: Day
  /** The run as that day starts (rest days keep it without adding to it); 0 once it has ended. */
  current: number
  /** Rest days saved going into that day. */
  rest: number
  /** Whether the day already has a finished lesson (only ever today). */
  lit: boolean
  /** What letting the day pass without a lesson would cost. */
  stake: Stake
  /** The seven days ending that day, oldest first, as the streak screen shows them. */
  week: StreakDay[]
}

/** How many days ahead are worked out: today and the week after it. */
export const DAYS_AHEAD = 8

/** Today and the next `count - 1` days, if no more lessons are finished. */
export function streakAhead(
  activeDays: Day[],
  today: Day,
  count = DAYS_AHEAD
): DayAhead[] {
  return Array.from({ length: count }, (_, i) => {
    const day = addDays(today, i)
    const streak = dayStreak(activeDays, day)
    const lit = activeDays.includes(day)
    const stake: Stake =
      lit || streak.current === 0 ? "none" : streak.rest > 0 ? "rest" : "end"
    return {
      day,
      current: streak.current,
      rest: streak.rest,
      lit,
      stake,
      week: streak.days,
    }
  })
}
