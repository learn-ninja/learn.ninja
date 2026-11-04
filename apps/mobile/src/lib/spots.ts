import type { Mark } from "@workspace/player-core/check"

import type { SpotBox } from "../../modules/visual-height"

// How a hotspot's parts are marked over an HTML visual in the app. The web draws the tiles inside
// the frame's document (packages/player/src/spots.ts); the app's frame runs no script, so the
// marks are views laid over the frame at the parts' measured boxes: a translucent tile grown a
// little past the part while it's picked (or every part, while the parts are being shown), and a
// tinted box with a solid edge in the answer's color once checked.

/** How far a tile reaches past its part, as the web's 4px ring. */
export const TILE_RING = 4
/** How far a mark's edge reaches past its part, as the web's 2px edge. */
export const MARK_RING = 2

export interface Overlay {
  id: string
  kind: "tile" | Mark
  top: number
  left: number
  width: number
  height: number
}

/**
 * The overlays to draw: a mark for every checked part, a tile for every picked part without one,
 * and with `reveal` a tile on every part that has neither.
 */
export function overlaysFor(
  spots: SpotBox[],
  {
    selected,
    marks,
    reveal,
  }: { selected: string[]; marks: Record<string, Mark>; reveal: boolean }
): Overlay[] {
  return spots.flatMap((s) => {
    const mark = marks[s.id]
    const kind: Overlay["kind"] | null = mark
      ? mark
      : selected.includes(s.id) || reveal
        ? "tile"
        : null
    if (!kind) return []
    const grow = kind === "tile" ? TILE_RING : MARK_RING
    return [
      {
        id: s.id,
        kind,
        top: s.top - grow,
        left: s.left - grow,
        width: s.width + 2 * grow,
        height: s.height + 2 * grow,
      },
    ]
  })
}
