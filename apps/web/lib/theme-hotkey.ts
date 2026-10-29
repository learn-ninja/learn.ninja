// D flips the site's theme while developing. A lesson page has a D of its own (it shows and hides
// the player's buttons), so the theme leaves the key alone while a lesson player is on the page.

type Key = Pick<
  KeyboardEvent,
  "key" | "repeat" | "metaKey" | "ctrlKey" | "altKey" | "defaultPrevented"
> & { target: EventTarget | null }

function isTypingTarget(target: EventTarget | null) {
  if (typeof HTMLElement === "undefined" || !(target instanceof HTMLElement)) {
    return false
  }

  return (
    target.isContentEditable ||
    target.tagName === "INPUT" ||
    target.tagName === "TEXTAREA" ||
    target.tagName === "SELECT"
  )
}

/** Whether this key press should flip the theme. */
export function flipsTheme(
  event: Key,
  doc: Pick<Document, "querySelector">
): boolean {
  if (event.defaultPrevented || event.repeat) return false
  if (event.metaKey || event.ctrlKey || event.altKey) return false
  if (event.key.toLowerCase() !== "d") return false
  if (isTypingTarget(event.target)) return false
  return doc.querySelector("[data-lesson-player]") === null
}
