import * as StoreReview from "expo-store-review"
import { Storage } from "expo-sqlite/kv-store"

// The App Store's rating prompt, at a moment a learner is glad: as they leave the streak screen on
// a milestone day (a week, a month, a hundred days), never during the lantern's moment itself.
// Each milestone asks at most once, and iOS itself shows the prompt at most three times a year and
// never while it's being developed in a way that bothers anyone; it may also show nothing.

export const REVIEW_MILESTONES = [7, 30, 100] as const

const ASKED = "learn:review-asked"

/** Whether a streak of `days` should ask, given the milestones already asked at. */
export function shouldAskForReview(
  days: number,
  asked: readonly number[]
): boolean {
  return (
    (REVIEW_MILESTONES as readonly number[]).includes(days) &&
    !asked.includes(days)
  )
}

function askedSoFar(): number[] {
  try {
    const raw = Storage.getItemSync(ASKED)
    const list: unknown = raw ? JSON.parse(raw) : []
    return Array.isArray(list) ? list.filter((n) => typeof n === "number") : []
  } catch {
    return []
  }
}

/** Asks for a rating if a streak of `days` is a milestone not asked at yet. */
export async function askForReviewAt(days: number): Promise<void> {
  const asked = askedSoFar()
  if (!shouldAskForReview(days, asked)) return
  try {
    if (!(await StoreReview.hasAction())) return
    Storage.setItemSync(ASKED, JSON.stringify([...asked, days]))
    // After the wrap-up has come in, so the prompt doesn't land on the moving screen.
    await new Promise((resolve) => setTimeout(resolve, 800))
    await StoreReview.requestReview()
  } catch {
    // No prompt: nothing to do.
  }
}
