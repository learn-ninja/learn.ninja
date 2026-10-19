// What the server prepares for a lesson before it reaches the browser: rendered formulas,
// highlighted code, and drawn charts and diagrams. Shared by the server-side preparer and the
// client components.

export type CodeToken = { content: string; style?: Record<string, string> }
export type CodeLines = CodeToken[][]

export interface Prepared {
  /** Rendered KaTeX HTML, keyed by mathKey(). */
  math: Record<string, string>
  /** Highlighted code lines, keyed by codeKey(). */
  code: Record<string, CodeLines>
  /** Tailwind utilities for the classes this lesson's HTML visuals use, injected into each sandbox. */
  visualsCss: string
  /** Chart visuals drawn as SVG, keyed by chartKey(). Older prepared data has none. */
  charts?: Record<string, string>
  /** Diagram visuals drawn from their D2 as SVG, keyed by diagramKey(). Older prepared data has none. */
  diagrams?: Record<string, string>
}

export const emptyPrepared: Prepared = {
  math: {},
  code: {},
  visualsCss: "",
  charts: {},
  diagrams: {},
}

export const mathKey = (tex: string, display: boolean) =>
  `${display ? "d" : "i"}:${tex}`
export const codeKey = (language: string, code: string) =>
  `${language}\u0000${code}`
/** Text hashed with FNV-1a, as hex. */
const hash = (text: string) => {
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0).toString(16)
}
/** A chart's key: its content hashed, drawn full size or compact (on an option or item card). */
export const chartKey = (chart: unknown, compact: boolean) =>
  `${compact ? "c" : "f"}:${hash(JSON.stringify(chart))}`
/** A diagram's key: its D2 source hashed. One drawing serves every size. */
export const diagramKey = (d2: string) => `d:${hash(d2)}`

/** Inline formulas in rich text: \( ... \) */
export const INLINE_MATH = /\\\(([\s\S]+?)\\\)/g
