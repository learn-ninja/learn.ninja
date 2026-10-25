// The lesson's shortcuts (number keys, ?, D, W) listen on the window, so they stay out of the way
// of anything else that takes keys: a field being typed in, an open menu or dialog, or a widget
// with keys of its own.

const OWN_KEYS =
  "input, textarea, select, [contenteditable=true], [role=dialog], [role=alertdialog], [role=menu], [role=listbox], [role=slider]"

/** True when a lesson shortcut should leave this key press alone. */
export function shortcutBlocked(e: KeyboardEvent): boolean {
  const target = e.target as Element | null
  if (target?.closest?.(OWN_KEYS)) return true
  // A modal is open over the lesson: the key is its, even if focus has slipped back to the page.
  return (
    document.querySelector(
      "[data-slot=dialog-overlay], [data-slot=sheet-overlay]"
    ) !== null
  )
}
