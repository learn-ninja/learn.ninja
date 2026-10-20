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
/**
 * A code block's key: the language, a newline, then the code. A newline can't appear in a language
 * name, so the key is unambiguous; a NUL can't be stored (Postgres jsonb rejects it).
 */
export const codeKey = (language: string, code: string) =>
  `${language}\n${code}`
/** Text hashed with FNV-1a, as hex. */
const hash = (text: string) => {
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0).toString(16)
}
/** JSON with every object's keys sorted, so the same content always gives the same text. */
const canonicalJson = (value: unknown): string =>
  JSON.stringify(value, (_, v: unknown) =>
    v && typeof v === "object" && !Array.isArray(v)
      ? Object.fromEntries(
          Object.entries(v).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        )
      : v
  )
/**
 * A chart's key: its content hashed, drawn full size or compact (on an option or item card). The
 * keys are sorted first: Postgres jsonb reorders them, so a stored lesson reads back in a
 * different order than it was prepared in.
 */
export const chartKey = (chart: unknown, compact: boolean) =>
  `${compact ? "c" : "f"}:${hash(canonicalJson(chart))}`
/** A diagram's key: its D2 source hashed. One drawing serves every size. */
export const diagramKey = (d2: string) => `d:${hash(d2)}`

/** Inline formulas in rich text: \( ... \) */
export const INLINE_MATH = /\\\(([\s\S]+?)\\\)/g
