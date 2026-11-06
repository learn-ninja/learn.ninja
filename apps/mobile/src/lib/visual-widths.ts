// How wide a lesson's visuals are laid out on a phone, from the window's width: the lesson column
// and the places a visual sits inside it. Kept apart from React Native so it's tested in Node; the
// numbers follow the classes in the screens that draw them (noted at each).

/** The lesson column's widest, the web's max-w-2xl. */
const COLUMN = 672
/** The window's padding each side (the scroll view's px-4). */
const GUTTER = 16
/** A border, 1 point. */
const BORDER = 1

/** The lesson column's width in a window this wide. */
export function columnWidth(windowWidth: number): number {
  return Math.min(windowWidth - 2 * GUTTER, COLUMN)
}

/** A visual in its own window (a concept's, a question's): the column, inside the window's border. */
export function frameWidth(windowWidth: number): number {
  return columnWidth(windowWidth) - 2 * BORDER
}

/** A hotspot's visual: on a filled stage with no border or side padding, the column's full width. */
export function hotspotWidth(windowWidth: number): number {
  return columnWidth(windowWidth)
}

/** The gap between an order kata's pool cards (gap-2). */
const ORDER_GAP = 8
/** An order item's padding (p-2) and border, each side. */
const ORDER_INSET = 8 + BORDER

/**
 * An order kata's visual item, in the pool and in its slot alike: half the column (two cards a row,
 * gap-2), inside the card's padding and border. One width wherever it sits, so a visual is the same
 * height in the pool and placed (order.tsx).
 */
export function orderItemWidth(windowWidth: number): number {
  return (
    Math.floor((columnWidth(windowWidth) - ORDER_GAP) / 2) - 2 * ORDER_INSET
  )
}

/** The gap between option cards (gap-3). */
const CARD_GAP = 12
/**
 * An option card's visual panel, each side: the panel's -m-px lays it over the card's border, and
 * inside it are its own border and its padding (px-1).
 */
const PANEL_INSET = BORDER + 4

/**
 * The widths an option card's visual can be laid out at (options.tsx). A pair stacks, full width;
 * three or more sit two a row (w-[48%] grow, gap-3), and with an odd count the last card grows to
 * the full row, which could be any option once they're shuffled.
 */
export function optionCardWidths(windowWidth: number, count: number): number[] {
  const column = columnWidth(windowWidth)
  const full = column - 2 * PANEL_INSET
  if (count < 3) return [full]
  const half = Math.round((column - CARD_GAP) / 2) - 2 * PANEL_INSET
  return count % 2 ? [half, full] : [half]
}
