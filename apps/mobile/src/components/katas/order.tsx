import { useEffect, useRef, useState } from "react"
import { useWindowDimensions, View } from "react-native"
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
import { moveSlot, slotAfterDrag } from "@/lib/order-drag"
import { cn } from "@/lib/utils"
import { orderItemWidth } from "@/lib/visual-widths"

import type { QuestionKataProps } from "./options"

// The order kata: numbered slots wait on top and the shuffled items below. Tap the items in order
// and each lands in the next open slot, leaving a dashed space in the pool so the rest never shift;
// tap a placed item to send it back, or drag it up or down to another slot. The web's version is
// packages/player/src/order.tsx.
//
// Visual items are one size wherever they sit: each visual is laid out at the same width in the
// pool and in a slot (orderItemWidth), and every card, open slot, and dashed space is as tall as
// the tallest item, so nothing below moves as items are placed or sent back.

const GAP = 8
/** A visual item's padding (p-2) and border, top and bottom together. */
const ITEM_INSET = 2 * (8 + 1)

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
  const { width: windowWidth } = useWindowDimensions()
  const visualWidth = orderItemWidth(windowWidth)
  // Each visual's height as laid out, by item; the tallest sets every visual card's and slot's.
  const [sizes, setSizes] = useState<Record<string, number>>({})
  const measured = Object.values(sizes)
  const itemHeight = measured.length
    ? Math.ceil(Math.max(...measured)) + ITEM_INSET
    : undefined
  const sized = itemHeight ? { minHeight: itemHeight } : undefined

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
          visual ? cn("w-[48%] grow", !sized && "min-h-16") : controlPadding
        )}
        style={visual ? sized : undefined}
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
        style={visual ? sized : undefined}
      >
        {it.visual ? (
          <View
            style={{ width: visualWidth }}
            onLayout={(e) => {
              const h = e.nativeEvent.layout.height
              setSizes((s) => (s[id] === h ? s : { ...s, [id]: h }))
            }}
          >
            <Visual visual={it.visual} label={textOf(id)} plain />
          </View>
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
              // and one line of its text (or, for visuals, the tallest item's height), so it's
              // exactly as tall as a placed item.
              <View
                className={cn(
                  slotStyles,
                  "min-w-0 flex-1",
                  visual ? !sized && "min-h-16" : controlPadding,
                  i === next && "border-foreground/40"
                )}
                style={visual ? sized : undefined}
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
