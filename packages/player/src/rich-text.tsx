"use client"

import * as React from "react"

import { usePlayer } from "./context"
import { TOKEN } from "./plain-text"
import { mathKey } from "./prepared"

// Renders the spec's rich-text subset: **bold**, *italic*, `code`, and \( formulas \).
// A $ is always a plain dollar sign.

export { plainText } from "./plain-text"

export function RichText({
  text,
  lang,
  className,
  inline = false,
}: {
  text: string
  lang?: string
  className?: string
  /** The text is a piece of a sentence (a streamed word), so code keeps its chip even when it's all there is. */
  inline?: boolean
}) {
  const { prepared } = usePlayer()
  const nodes: React.ReactNode[] = []
  // Text that is only code (an option like `fixed stuff`) already sits in its own card or chip,
  // so it skips the inline chip: no box inside a box, and wrapped lines stay aligned.
  const solo = !inline && /^`[^`]+`$/.test(text.trim())
  let last = 0
  let key = 0
  for (const m of text.matchAll(TOKEN)) {
    if (m.index > last) nodes.push(text.slice(last, m.index))
    const [, math, code, bold, italic] = m
    if (math !== undefined) {
      const html = prepared.math[mathKey(math.trim(), false)]
      nodes.push(
        html ? (
          <span
            key={key++}
            dir="ltr"
            className="inline-block"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        ) : (
          <code key={key++}>{math}</code>
        )
      )
    } else if (code !== undefined) {
      nodes.push(
        <code
          key={key++}
          dir="ltr"
          className={
            solo
              ? "font-mono text-[0.9em]"
              : "rounded-md bg-muted px-1.5 py-0.5 font-mono text-[0.9em]"
          }
        >
          {code}
        </code>
      )
    } else if (bold !== undefined) {
      nodes.push(
        <strong key={key++} className="font-semibold">
          {bold}
        </strong>
      )
    } else if (italic !== undefined) {
      nodes.push(<em key={key++}>{italic}</em>)
    }
    last = m.index + m[0].length
  }
  if (last < text.length) nodes.push(text.slice(last))
  // dir="auto": lesson text takes its own direction, so English stays left to right inside an Arabic interface.
  return (
    <span lang={lang} dir="auto" className={className}>
      {nodes}
    </span>
  )
}
