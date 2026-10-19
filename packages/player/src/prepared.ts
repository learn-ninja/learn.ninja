// What the server prepares for a lesson before it reaches the browser: rendered formulas,
// highlighted code, and drawn charts. Shared by the server-side preparer and the client components.

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
}

export const emptyPrepared: Prepared = {
  math: {},
  code: {},
  visualsCss: "",
  charts: {},
}

export const mathKey = (tex: string, display: boolean) =>
  `${display ? "d" : "i"}:${tex}`
/**
 * A code block's key: the language, a newline, then the code. A newline can't appear in a language
 * name, so the key is unambiguous; a NUL can't be stored (Postgres jsonb rejects it).
 */
export const codeKey = (language: string, code: string) =>
  `${language}\n${code}`
/** A chart's key: its content hashed (FNV-1a), drawn full size or compact (on an option or item card). */
export const chartKey = (chart: unknown, compact: boolean) => {
  const text = JSON.stringify(chart)
  let hash = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return `${compact ? "c" : "f"}:${(hash >>> 0).toString(16)}`
}

/** Inline formulas in rich text: \( ... \) */
export const INLINE_MATH = /\\\(([\s\S]+?)\\\)/g
