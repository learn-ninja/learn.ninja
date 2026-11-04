// Colors as React Native takes them: the tokens are hex and rgba strings, and the player's tints
// are mixes of them (the web's color-mix and Tailwind's /10 modifiers), worked out here.

/** A color's channels, 0 to 255, and its alpha, 0 to 1. */
export function parseColor(
  color: string
): [number, number, number, number] | null {
  const hex = /^#([0-9a-f]{3,8})$/i.exec(color.trim())
  if (hex) {
    let h = hex[1]!
    if (h.length === 3 || h.length === 4) h = [...h].map((c) => c + c).join("")
    const n = parseInt(h.padEnd(8, "f"), 16)
    return [
      (n >>> 24) & 255,
      (n >>> 16) & 255,
      (n >>> 8) & 255,
      (n & 255) / 255,
    ]
  }
  const rgb =
    /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:\s*[,/]\s*([\d.]+)(%?))?\s*\)$/i.exec(
      color.trim()
    )
  if (rgb) {
    const a = rgb[4] === undefined ? 1 : Number(rgb[4]) / (rgb[5] ? 100 : 1)
    return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3]), a]
  }
  return null
}

const rgba = ([r, g, b, a]: [number, number, number, number]) =>
  a >= 1
    ? `#${[r, g, b].map((c) => Math.round(c).toString(16).padStart(2, "0")).join("")}`
    : `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}, ${Math.round(a * 1000) / 1000})`

/** The color at an opacity: Tailwind's `bg-green-600/10`. */
export function alpha(color: string, opacity: number): string {
  const c = parseColor(color)
  if (!c) return color
  return rgba([c[0], c[1], c[2], c[3] * opacity])
}

/**
 * `color-mix(in srgb, a pct%, b)`: `a` and `b` blended by `pct` (0 to 100) in sRGB, each weighted by
 * its own alpha as CSS does. Good enough for the player's tints; the web mixes some in OKLab.
 */
export function mix(a: string, pct: number, b: string): string {
  const ca = parseColor(a)
  const cb = parseColor(b)
  if (!ca || !cb) return a
  const p = Math.max(0, Math.min(100, pct)) / 100
  const wa = p * ca[3]
  const wb = (1 - p) * cb[3]
  const alphaOut = wa + wb
  if (alphaOut === 0) return "rgba(0, 0, 0, 0)"
  const ch = (i: 0 | 1 | 2) => (ca[i] * wa + cb[i] * wb) / alphaOut
  return rgba([ch(0), ch(1), ch(2), alphaOut])
}
