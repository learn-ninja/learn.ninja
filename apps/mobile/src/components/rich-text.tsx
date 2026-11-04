import type { ReactNode } from "react"
import { View } from "react-native"

import { TOKEN } from "@workspace/player-core/plain-text"
import { textBlocks } from "@workspace/spec"

import { Text } from "@/components/ui/text"
import { cn } from "@/lib/utils"

// The spec's rich-text subset as native Text runs: **bold**, *italic*, `code`, and \( formulas \),
// with a concept body's paragraphs and lists. The web's version is packages/player/src/rich-text.tsx.

/** Lesson body text: the web's text-sm leading-relaxed (1.625) at the player's medium text size. */
const BODY = "text-lesson-sm leading-[25.6px]"

/** One paragraph's inline runs. */
export function RichText({
  text,
  className,
}: {
  text: string
  className?: string
}) {
  const nodes: ReactNode[] = []
  let last = 0
  let key = 0
  for (const m of text.matchAll(TOKEN)) {
    if (m.index > last) nodes.push(text.slice(last, m.index))
    const [, math, code, bold, italic] = m
    if (math !== undefined) {
      // TODO(phase 1): render inline math natively (a MathJax view). For now its LaTeX source shows.
      nodes.push(
        <Text key={key++} className="font-mono text-muted-foreground">
          {math.trim()}
        </Text>
      )
    } else if (code !== undefined) {
      nodes.push(
        <Text key={key++} className="bg-muted font-mono">
          {` ${code} `}
        </Text>
      )
    } else if (bold !== undefined) {
      nodes.push(
        <Text key={key++} className="font-semibold">
          {bold}
        </Text>
      )
    } else if (italic !== undefined) {
      nodes.push(
        <Text key={key++} className="italic">
          {italic}
        </Text>
      )
    }
    last = m.index + m[0].length
  }
  if (last < text.length) nodes.push(text.slice(last))
  return <Text className={cn(BODY, className)}>{nodes}</Text>
}

/** A concept body: paragraphs and lists, spaced as the web's (gap-2 between blocks, gap-1 between items). */
export function RichBlocks({ text }: { text: string }) {
  return (
    <View className="gap-2">
      {textBlocks(text).map((block, i) =>
        block.kind === "paragraph" ? (
          <RichText key={i} text={block.text} />
        ) : (
          <View key={i} className="gap-1">
            {block.items.map((item, j) => (
              // The marker hangs in the list's 20-point indent, as a CSS list-item's does.
              <View key={j} className="flex-row">
                <Text
                  className={cn(
                    BODY,
                    "w-6 pe-1 text-end text-muted-foreground"
                  )}
                  aria-hidden
                >
                  {block.ordered ? `${block.start + j}.` : "•"}
                </Text>
                <View className="flex-1">
                  <RichText text={item} />
                </View>
              </View>
            ))}
          </View>
        )
      )}
    </View>
  )
}
