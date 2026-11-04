/**
 * How long a new screen ignores Continue, in ms: as long as a concept takes to arrive (300 ms),
 * and a little more. A quick second tap of Continue (or Start) then lands on nothing, rather than
 * moving past the screen it just opened before it's been seen, with or without motion.
 */
export const SETTLE_MS = 350

/** Whether Continue moves on: the screen has been up for at least SETTLE_MS. */
export function settled(shownAt: number, now: number): boolean {
  return now - shownAt >= SETTLE_MS
}
