import { ScrollView, View } from "react-native"
import { SvgXml } from "react-native-svg"

import { MATH_SCALE, type MathSvg } from "@workspace/player-core/prepared"

import { Text } from "@/components/ui/text"
import { colors } from "../../tokens"

/**
 * How far the system font's descender reaches below the baseline, in em (SF Pro's is 0.23). iOS sets
 * a view inside a Text with its bottom on that line, not on the baseline.
 */
const FONT_DESCENT = 0.23

/**
 * A formula set inline in a line of text, as KaTeX sets it on the web: 1.21 times the text's size,
 * standing on the text's baseline. The SVG comes from the server (GET /api/lessons/{id}'s mathSvg,
 * drawn by MathJax with KaTeX's metrics). The view is as tall as the formula's ascent plus the
 * font's descent, so its baseline meets the text's; a deeper formula (a fraction) hangs below it.
 */
export function InlineMath({
  math,
  fontSize,
  color = colors.foreground,
  label,
}: {
  math: MathSvg
  /** The surrounding text's size, in points. */
  fontSize: number
  color?: string
  /** What a screen reader says: the formula's LaTeX. */
  label: string
}) {
  const em = fontSize * MATH_SCALE
  const width = math.width * em
  const height = (math.ascent + math.descent) * em
  return (
    <View
      style={{
        width,
        height: math.ascent * em + FONT_DESCENT * fontSize,
        overflow: "visible",
      }}
      accessible
      accessibilityRole="image"
      accessibilityLabel={label}
    >
      <SvgXml
        xml={math.svg}
        width={width}
        height={height}
        color={color}
        style={{ position: "absolute", top: 0 }}
      />
    </View>
  )
}

/**
 * A formula visual (`kind: "math"`), as the web's MathBlock: the display formula centered in a
 * muted card at text-xl, scrolling sideways when it's wider than the screen. Without a drawing its
 * source shows.
 */
export function MathBlock({
  tex,
  math,
  fontSize,
}: {
  tex: string
  math?: MathSvg
  /** text-xl at the player's text size, in points. */
  fontSize: number
}) {
  const em = fontSize * MATH_SCALE
  return (
    <ScrollView
      horizontal
      className="rounded-xl border border-border bg-muted/40"
      contentContainerClassName="min-w-full justify-center px-4 py-6"
      showsHorizontalScrollIndicator={false}
    >
      {math ? (
        <View accessible accessibilityRole="image" accessibilityLabel={tex}>
          <SvgXml
            xml={math.svg}
            width={math.width * em}
            height={(math.ascent + math.descent) * em}
            color={colors.foreground}
          />
        </View>
      ) : (
        <Text className="font-mono">{tex}</Text>
      )}
    </ScrollView>
  )
}
