import { useEffect, useRef, useState } from "react"
import { View } from "react-native"
import { Gesture, GestureDetector } from "react-native-gesture-handler"
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated"

import { plainText } from "@workspace/player-core/plain-text"

import {
  Control,
  controlPadding,
  CONTROL_TEXT_SIZE,
  slotStyles,
  useShake,
} from "@/components/controls"
import { RichText } from "@/components/rich-text"
import { Text } from "@/components/ui/text"
import { Visual } from "@/components/visuals/visual"
import { tap } from "@/lib/haptics"
import { cn } from "@/lib/utils"

import type { QuestionKataProps } from "./options"

// The order kata: numbered slots wait on top and the shuffled items below. Tap the items in order
// and each lands in the next open slot, leaving a dashed space in the pool so the rest never shift;
// tap a placed item to send it back, or drag it up or down to another slot. The web's version is
// packages/player/src/order.tsx.

/** The slot a placed item lands in when dragged `dy` points from slot `from`, by the slots' heights. */
export function slotAfterDrag(
  heights: number[],
  from: number,
  dy: number,
  gap: number
): number {
  let to = from
  let left = dy
  while (left > 0 && to < heights.length - 1) {
    const step = (heights[to + 1] ?? 0) + gap
    if (left < step / 2) break
    left -= step
    to++
  }
  while (left < 0 && to > 0) {
    const step = (heights[to - 1] ?? 0) + gap
    if (-left < step / 2) break
    left += step
    to--
  }
  return to
}

/** The slots with the item at `from` moved to `to`, the others keeping their order. */
export function moveSlot<T>(slots: T[], from: number, to: number): T[] {
  const next = [...slots]
  const [item] = next.splice(from, 1)
  next.splice(to, 0, item!)
  return next
}

const GAP = 8

export function OrderKata({
  kata,
  answer,
  setAnswer,
  marks,
  locked,
  t,
}: QuestionKataProps) {
  // Every item keeps its place in the pool, placed or not: a placed one leaves its space behind.
  const [shown] = useState(() =>
    answer.kind === "sequence"
      ? [
          ...answer.pool,
          ...answer.slots.filter((id): id is string => id !== null),
        ]
      : []
  )
  const { style: shakeStyle, shake } = useShake()
  const wrong = Object.keys(marks)
    .filter((id) => marks[id] === "wrong")
    .join(",")
  useEffect(() => {
    if (wrong) shake()
    // Shakes once per set of wrong marks.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wrong])
  const heights = useRef<number[]>([])

  if (kata.type !== "order" || answer.kind !== "sequence") return null
  const { slots, pool } = answer
  const items = new Map(kata.items.map((it, i) => [it.id, { ...it, i }]))
  const visual = kata.items.some((it) => it.visual)
  const next = slots.indexOf(null)
  const textOf = (id: string) => plainText(items.get(id)?.text ?? id)

  const move = (nextSlots: (string | null)[], nextPool: string[]) => {
    tap()
    setAnswer({ kind: "sequence", slots: nextSlots, pool: nextPool })
  }
  /** From the pool into the next open slot. */
  const place = (id: string) => {
    if (next < 0) return
    move(
      slots.map((s, i) => (i === next ? id : s)),
      pool.filter((p) => p !== id)
    )
  }
  /** From a slot back to the end of the pool. */
  const unplace = (id: string) =>
    move(
      slots.map((s) => (s === id ? null : s)),
      [...pool, id]
    )
  /** A placed item dragged to another slot: the ones between shift to make room. */
  const drag = (from: number, dy: number) => {
    const to = slotAfterDrag(heights.current, from, dy, GAP)
    if (to === from) return false
    move(moveSlot(slots, from, to), pool)
    return true
  }

  /** Where a placed item waited: dashed, and as big as the item, so nothing around it moves. */
  const space = (id: string) => {
    const it = items.get(id)!
    return (
      <View
        key={id}
        aria-hidden
        className={cn(
          slotStyles,
          visual ? "min-h-16 w-[48%] grow" : controlPadding
        )}
      >
        {visual ? null : (
          <RichText
            text={it.text ?? ""}
            size={CONTROL_TEXT_SIZE}
            className="text-lesson-sm font-medium opacity-0"
          />
        )}
      </View>
    )
  }

  const tile = (id: string, placed: boolean) => {
    const it = items.get(id)!
    return (
      <Control
        key={id}
        mark={placed ? marks[id] : undefined}
        disabled={locked}
        onPress={() => (placed ? unplace(id) : place(id))}
        accessibilityLabel={textOf(id)}
        className={cn(
          controlPadding,
          // Placed items fill their row; waiting ones are chips, or cards when they're visuals.
          placed ? "min-w-0 flex-1" : visual ? "w-[48%] grow" : "max-w-full",
          placed && !visual ? "items-start" : "items-center",
          it.visual && "p-2"
        )}
      >
        {it.visual ? (
          <Visual visual={it.visual} label={textOf(id)} plain />
        ) : (
          <RichText
            text={it.text ?? ""}
            size={CONTROL_TEXT_SIZE}
            className={cn(
              "text-lesson-sm font-medium",
              !placed && "text-center"
            )}
          />
        )}
      </Control>
    )
  }

  return (
    <Animated.View className="gap-5" style={shakeStyle}>
      <View className="gap-2" accessibilityLabel={kata.prompt}>
        {slots.map((id, i) => (
          <View
            key={i}
            className="flex-row items-center gap-3"
            onLayout={(e) => {
              heights.current[i] = e.nativeEvent.layout.height
            }}
          >
            <Text
              aria-hidden
              className={cn(
                "w-4 shrink-0 text-end text-sm font-semibold tabular-nums",
                i === next ? "text-foreground" : "text-muted-foreground"
              )}
            >
              {i + 1}
            </Text>
            {id ? (
              <Draggable
                key={id}
                disabled={locked}
                onDrop={(dy) => drag(i, dy)}
              >
                {tile(id, true)}
              </Draggable>
            ) : (
              // An open slot; the next one to fill stands out a little. It takes a tile's padding
              // and one line of its text, so it's exactly as tall as a placed item.
              <View
                className={cn(
                  slotStyles,
                  "min-w-0 flex-1",
                  visual ? "min-h-16" : controlPadding,
                  i === next && "border-foreground/40"
                )}
                accessibilityLabel={t.emptyGap}
              >
                {visual ? null : (
                  <Text className="text-lesson-sm font-medium">{"​"}</Text>
                )}
              </View>
            )}
          </View>
        ))}
      </View>
      {shown.length ? (
        <View
          accessibilityLabel={t.pool}
          className={cn(
            "flex-row flex-wrap gap-2",
            visual ? "justify-start" : "justify-center"
          )}
        >
          {shown.map((id) => (pool.includes(id) ? tile(id, false) : space(id)))}
        </View>
      ) : null}
    </Animated.View>
  )
}

/**
 * A placed item that can be dragged up or down to another slot: it lifts after a short hold,
 * follows the finger on the UI thread, and settles where it's dropped (or springs back).
 */
function Draggable({
  disabled,
  onDrop,
  children,
}: {
  disabled: boolean
  /** How far it was dragged; true when it moved to another slot. */
  onDrop: (dy: number) => boolean
  children: React.ReactNode
}) {
  const y = useSharedValue(0)
  const lifted = useSharedValue(0)
  const drop = (dy: number) => {
    if (onDrop(dy)) y.value = 0
    else y.value = withSpring(0, { damping: 18, stiffness: 180 })
  }
  const pan = Gesture.Pan()
    .enabled(!disabled)
    .activateAfterLongPress(150)
    .onStart(() => {
      lifted.value = withTiming(1, { duration: 120 })
    })
    .onUpdate((e) => {
      y.value = e.translationY
    })
    .onFinalize((e) => {
      lifted.value = withTiming(0, { duration: 120 })
      runOnJS(drop)(e.translationY)
    })
  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: y.value }, { scale: 1 + lifted.value * 0.02 }],
    zIndex: lifted.value > 0 ? 10 : 0,
  }))
  return (
    <GestureDetector gesture={pan}>
      <Animated.View style={style} className="min-w-0 flex-1 flex-row">
        {children}
      </Animated.View>
    </GestureDetector>
  )
}
