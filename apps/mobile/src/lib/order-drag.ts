// The order kata's drag geometry (components/katas/order.tsx), kept apart so it's tested without
// the screen.

/** The slot a placed item lands in when dragged `dy` points from slot `from`, by the slots' heights. */
export function slotAfterDrag(
  heights: number[],
  from: number,
  dy: number,
  gap: number
): number {
  let to = from
  let left = dy
  while (left > 0 && to < heights.length - 1) {
    const step = (heights[to + 1] ?? 0) + gap
    if (left < step / 2) break
    left -= step
    to++
  }
  while (left < 0 && to > 0) {
    const step = (heights[to - 1] ?? 0) + gap
    if (-left < step / 2) break
    left += step
    to--
  }
  return to
}

/** The slots with the item at `from` moved to `to`, the others keeping their order. */
export function moveSlot<T>(slots: T[], from: number, to: number): T[] {
  const next = [...slots]
  const [item] = next.splice(from, 1)
  next.splice(to, 0, item!)
  return next
}
