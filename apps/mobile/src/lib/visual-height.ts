import { useEffect, useMemo, useState } from "react"
import { useWindowDimensions } from "react-native"

import { hash } from "@workspace/player-core/prepared"

import { measureVisual } from "../../modules/visual-height"

// How tall an HTML visual without a height of its own is drawn: the height of its document laid
// out at the frame's width, measured natively with scripts off (modules/visual-height), as the web
// measures its frame. Heights are kept by width and document, so a visual seen before, or measured
// ahead of its screen (measureAhead), opens at its height instead of jumping.

/** The tallest an HTML visual's frame grows, as on the web (visuals.tsx). */
export const MAX_VISUAL_HEIGHT = 2400
/** The frame's height while it's measured, or when it can't be (Android, a failed load). */
export const DEFAULT_VISUAL_HEIGHT = 240

/** The lesson column's widest, the web's max-w-2xl. */
const COLUMN = 672
/** The window's padding each side (px-4), and the frame's border (1 point each side). */
const GUTTER = 16
const BORDER = 1

/** The width a visual's document is laid out at: the lesson column, inside the frame's border. */
export function frameWidth(windowWidth: number): number {
  return Math.min(windowWidth - 2 * GUTTER, COLUMN) - 2 * BORDER
}

/**
 * A document at a width, as a short key: a document inlines the visuals' whole stylesheet, so it's
 * hashed (with its length, against collisions) rather than kept as the key itself.
 */
const keyFor = (width: number, doc: string) =>
  `${width}:${doc.length}:${hash(doc)}`

/** How many heights are kept; the oldest go first. */
const KEEP = 200

function remember<T>(map: Map<string, T>, key: string, value: T) {
  map.delete(key)
  map.set(key, value)
  if (map.size > KEEP) map.delete(map.keys().next().value!)
}

/** Measurements by keyFor(), in flight or done. */
const known = new Map<string, Promise<number | null>>()
/** Heights already measured, by keyFor(), so a frame can open at its height without waiting. */
const settled = new Map<string, number>()

/** The document's height at `width`, capped; measured once per width and document. */
function measureOnce(
  doc: string,
  baseUrl: string,
  width: number,
  key = keyFor(width, doc)
): Promise<number | null> {
  let height = known.get(key)
  if (!height) {
    height = measureVisual(doc, baseUrl, width).then((h) => {
      const capped = h ? Math.min(MAX_VISUAL_HEIGHT, Math.ceil(h)) : null
      if (capped) remember(settled, key, capped)
      return capped
    })
    remember(known, key, height)
    // A failed measurement isn't kept: the next showing tries again.
    void height.then((h) => {
      if (h === null && known.get(key) === height) known.delete(key)
    })
  }
  return height
}

/**
 * Measures an HTML visual's document before its screen opens (the web's VisualsAhead), so the frame
 * opens at its height.
 */
export function measureAhead(
  doc: string,
  baseUrl: string,
  windowWidth: number
) {
  void measureOnce(doc, baseUrl, frameWidth(windowWidth))
}

/**
 * The frame's height for a document: its own when it declares one, else the measured height (null
 * until it's known). Measured at the frame's width for this window.
 */
export function useVisualHeight(
  doc: string,
  baseUrl: string,
  declared?: number
): number | null {
  const { width: windowWidth } = useWindowDimensions()
  const width = frameWidth(windowWidth)
  const key = useMemo(() => keyFor(width, doc), [width, doc])
  const [measured, setMeasured] = useState<{
    key: string
    height: number | null
  }>(() => ({ key, height: settled.get(key) ?? null }))
  useEffect(() => {
    if (declared) return
    let live = true
    void measureOnce(doc, baseUrl, width, key).then((height) => {
      if (live) setMeasured({ key, height: height ?? DEFAULT_VISUAL_HEIGHT })
    })
    return () => {
      live = false
    }
  }, [declared, doc, baseUrl, width, key])
  if (declared) return declared
  return measured.key === key ? measured.height : (settled.get(key) ?? null)
}
