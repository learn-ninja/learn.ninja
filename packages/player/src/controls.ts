// The one recipe for the controls inside a kata (options, chips, sort and order items, placed words),
// so every kata's controls share a shape and a height. See "Control sizes" in the learn-ui-guidelines skill.

/** A control's look without its states: for pictures of a control that take no pointer themselves. */
export const controlSurface =
  "rounded-md border bg-background shadow-xs dark:bg-input/30"

/** A control on a card: hover and selected states on top of the surface, with no fade so they follow the pointer at once. */
export const controlStyles =
  controlSurface +
  " hover:bg-muted data-selected:border-primary data-selected:bg-muted dark:hover:bg-input/50 dark:data-selected:bg-muted"

/**
 * A one-line control's padding and text. Its height is this padding plus one line of `text-sm`, never a
 * fixed `min-h-*`, so it grows with the learner's text size setting.
 */
export const controlPadding = "px-3 py-2.5 text-sm font-medium"

/**
 * An empty place a control can go: an open order slot, an empty sort lane, a used word's ghost. Give it
 * the control's padding and one line of text (an aria-hidden zero-width space) so it's as tall as a
 * filled one at every text size.
 */
export const slotStyles =
  "rounded-md border border-dashed border-foreground/20 bg-muted/60 dark:bg-input/10"

// A mark outranks the selected and hover colors (hence the `!`), so the result shows on the picked control too.
export const markStyles =
  "data-[status=correct]:border-green-600! data-[status=correct]:bg-green-600/10! " +
  "data-[status=wrong]:border-yellow-500! data-[status=wrong]:bg-yellow-500/10! " +
  "data-[status=partial]:border-amber-500! data-[status=partial]:bg-amber-500/10!"

/**
 * The least a visual's own window is tall (288px). A two-line chat or a small formula would otherwise be
 * a thin strip between the prompt and the answers; shorter content sits in the middle of the window.
 * Not for a `plain` visual, which sits on a surface that already sizes it (an option card's panel).
 */
export const visualWindow = "min-h-72"

/** The number key on an option, chip, or sort lane: hidden on touch screens, which have no keys to press. */
export const keyHintStyles = "pointer-coarse:hidden"
