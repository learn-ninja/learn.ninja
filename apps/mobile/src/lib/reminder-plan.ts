import type { Day } from "@workspace/player-core/streak"
import type { Strings } from "@workspace/player-core/strings"

import { streakAhead, type DayAhead } from "./streak-ahead"

// Which evenings the streak reminder goes out, and what it says: one notification on each of the
// coming days whose lesson is at stake (a rest day would be spent, or the streak would end), at
// the same local hour, none for a day that already has its lesson. Pure, so it's tested here;
// reminders.ts hands the plan to the system.

/** The local hour the reminder goes out: the evening, with time left for a lesson. */
export const REMINDER_HOUR = 19

export interface PlannedReminder {
  /** When it goes out, on the device's clock. */
  at: Date
  kind: "rest" | "end"
  title: string
  body: string
}

/** `day` at `hour` o'clock on the device's clock. */
export function atHour(day: Day, hour: number): Date {
  const [y, m, d] = day.split("-").map(Number)
  return new Date(y!, m! - 1, d!, hour)
}

/** The reminders for the days ahead of `now`, from the projection (streak-ahead.ts). */
export function remindersFor(
  ahead: DayAhead[],
  now: Date,
  t: Strings,
  hour = REMINDER_HOUR
): PlannedReminder[] {
  return ahead.flatMap((d): PlannedReminder[] => {
    if (d.stake === "none") return []
    const at = atHour(d.day, hour)
    if (at <= now) return []
    return d.stake === "end"
      ? [
          {
            at,
            kind: "end",
            title: t.reminders.endTitle,
            body: t.reminders.endBody,
          },
        ]
      : [
          {
            at,
            kind: "rest",
            title: t.reminders.restTitle,
            body: t.reminders.restBody,
          },
        ]
  })
}

/** The reminders to schedule, from the learning days kept on the device. */
export function planReminders(
  activeDays: Day[],
  today: Day,
  now: Date,
  t: Strings,
  hour = REMINDER_HOUR
): PlannedReminder[] {
  return remindersFor(streakAhead(activeDays, today), now, t, hour)
}
