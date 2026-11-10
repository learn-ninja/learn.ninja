import { keepAccountDays, type StreakStorage } from "./streak"

// The signed-in account's learning days, from GET /api/account/days, kept on the device
// (streak.ts) so the streak screen, the widget, and the reminders show the streak the learner's
// profile shows, days learned on the web included. Asked on sign-in (after the finishes kept while
// logged out have gone) and as each lesson opens, so its streak screen knows what today already has.

/** GET /api/account/days: the status, and the days when it answered them. */
export type GetDays = () => Promise<{ status: number; days?: unknown }>

/**
 * Asks the server for the account's days and keeps them for `user`. Resolves true when they were
 * kept; offline, signed out after all, or a server error keeps what the device had.
 */
export async function refreshAccountDays(
  user: string,
  { storage, get, today }: { storage: StreakStorage; get: GetDays; today: string }
): Promise<boolean> {
  try {
    const { status, days } = await get()
    if (status !== 200 || !Array.isArray(days)) return false
    keepAccountDays(storage, { user, days, today })
    return true
  } catch {
    return false
  }
}
