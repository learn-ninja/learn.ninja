"use client"

import * as React from "react"

import { firstSteps, textBlocks } from "@workspace/spec"
import { cn } from "@workspace/ui/lib/utils"

import { usePlayer } from "./context"
import { TOKEN } from "@workspace/player-core/plain-text"
import { mathKey } from "@workspace/player-core/prepared"

// Renders the spec's rich-text subset: **bold**, *italic*, `code`, and \( formulas \).
// A $ is always a plain dollar sign. A concept body also has paragraphs and lists (RichBlocks).

export { plainText } from "@workspace/player-core/plain-text"

export function RichText({
  text,
  lang,
  className,
  inline = false,
  block = false,
}: {
  text: string
  lang?: string
  className?: string
  /** The text is a piece of a sentence (a streamed word), so code keeps its chip even when it's all there is. */
  inline?: boolean
  /**
   * The text fills a paragraph or list item that takes its direction itself (dir="auto"). The span
   * then has none of its own: dir="auto" skips children with their own dir, so it couldn't see the text.
   */
  block?: boolean
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
    <span lang={lang} dir={block ? undefined : "auto"} className={className}>
      {nodes}
    </span>
  )
}

/** A concept body: its lines as paragraphs, and bulleted or numbered lists (see textBlocks). */
export function RichBlocks({
  text,
  className,
  steps,
}: {
  text: string
  className?: string
  /** A stepped concept: how many steps to show so far (the newest fades in). All of them without it. */
  steps?: number
}) {
  const all = textBlocks(text)
  const blocks = steps === undefined ? all : firstSteps(all, steps)
  // The step just added fades in; the first is there with the screen.
  const arriving =
    steps !== undefined && steps > 1
      ? "animate-in duration-300 fade-in motion-reduce:animate-none"
      : undefined
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {blocks.map((block, i) => {
        const last = i === blocks.length - 1
        if (block.kind === "paragraph")
          return (
            <p key={i} dir="auto" className={last ? arriving : undefined}>
              <RichText text={block.text} block />
            </p>
          )
        const List = block.ordered ? "ol" : "ul"
        return (
          <List
            key={i}
            dir="auto"
            start={block.ordered && block.start !== 1 ? block.start : undefined}
            className={cn(
              "flex flex-col gap-1 ps-5 marker:text-muted-foreground",
              block.ordered ? "list-decimal" : "list-disc"
            )}
          >
            {block.items.map((item, j) => (
              <li
                key={j}
                className={cn(
                  "ps-1",
                  last && j === block.items.length - 1 && arriving
                )}
              >
                <RichText text={item} block />
              </li>
            ))}
          </List>
        )
      })}
    </div>
  )
}
