import type { ReactNode } from "react"
import { View } from "react-native"

import { TOKEN } from "@workspace/player-core/plain-text"
import { textBlocks } from "@workspace/spec"

import { Text } from "@/components/ui/text"
import { cn } from "@/lib/utils"

// The spec's rich-text subset as native Text runs: **bold**, *italic*, `code`, and \( formulas \),
// with a concept body's paragraphs and lists. The web's version is packages/player/src/rich-text.tsx.

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
  return <Text className={cn("text-sm leading-6", className)}>{nodes}</Text>
}

/** A concept body: paragraphs and lists. */
export function RichBlocks({ text }: { text: string }) {
  return (
    <View className="gap-3">
      {textBlocks(text).map((block, i) =>
        block.kind === "paragraph" ? (
          <RichText key={i} text={block.text} />
        ) : (
          <View key={i} className="gap-1.5">
            {block.items.map((item, j) => (
              <View key={j} className="flex-row gap-2">
                <Text className="w-5 text-sm leading-6 text-muted-foreground">
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
