import { useEffect, useState } from "react"
import { useWindowDimensions } from "react-native"

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

const known = new Map<string, Promise<number | null>>()

/** The document's height at `width`, capped; measured once per width and document. */
export function measureOnce(
  doc: string,
  baseUrl: string,
  width: number
): Promise<number | null> {
  const key = `${width}:${doc}`
  let height = known.get(key)
  if (!height) {
    height = measureVisual(doc, baseUrl, width).then((h) =>
      h ? Math.min(MAX_VISUAL_HEIGHT, Math.ceil(h)) : null
    )
    known.set(key, height)
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
  const width = frameWidth(windowWidth)
  void measureOnce(doc, baseUrl, width).then((height) => {
    if (height) settled.set(`${width}:${doc}`, height)
  })
}

/** A height measured before, without waiting. */
const settled = new Map<string, number>()

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
  const key = `${width}:${doc}`
  const [measured, setMeasured] = useState<{
    key: string
    height: number | null
  }>(() => ({ key, height: settled.get(key) ?? null }))
  useEffect(() => {
    if (declared) return
    let live = true
    void measureOnce(doc, baseUrl, width).then((height) => {
      if (height) settled.set(key, height)
      if (live) setMeasured({ key, height: height ?? DEFAULT_VISUAL_HEIGHT })
    })
    return () => {
      live = false
    }
  }, [declared, doc, baseUrl, width, key])
  if (declared) return declared
  return measured.key === key ? measured.height : (settled.get(key) ?? null)
}
