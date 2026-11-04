import { Platform, Pressable, Text as RNText, View } from "react-native"

import {
  codeKey,
  type CodeToken,
  type Prepared,
} from "@workspace/player-core/prepared"

import { markStyle } from "@/components/controls"
import type { HotspotControl } from "@/components/visuals/visual"
import { alpha } from "@/lib/color"
import { tap } from "@/lib/haptics"
import { cn } from "@/lib/utils"
import { colors } from "../../tokens"

// A code visual from the Shiki tokens prepared at publish time: each token a styled Text run, in
// the dark theme's colors (--shiki-dark), since the app is dark-only for now. Each line is a row,
// numbered, wrapping under its own start as the web does on phones, so every line (and every
// tappable one in a hotspot) shows whole.

/** Menlo is iOS-only; Android names its monospace face generically. */
const MONO = Platform.select({ ios: "Menlo", default: "monospace" })

function tokenStyle(token: CodeToken) {
  const style = token.style ?? {}
  const color = style["--shiki-dark"] ?? style.color
  const fontStyle = style["--shiki-dark-font-style"] ?? style["font-style"]
  const fontWeight = style["--shiki-dark-font-weight"] ?? style["font-weight"]
  return {
    color: color ?? colors.foreground,
    fontStyle: fontStyle === "italic" ? ("italic" as const) : undefined,
    fontWeight: fontWeight === "bold" ? ("bold" as const) : undefined,
  }
}

const mono = { fontFamily: MONO, fontSize: 13, lineHeight: 28 }

export function CodeBlock({
  code,
  language,
  highlight,
  spots,
  hotspots,
  prepared,
  plain = false,
}: {
  code: string
  language: string
  highlight?: number[]
  spots?: { id: string; line: number }[]
  hotspots?: HotspotControl
  prepared: Prepared
  plain?: boolean
}) {
  const lines =
    prepared.code[codeKey(language, code)] ??
    code.split("\n").map((content) => [{ content }])
  const spotByLine = new Map((spots ?? []).map((s) => [s.line, s.id]))
  return (
    <View
      className={cn(
        !plain &&
          "min-h-72 justify-center rounded-xl border border-border bg-muted/40"
      )}
      accessibilityLabel={hotspots ? undefined : code}
    >
      <View className="py-3" style={{ direction: "ltr" }}>
        {lines.map((line, i) => {
          const n = i + 1
          const id = hotspots ? spotByLine.get(n) : undefined
          const mark = id ? hotspots?.marks[id] : undefined
          const selected = id ? hotspots?.selected.includes(id) : false
          const body = (
            <>
              <RNText
                aria-hidden
                style={[
                  mono,
                  {
                    width: 24,
                    textAlign: "right",
                    color: alpha(colors.muted.foreground, 0.7),
                  },
                ]}
              >
                {n}
              </RNText>
              <RNText style={[mono, { flex: 1 }]}>
                {line.length === 0 ||
                (line.length === 1 && line[0]!.content === "")
                  ? " "
                  : line.map((token, j) => (
                      <RNText key={j} style={tokenStyle(token)}>
                        {token.content}
                      </RNText>
                    ))}
              </RNText>
            </>
          )
          const rowStyle = [
            { borderStartWidth: 3, borderStartColor: "transparent" },
            highlight?.includes(n) && {
              backgroundColor: alpha(colors.primary.DEFAULT, 0.05),
            },
          ]
          if (!id || !hotspots)
            return (
              <View key={n} className="flex-row gap-4 px-4" style={rowStyle}>
                {body}
              </View>
            )
          return (
            <Pressable
              key={n}
              accessibilityRole="button"
              accessibilityLabel={`Line ${n}`}
              accessibilityState={{ selected, disabled: hotspots.disabled }}
              disabled={hotspots.disabled}
              onPress={() => {
                tap()
                hotspots.onToggle(id)
              }}
              className="active:bg-tile w-full flex-row gap-4 px-4"
              style={[
                rowStyle,
                selected && {
                  borderStartColor: colors.primary.DEFAULT,
                  backgroundColor: alpha(colors.primary.DEFAULT, 0.1),
                },
                mark && {
                  ...markStyle(mark),
                  borderStartColor: markStyle(mark)?.borderColor,
                },
              ]}
            >
              {body}
            </Pressable>
          )
        })}
      </View>
    </View>
  )
}
