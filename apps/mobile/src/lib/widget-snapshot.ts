import type { Day, DayState } from "@workspace/player-core/streak"
import type { Strings } from "@workspace/player-core/strings"

import type { LastLesson } from "./last-lesson"
import { streakAhead } from "./streak-ahead"

// What the home screen and lock screen widget shows, worked out by the app and written to the App
// Group for the widget's Swift to read (targets/widget). The widget runs no JavaScript and knows
// none of the streak rules, so the app writes a week of days ahead (streak-ahead.ts: as if no more
// lessons were finished) and the widget's timeline steps to the next one at each midnight. It stays
// right for a week without the app opening; a finish, a launch or a new language writes it again.

/** The App Group the app and the widget share (app.config.ts and targets/widget). */
export const APP_GROUP = "group.ninja.learn.ios"
/** The key the snapshot is written under in the App Group's defaults. */
export const SNAPSHOT_KEY = "widget"

export interface WidgetDay {
  /** YYYY-MM-DD on the device's clock: the widget shows it from that midnight. */
  day: Day
  /** The streak as that day starts; 0 once it has ended. */
  current: number
  /** Whether that day's lesson is done (only ever today). */
  lit: boolean
  /** The seven days ending that day, oldest first: lit, rest, missed, or open (that day, no lesson yet). */
  week: DayState[]
  /** The count's line under it: "day streak" in the app's language, or "No streak yet". */
  label: string
}

export interface WidgetSnapshot {
  v: 1
  days: WidgetDay[]
  /** The lesson last left unfinished: medium's Continue, opened at learnninja://l/{slugId}. */
  last: { title: string; url: string } | null
  strings: {
    /** Over the lesson's title on medium. */
    continue: string
    /** Medium's line when nothing is left unfinished. */
    explore: string
    /** The widget gallery's name and description. */
    name: string
  }
}

/** The snapshot for the learning days kept on the device, as of `today`. */
export function widgetSnapshot(
  activeDays: Day[],
  today: Day,
  last: LastLesson | null,
  t: Strings
): WidgetSnapshot {
  return {
    v: 1,
    days: streakAhead(activeDays, today).map((d) => ({
      day: d.day,
      current: d.current,
      lit: d.lit,
      week: d.week.map((w) => w.state),
      label: d.current > 0 ? t.streakUnit(d.current) : t.profile.noStreak,
    })),
    last: last
      ? {
          title: last.title,
          url: `learnninja://${last.href.replace(/^\//, "")}`,
        }
      : null,
    strings: {
      continue: t.continue,
      explore: t.feed.title,
      name: "learn.ninja",
    },
  }
}
