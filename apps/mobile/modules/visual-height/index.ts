import { requireOptionalNativeModule } from "expo"

// The app's own native module (ios/VisualHeightModule.swift): lays out a lesson's HTML visual off
// screen with scripts off and reports its height. iOS only; elsewhere it isn't there, and
// measureVisual answers null.

interface VisualHeightModule {
  measure(html: string, baseUrl: string, width: number): Promise<number | null>
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
