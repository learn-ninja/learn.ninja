// The sort kata's moves and drop geometry (components/katas/sort.tsx), kept apart so they're
// tested without the screen.

export interface Box {
  x: number
  y: number
  width: number
  height: number
}

/** Move an item to the end of a zone, taking it out of whichever zone held it. */
export function moveItem(
  zones: Record<string, string[]>,
  itemId: string,
  toZone: string
): Record<string, string[]> {
  const next = Object.fromEntries(
    Object.entries(zones).map(([z, ids]) => [
      z,
      ids.filter((id) => id !== itemId),
    ])
  )
  next[toZone] = [...(next[toZone] ?? []), itemId]
  return next
}

/** The bin a point (in the kata's own coordinates) is over, or -1. */
export function binAt(bins: (Box | undefined)[], x: number, y: number): number {
  return bins.findIndex(
    (b) =>
      b && x >= b.x && x <= b.x + b.width && y >= b.y && y <= b.y + b.height
  )
}
