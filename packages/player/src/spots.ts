import type { Mark } from "@workspace/player-core/check"

// How a hotspot's parts look, drawn inside the visual's frame: the tile has to sit behind a part's
// own ink, which the buttons laid over the frame can't do. Those take the taps (see HtmlFrame); the
// player then marks the parts in the frame's document, as it marks the theme.

/**
 * A part in use gets a tile and the rest dims, and a checked part takes the answer's color with a
 * solid edge. The shadows take no room, so nothing moves, and an inset shadow tints a filled part
 * without replacing its background. Inner SVG shapes draw no
 * shadow, so there the dimming alone picks out the part. The green and yellow are green-600 and
 * yellow-500: the frame only compiles the classes a lesson's own HTML uses.
 */
export const SPOT_CSS = `html{--spot-tile:color-mix(in oklab,var(--foreground) 14%,transparent);--spot-correct:oklch(.627 .194 149.214);--spot-wrong:oklch(.795 .184 86.047)}html.dark{--spot-tile:color-mix(in oklab,var(--foreground) 26%,transparent)}@media (prefers-reduced-motion:no-preference){body *{transition:opacity 150ms ease-out,box-shadow 150ms ease-out}}[data-spot-dim]{opacity:.5}:where([data-spot],[data-spot-hint]){border-radius:.375rem}[data-spot=on],[data-spot-hint]{box-shadow:inset 0 0 0 100vmax var(--spot-tile),0 0 0 4px var(--spot-tile)}[data-spot=correct]{box-shadow:inset 0 0 0 100vmax color-mix(in oklab,var(--spot-correct) 30%,transparent),0 0 0 2px var(--spot-correct)}[data-spot=wrong],[data-spot=partial]{box-shadow:inset 0 0 0 100vmax color-mix(in oklab,var(--spot-wrong) 30%,transparent),0 0 0 2px var(--spot-wrong)}`

const MARKS = ["data-spot", "data-spot-dim", "data-spot-hint"]

/**
 * Marks the parts in use, and dims everything but them and what's around them. Opacity on an
 * ancestor would dim the part too, so the dimming runs along each ancestor's other children. With
 * no part in use, `hint` lays the tile on every part, to show what can be tapped.
 */
export function markSpots(
  doc: Document,
  { lit, hint }: { lit: Map<string, "on" | Mark>; hint: boolean }
) {
  for (const el of doc.querySelectorAll(MARKS.map((m) => `[${m}]`).join()))
    MARKS.forEach((m) => el.removeAttribute(m))
  const parts = [...doc.querySelectorAll<HTMLElement>("[data-hotspot]")]
  const inUse = parts.filter((el) => lit.has(el.dataset.hotspot!))
  if (inUse.length === 0) {
    if (hint) parts.forEach((el) => el.setAttribute("data-spot-hint", ""))
    return
  }
  const kept = new Set<Element>()
  for (const part of inUse) {
    part.setAttribute("data-spot", lit.get(part.dataset.hotspot!)!)
    for (
      let node: Element | null = part;
      node && node !== doc.body;
      node = node.parentElement
    )
      kept.add(node)
  }
  for (const node of kept)
    for (const sibling of node.parentElement?.children ?? [])
      if (!kept.has(sibling)) sibling.setAttribute("data-spot-dim", "")
}
