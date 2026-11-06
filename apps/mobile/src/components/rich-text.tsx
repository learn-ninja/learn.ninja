import type { ReactNode } from "react"
import { View } from "react-native"

import { TOKEN } from "@workspace/player-core/plain-text"
import { mathKey } from "@workspace/player-core/prepared"
import { textBlocks } from "@workspace/spec"

import { useLesson } from "@/components/lesson-context"
import { InlineMath } from "@/components/math"
import { Text } from "@/components/ui/text"
import { cn } from "@/lib/utils"
import { useLessonTextScale } from "@/components/text-size"
import { fontSize } from "../../tokens"

// The spec's rich-text subset as native Text runs: **bold**, *italic*, `code`, and \( formulas \),
// with a concept body's paragraphs and lists. The web's version is packages/player/src/rich-text.tsx.

/** Lesson body text: the web's text-sm leading-relaxed at the learner's text size. */
const BODY = "text-lesson-sm-relaxed"

/** One paragraph's inline runs. */
export function RichText({
  text,
  className,
  size = fontSize.sm[0],
}: {
  text: string
  className?: string
  /**
   * The text's Tailwind size in points before the learner's text size scales it (14 for
   * lesson-sm), when className changes it: formulas are set relative to it.
   */
  size?: number
}) {
  const { mathSvg } = useLesson()
  const scaled = size * useLessonTextScale()
  const nodes: ReactNode[] = []
  let last = 0
  let key = 0
  for (const m of text.matchAll(TOKEN)) {
    if (m.index > last) nodes.push(text.slice(last, m.index))
    const [, math, code, bold, italic] = m
    if (math !== undefined) {
      const tex = math.trim()
      const drawn = mathSvg[mathKey(tex, false)]
      // A formula the server couldn't draw shows its source, as the web does without KaTeX's.
      nodes.push(
        drawn ? (
          <InlineMath key={key++} math={drawn} fontSize={scaled} label={tex} />
        ) : (
          <Text key={key++} className="font-mono">
            {math}
          </Text>
        )
      )
    } else if (code !== undefined) {
      nodes.push(
        <Text key={key++} className="bg-muted font-mono">
          {/* Padded with no-break spaces: a plain one let the line break inside the chip, leaving
              its fill behind as an empty box at the end of the line. */}
          {` ${code} `}
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
