// The lesson's shortcuts (number keys, ?, D, W, H) listen on the window, so they stay out of the way
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

/**
 * Where Enter goes. The lesson's main action (Start, Check, Continue, Try again) takes it
 * almost everywhere, so a click on Sound, the notch, or a menu doesn't leave Enter pressing that
 * control again. Space still presses whatever has focus.
 *
 * - "own": the focused element keeps it: a field, an open menu or dialog, a link, the main button
 *   itself, or a control in the kata that Enter adds with (a waiting order item, a hotspot).
 * - "main": the main action; when it isn't ready yet, the focused control has the key (an answer
 *   option or word chip still toggles, as it always has).
 * - "hold": the main action, and nothing at all while it isn't ready: the control would undo work
 *   (a placed order item, a filled gap), so it opts in with data-enter="main".
 */
export function enterTarget(
  e: KeyboardEvent,
  main: Element | null
): "own" | "main" | "hold" {
  if (shortcutBlocked(e)) return "own"
  const target = e.target as Element | null
  if (!target?.closest) return "main"
  if (target.closest("[data-enter=main]")) return "hold"
  if (target.closest("a[href]")) return "own"
  if (main?.contains(target)) return "own"
  if (target.closest("[data-slot=selectable]")) return "main"
  // The kata's own buttons; the header, the tray's settings, and the footer are chrome, not these.
  // Not a sort row (a radio group): its keys are the arrows and numbers, so Enter checks the answer.
  const control = target.closest("button, [role=button], [role=grid]")
  if (control?.closest("[data-player-content]")) return "own"
  return "main"
}
