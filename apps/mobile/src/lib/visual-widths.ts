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
