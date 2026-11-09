import { useEffect, useRef, useState } from "react"

import { deviceStorage } from "./progress-storage"
import { rescheduleReminders } from "./reminders"
import { localDay, recordFinish, type Streak } from "./streak"

/**
 * The finish, kept once per run as the wrap-up arrives (a restart's finish is a new one), and the
 * streak it left. `id` is a published lesson's, kept for sign-in; a bundled lesson has none. While
 * the streak screen is up (the day's first finish), `streakScreen` is true until `leaveStreak`.
 */
export function useStreak({
  atWrap,
  run,
  id,
}: {
  atWrap: boolean
  run: number
  id?: string
}) {
  const [streak, setStreak] = useState<Streak | null>(null)
  const [seen, setSeen] = useState(false)
  // Kept per run, so an effect run twice (React's development check) doesn't record it again and
  // lose the lighting.
  const kept = useRef<{ run: number; streak: Streak } | null>(null)
  useEffect(() => {
    if (!atWrap) {
      setStreak(null)
      setSeen(false)
      return
    }
    if (kept.current?.run !== run) {
      kept.current = {
        run,
        streak: recordFinish(deviceStorage, { today: localDay(), id }),
      }
      // Today's lesson is done: tonight's reminder goes, and the coming days' move on.
      if (kept.current.streak.lit) void rescheduleReminders()
    }
    setStreak(kept.current.streak)
  }, [atWrap, run, id])
  return {
    streak,
    streakScreen: Boolean(atWrap && streak?.lit && !seen),
    leaveStreak: () => setSeen(true),
  }
}
