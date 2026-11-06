import type { Item } from "@workspace/player-core/flow"
import type { Visual } from "@workspace/spec"

import {
  frameWidth,
  hotspotWidth,
  optionCardWidths,
  orderItemWidth,
} from "./visual-widths"

// The HTML visuals a screen will draw and the widths they'll be laid out at, so the player can
// measure them while the screen before is read (the web's VisualsAhead): a frame then opens at its
// height, and a hotspot with its parts known, instead of waiting on the native measurement.

export interface VisualAhead {
  html: string
  css?: string
  /** The visual's own height, if it declares one: then only a hotspot's parts need measuring. */
  height?: number
  /** The width it's laid out at, in points. */
  width: number
  /** A hotspot's visual: its tappable parts are measured too. */
  spots: boolean
}

/** Every HTML visual on a screen, with each width it can be laid out at. */
export function visualsAhead(
  item: Item | undefined,
  windowWidth: number
): VisualAhead[] {
  if (item?.kind !== "concept" && item?.kind !== "question") return []
  const out: VisualAhead[] = []
  const add = (visual: Visual | undefined, widths: number[], spots = false) => {
    if (visual?.kind !== "html") return
    // A visual with its own height has nothing to measure, unless its parts are tapped.
    if (visual.height && !spots) return
    for (const width of widths)
      out.push({
        html: visual.html,
        css: visual.css,
        height: visual.height,
        width,
        spots,
      })
  }
  const kata = item.kata
  if (kata.type === "hotspot") {
    add(kata.visual, [hotspotWidth(windowWidth)], true)
    return out
  }
  add(kata.visual, [frameWidth(windowWidth)])
  if (kata.type === "choice" || kata.type === "compare") {
    // Options are cards when any has a visual (options.tsx, hasOptionCards).
    const widths = optionCardWidths(windowWidth, kata.options.length)
    for (const o of kata.options) add(o.visual, widths)
  }
  if (kata.type === "order") {
    for (const it of kata.items) add(it.visual, [orderItemWidth(windowWidth)])
  }
  return out
}
