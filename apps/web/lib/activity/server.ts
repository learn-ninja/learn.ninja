import { cookies } from "next/headers"

import type { DayStreak } from "@workspace/player"

import { TZ_COOKIE } from "@/components/site/timezone-cookie"
import { activityDays } from "@/lib/explore/queries"
import { getDb } from "@/lib/publish/store"

import { dayStreak, isTimeZone, localDay, streakAfterFinish } from "./activity"

/** The viewer's time zone from the tz cookie (components/site/timezone-cookie.tsx), or UTC. */
export async function viewerTimeZone(): Promise<string> {
  const raw = (await cookies()).get(TZ_COOKIE)?.value
  let tz: string | undefined
  try {
    tz = raw && decodeURIComponent(raw)
  } catch {
    tz = undefined
  }
  return isTimeZone(tz) ? tz : "UTC"
}

/** The learner's active days and their today, in the time zone of the browser they're using. */
async function daysAndToday(userId: string) {
  const [db, tz] = await Promise.all([getDb(), viewerTimeZone()])
  const rows = await activityDays(db, userId)
  return {
    days: rows.filter((r) => r.lessons > 0).map((r) => r.day),
    today: localDay(new Date(), tz),
  }
}

/** The logged-in learner's streak as of their today, for the header's lantern. */
export async function viewerStreak(userId: string): Promise<DayStreak> {
  const { days, today } = await daysAndToday(userId)
  return dayStreak(days, today)
}

/**
 * The streak finishing a lesson will light, for the streak screen before its wrap-up, or null when
 * today already has a lesson. Replays count too, so any lesson lights an empty today.
 */
export async function comingStreak(userId: string): Promise<DayStreak | null> {
  const { days, today } = await daysAndToday(userId)
  return days.includes(today) ? null : streakAfterFinish(days, today)
}
