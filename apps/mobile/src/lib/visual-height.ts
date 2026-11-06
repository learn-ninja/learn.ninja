import { useEffect, useMemo, useState } from "react"

import { hash } from "@workspace/player-core/prepared"

import {
  measureVisual,
  measureVisualSpots,
  type MeasuredSpots,
} from "../../modules/visual-height"

// How tall an HTML visual without a height of its own is drawn: the height of its document laid
// out at the frame's width, measured natively with scripts off (modules/visual-height), as the web
// measures its frame. Heights (and a hotspot's parts) are kept by width and document, so a visual
// seen before, or measured ahead of its screen (measureAhead), opens at its height instead of
// jumping. The widths come from visual-widths.ts, or from the frame's own layout.

/** The tallest an HTML visual's frame grows, as on the web (visuals.tsx). */
export const MAX_VISUAL_HEIGHT = 2400
/** The frame's height while it's measured, or when it can't be (Android, a failed load). */
export const DEFAULT_VISUAL_HEIGHT = 240

/**
 * A document at a width, as a short key: a document inlines the visuals' whole stylesheet, so it's
 * hashed (with its length, against collisions) rather than kept as the key itself.
 */
const keyFor = (width: number, doc: string) =>
  `${width}:${doc.length}:${hash(doc)}`

/** How many measurements are kept; the oldest go first. */
const KEEP = 200

function remember<T>(map: Map<string, T>, key: string, value: T) {
  map.delete(key)
  map.set(key, value)
  if (map.size > KEEP) map.delete(map.keys().next().value!)
}

/**
 * A native measurement made once per key: kept in flight and once done (`settled`, so a frame can
 * open with it without waiting). A failed one isn't kept: the next showing tries again.
 */
function cached<T>(
  measure: (doc: string, baseUrl: string, width: number) => Promise<T | null>
) {
  const known = new Map<string, Promise<T | null>>()
  const settled = new Map<string, T>()
  const once = (
    doc: string,
    baseUrl: string,
    width: number,
    key = keyFor(width, doc)
  ): Promise<T | null> => {
    let result = known.get(key)
    if (!result) {
      result = measure(doc, baseUrl, width).then((value) => {
        if (value !== null) remember(settled, key, value)
        return value
      })
      remember(known, key, result)
      void result.then((value) => {
        if (value === null && known.get(key) === result) known.delete(key)
      })
    }
    return result
  }
  return { once, settled }
}

/** The document's height at `width`, capped. */
const heights = cached((doc, baseUrl, width) =>
  measureVisual(doc, baseUrl, width).then((h) =>
    h ? Math.min(MAX_VISUAL_HEIGHT, Math.ceil(h)) : null
  )
)

/** A hotspot document's height at `width` (capped) and where its parts sit. */
const spotMaps = cached((doc, baseUrl, width) =>
  measureVisualSpots(doc, baseUrl, width).then((m) =>
    m
      ? { ...m, height: Math.min(MAX_VISUAL_HEIGHT, Math.ceil(m.height)) }
      : null
  )
)

/**
 * Measures an HTML visual's document before its screen opens (the web's VisualsAhead), at the
 * width it'll be laid out at, so the frame opens at its height; for a hotspot, its parts too.
 */
export function measureAhead(
  doc: string,
  baseUrl: string,
  width: number,
  { height = true, spots = false }: { height?: boolean; spots?: boolean } = {}
) {
  const w = Math.round(width)
  if (height) void heights.once(doc, baseUrl, w)
  if (spots) void spotMaps.once(doc, baseUrl, w)
}

/**
 * The frame's height for a document: its own when it declares one, else the measured height (null
 * until it's known, and while the width it's laid out at isn't).
 */
export function useVisualHeight(
  doc: string,
  baseUrl: string,
  declared: number | undefined,
  /** The width the frame lays its document out at; undefined until it's known. */
  laidOut: number | undefined
): number | null {
  const width = laidOut === undefined ? undefined : Math.round(laidOut)
  const key = useMemo(
    () => (width === undefined ? null : keyFor(width, doc)),
    [width, doc]
  )
  const [measured, setMeasured] = useState<{
    key: string | null
    height: number | null
  }>(() => ({ key, height: key ? (heights.settled.get(key) ?? null) : null }))
  useEffect(() => {
    if (declared || width === undefined || !key) return
    let live = true
    void heights.once(doc, baseUrl, width, key).then((height) => {
      if (live) setMeasured({ key, height: height ?? DEFAULT_VISUAL_HEIGHT })
    })
    return () => {
      live = false
    }
  }, [declared, doc, baseUrl, width, key])
  if (declared) return declared
  if (!key) return null
  return measured.key === key
    ? measured.height
    : (heights.settled.get(key) ?? null)
}

/**
 * Where a hotspot's parts sit in its document at the frame's width, with the document's height,
 * measured natively (modules/visual-height) once per width and document. Null until it's known,
 * or where it can't be measured: the parts then can't be tapped, and the frame shows as a picture.
 * An empty document measures nothing (a frame that isn't a hotspot).
 */
export function useVisualSpots(
  doc: string,
  baseUrl: string,
  laidOut: number | undefined
): MeasuredSpots | null {
  const width = laidOut === undefined ? undefined : Math.round(laidOut)
  const key = useMemo(
    () => (width === undefined || !doc ? null : keyFor(width, doc)),
    [width, doc]
  )
  const [measured, setMeasured] = useState<{
    key: string | null
    spots: MeasuredSpots | null
  }>(() => ({ key, spots: key ? (spotMaps.settled.get(key) ?? null) : null }))
  useEffect(() => {
    if (width === undefined || !key) return
    let live = true
    void spotMaps.once(doc, baseUrl, width, key).then((spots) => {
      if (live) setMeasured({ key, spots })
    })
    return () => {
      live = false
    }
  }, [doc, baseUrl, width, key])
  if (!key) return null
  return measured.key === key
    ? measured.spots
    : (spotMaps.settled.get(key) ?? null)
}
