import { requireOptionalNativeModule } from "expo"

// The app's own native module (ios/VisualHeightModule.swift): lays out a lesson's HTML visual off
// screen with scripts off and reports its height, and for a hotspot kata where its tappable parts
// are. iOS only; elsewhere it isn't there, and both answer null.

/** Where a `[data-hotspot]` element sits in the document, in CSS pixels from its top left. */
export interface SpotBox {
  id: string
  label: string
  top: number
  left: number
  width: number
  height: number
}

export interface MeasuredSpots {
  height: number
  spots: SpotBox[]
}

interface VisualHeightModule {
  measure(html: string, baseUrl: string, width: number): Promise<number | null>
  measureSpots(
    html: string,
    baseUrl: string,
    width: number
  ): Promise<MeasuredSpots | null>
}

const native = requireOptionalNativeModule<VisualHeightModule>("VisualHeight")

/** The document's height in points when laid out `width` points wide, or null if it can't be measured. */
export function measureVisual(
  html: string,
  baseUrl: string,
  width: number
): Promise<number | null> {
  return native
    ? native.measure(html, baseUrl, width).catch(() => null)
    : Promise.resolve(null)
}

/**
 * The document's height and its hotspot parts' boxes when laid out `width` points wide, or null if
 * it can't be measured. The boxes are read in the same isolated world as the height: the page's
 * own scripts stay off.
 */
export function measureVisualSpots(
  html: string,
  baseUrl: string,
  width: number
): Promise<MeasuredSpots | null> {
  return native?.measureSpots
    ? native.measureSpots(html, baseUrl, width).catch(() => null)
    : Promise.resolve(null)
}
