import { Fragment, useEffect, useState } from "react"
import { View } from "react-native"
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated"

import { chipsInGaps } from "@workspace/player-core/state"

import { Control, MarkBadge, slotStyles, useShake } from "@/components/controls"
import { Text } from "@/components/ui/text"
import { cn } from "@/lib/utils"
import { fontSize, LESSON_TEXT_SCALE } from "../../../tokens"

import type { QuestionKataProps } from "./options"

// Gaps to fill from a bank of word chips, set like Duolingo's: the sentence sits on the page at
// reading size, and a gap is an underline as wide as the widest chip, so the text never jumps.
// The gap waiting for a word has a blinking caret. Tapping a word puts it on that line, and
// tapping it there sends it back. A used word leaves a dashed ghost in the bank, so the other
// chips stay put. The web's version is packages/player/src/katas.tsx (BlankKata).

/** The sentence's line height, the web's leading-9. */
const LINE = 36

export function BlankKata({
  kata,
  answer,
  setAnswer,
  marks,
  locked,
  bank,
  t,
}: QuestionKataProps & { bank: string[] }) {
  const [active, setActive] = useState<string | null>(null)
  // The widest chip, measured from the bank, sets every empty gap's width.
  const [widths, setWidths] = useState<Record<number, number>>({})
  const gapWidth = Math.max(0, ...Object.values(widths))
  const { style: shakeStyle, shake } = useShake()
  const wrong = Object.keys(marks)
    .filter((id) => marks[id] === "wrong")
    .join(",")
  useEffect(() => {
    if (wrong) shake()
    // Shakes once per set of wrong marks.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wrong])

  if (kata.type !== "blank" || answer.kind !== "gaps") return null
  const values = answer.values
  const gapIds = kata.blanks.map((b) => b.id)
  const firstEmpty = gapIds.find((id) => !values[id])
  const target = active && !values[active] ? active : firstEmpty
  const placed = chipsInGaps(gapIds, values, bank)
  const used = new Set(Object.values(placed))
  const fill = (next: Record<string, string>, wait: string | null) => {
    setAnswer({ kind: "gaps", values: next })
    setActive(wait)
  }
  const place = (word: string) => {
    if (!target) return
    const next = { ...values, [target]: word }
    fill(next, gapIds.find((id) => !next[id]) ?? null)
  }
  const unplace = (id: string) => fill({ ...values, [id]: "" }, id)

  const code = kata.format === "code"
  // One reading size: the words are the sentence's size (code's is mono), set apart by weight and chip.
  const textClass = code
    ? "font-mono text-lesson-sm"
    : "text-lesson-base font-medium"
  const lines = kata.template.split("\n")

  return (
    <Animated.View className="gap-8" style={shakeStyle}>
      {/* The sentence is the content: on the page, at reading size, with no card around it. */}
      <View style={{ direction: code ? "ltr" : undefined }}>
        {lines.map((line, li) => (
          <View key={li} className="flex-row flex-wrap items-center">
            {line.split(/(\s+|\[\[[^\]]+\]\])/).map((part, i) => {
              if (!part) return null
              const m = /^\[\[(.+)\]\]$/.exec(part)
              if (!m)
                return (
                  <Text
                    key={i}
                    className={cn(textClass, "leading-9")}
                    style={{ lineHeight: LINE }}
                  >
                    {part}
                  </Text>
                )
              const id = m[1]!
              const value = values[id]
              const waiting = !locked && !value && target === id
              return (
                <Fragment key={i}>
                  {value ? (
                    <Control
                      mark={marks[id]}
                      disabled={locked}
                      onPress={() => unplace(id)}
                      accessibilityLabel={value}
                      className="mx-0.5 flex-row items-center gap-1.5 px-2.5 py-0.5"
                    >
                      <Text className={textClass}>{value}</Text>
                      <MarkBadge mark={marks[id]} className="h-4 w-4" />
                    </Control>
                  ) : (
                    <Gap
                      width={gapWidth}
                      waiting={waiting}
                      disabled={locked}
                      label={t.emptyGap}
                      onPress={() => setActive(id)}
                    />
                  )}
                </Fragment>
              )
            })}
          </View>
        ))}
      </View>
      <View
        className="flex-row flex-wrap gap-2"
        accessibilityLabel={t.wordBank}
      >
        {bank.map((word, i) => {
          const gone = used.has(i)
          return (
            <Control
              key={`${word}-${i}`}
              selected={gone}
              disabled={locked || gone}
              onPress={() => !gone && place(word)}
              accessibilityLabel={word}
              className={cn(
                "px-3 py-1",
                // An outlined slot holds its place, so the other chips don't move.
                gone &&
                  cn(slotStyles, "border-dashed bg-transparent shadow-none")
              )}
              style={gone ? { backgroundColor: "transparent" } : undefined}
            >
              <View
                onLayout={(e) => {
                  const w = Math.ceil(e.nativeEvent.layout.width) + 20
                  setWidths((all) => (all[i] === w ? all : { ...all, [i]: w }))
                }}
              >
                <Text className={cn(textClass, gone && "text-transparent")}>
                  {word}
                </Text>
              </View>
            </Control>
          )
        })}
      </View>
    </Animated.View>
  )
}

/** An empty gap: a line the word lands on, the width of the widest chip, with a caret while it waits. */
function Gap({
  width,
  waiting,
  disabled,
  label,
  onPress,
}: {
  width: number
  waiting: boolean
  disabled: boolean
  label: string
  onPress: () => void
}) {
  return (
    <Control
      disabled={disabled}
      onPress={onPress}
      accessibilityLabel={label}
      selected={waiting}
      className={cn(
        "mx-1 h-7 items-center justify-center rounded-none border-0 border-b-2 bg-transparent shadow-none",
        waiting ? "border-foreground" : "border-muted-foreground/40"
      )}
      style={{ width: Math.max(width, 40), backgroundColor: "transparent" }}
    >
      {waiting ? <Caret /> : null}
    </Control>
  )
}

/** A blinking bar, as the web's learn-caret. */
function Caret() {
  const opacity = useSharedValue(1)
  const reduced = useReducedMotion()
  useEffect(() => {
    if (reduced) return
    opacity.value = withRepeat(withTiming(0, { duration: 530 }), -1, true)
  }, [opacity, reduced])
  const style = useAnimatedStyle(() => ({ opacity: opacity.value }))
  return (
    <Animated.View
      className="w-0.5 bg-foreground"
      style={[{ height: fontSize.base[0] * LESSON_TEXT_SCALE }, style]}
    />
  )
}
