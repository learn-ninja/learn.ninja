import { useEffect, useRef, useState } from "react"
import { View } from "react-native"
import Animated from "react-native-reanimated"

import type { Mark } from "@workspace/player-core/check"
import { plainText } from "@workspace/player-core/plain-text"

import {
  Control,
  controlPadding,
  CONTROL_TEXT_SIZE,
  slotStyles,
  useShake,
} from "@/components/controls"
import { RichText } from "@/components/rich-text"
import { tap } from "@/lib/haptics"
import { cn } from "@/lib/utils"

import type { QuestionKataProps } from "./options"

// Tap an item, then its match in the other column (either side can go first). Each pair is judged
// as it's made: a right pair flashes green and stays matched, greyed out, so the board empties as
// you go; a wrong one shakes yellow, comes apart, and costs the kata its first-try score
// (`onSlip`). The last pair checks the kata (`onDone`), so there's no Check to press. The web's
// version is packages/player/src/katas.tsx (MatchKata).

/** How long a pair shows its result before it settles (and, after the last pair, the kata checks). */
const PAIR_FLASH = 450

export function MatchKata({
  kata,
  answer,
  setAnswer,
  marks,
  locked,
  rightOrder,
  onSlip,
  onDone,
}: QuestionKataProps & {
  rightOrder: number[]
  onSlip?: () => void
  onDone?: () => void
}) {
  // The item waiting for its match: either column can go first.
  const [armed, setArmed] = useState<{
    side: "left" | "right"
    index: number
  } | null>(null)
  // The pair just made, while it shows whether it was right.
  const [flash, setFlash] = useState<{
    left: number
    right: number
    good: boolean
  } | null>(null)
  const { style: shakeStyle, shake } = useShake()
  useEffect(() => {
    if (!flash) return
    if (!flash.good) shake()
    const id = setTimeout(() => setFlash(null), PAIR_FLASH)
    return () => clearTimeout(id)
    // Shakes once per flash.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flash])
  const done = useRef(onDone)
  done.current = onDone
  const complete =
    kata.type === "match" &&
    answer.kind === "pairs" &&
    Object.keys(answer.links).length === kata.pairs.length
  useEffect(() => {
    if (!complete || locked) return
    const id = setTimeout(() => done.current?.(), PAIR_FLASH)
    return () => clearTimeout(id)
  }, [complete, locked])

  if (kata.type !== "match" || answer.kind !== "pairs") return null
  const links = answer.links
  const matchedRight = new Set(Object.values(links))
  const isArmed = (side: "left" | "right", index: number) =>
    armed?.side === side && armed.index === index

  // A pair is right when the right-hand item is the left one's own (pairs keep their index).
  const pair = (left: number, right: number) => {
    setArmed(null)
    tap()
    const good = left === right
    setFlash({ left, right, good })
    if (good) setAnswer({ kind: "pairs", links: { ...links, [left]: right } })
    else onSlip?.()
  }
  const press = (side: "left" | "right", index: number) => {
    if (armed && armed.side !== side)
      return side === "left"
        ? pair(index, armed.index)
        : pair(armed.index, index)
    setArmed(isArmed(side, index) ? null : { side, index })
  }

  /** The tile's look: its check mark, the pair it's flashing in, matched, or waiting. */
  const statusOf = (side: "L" | "R", index: number): Mark | undefined =>
    marks[`${side}${index}`] ??
    (flash && (side === "L" ? flash.left : flash.right) === index
      ? flash.good
        ? "correct"
        : "wrong"
      : undefined)
  const tile = (
    side: "left" | "right",
    index: number,
    text: string,
    matched: boolean
  ) => {
    const status = statusOf(side === "left" ? "L" : "R", index)
    // Matched and settled: a dashed outline with muted text, out of play.
    const settled = matched && !status
    return (
      <Control
        selected={isArmed(side, index)}
        mark={status}
        disabled={locked || matched}
        onPress={() => press(side, index)}
        accessibilityLabel={plainText(text)}
        className={cn(
          controlPadding,
          "flex-1 items-center justify-center",
          settled && cn(slotStyles, "shadow-none")
        )}
        style={settled ? { backgroundColor: "transparent" } : undefined}
      >
        <RichText
          text={text}
          size={CONTROL_TEXT_SIZE}
          className={cn(
            "text-lesson-sm text-center font-medium",
            settled && "text-muted-foreground"
          )}
        />
      </Control>
    )
  }

  // Row by row, so each item is as tall as the one beside it (the web's subgrid).
  return (
    <Animated.View className="gap-2" style={shakeStyle}>
      {kata.pairs.map((p, i) => {
        const j = rightOrder[i]!
        return (
          <View key={i} className="flex-row items-stretch gap-3">
            {tile("left", i, p.left, i in links)}
            {tile("right", j, kata.pairs[j]!.right, matchedRight.has(j))}
          </View>
        )
      })}
    </Animated.View>
  )
}
