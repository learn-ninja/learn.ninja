import { useEffect, useRef, useState } from "react"
import { Pressable, View } from "react-native"
import { Gesture, GestureDetector } from "react-native-gesture-handler"
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated"

import { POOL } from "@workspace/player-core/check"
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
import { tap } from "@/lib/haptics"
import { binAt, moveItem, type Box } from "@/lib/sort-drop"
import { cn } from "@/lib/utils"
import { fontSize, LESSON_TEXT_SCALE } from "../../../tokens"

import type { QuestionKataProps } from "./options"

// The sort kata as the web deals it on phones (packages/player/src/sort.tsx): the next unsorted
// item is a card on top of a deck with a count above it, and each group is a bin below (side by
// side for two groups, stacked for more). Tap a bin, or drag the card into it, and the item lands
// in the bin as a chip; tap a chip to put it back on top of the deck.

export function SortKata({
  kata,
  answer,
  setAnswer,
  marks,
  locked,
  t,
}: QuestionKataProps) {
  // The item last taken back out of a bin, which goes on top of the deck.
  const [back, setBack] = useState<string | null>(null)
  const { style: shakeStyle, shake } = useShake()
  const wrong = Object.keys(marks)
    .filter((id) => marks[id] === "wrong")
    .join(",")
  useEffect(() => {
    if (wrong) shake()
    // Shakes once per set of wrong marks.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wrong])
  // Where the bins and the card sit, for a drop. Each is laid out in its own parent, so the deck
  // and the bins' row are kept too, to bring both into the kata's coordinates.
  const bins = useRef<(Box | undefined)[]>([])
  const card = useRef<Box | undefined>(undefined)
  const deck = useRef<Box | undefined>(undefined)
  const row = useRef<Box | undefined>(undefined)

  const groups = kata.type === "sort" ? kata.groups : []
  const items = kata.type === "sort" ? kata.items : []
  const zones = answer.kind === "zones" ? answer.zones : {}
  // Rows keep the order they started in, so nothing jumps when an item changes lanes.
  const [order] = useState(() => [
    ...(zones[POOL] ?? []),
    ...groups.flatMap((g) => zones[g.id] ?? []),
  ])
  if (kata.type !== "sort" || answer.kind !== "zones") return null

  const n = groups.length
  const rows = [
    ...order,
    ...items.map((i) => i.id).filter((id) => !order.includes(id)),
  ]
  const index = new Map(items.map((it, i) => [it.id, i]))
  const laneOf = (id: string) =>
    groups.findIndex((g) => zones[g.id]?.includes(id))
  const place = (id: string, lane: number, before?: () => void) => {
    const zone = lane < 0 ? POOL : groups[lane]!.id
    tap()
    before?.()
    setAnswer({ kind: "zones", zones: moveItem(zones, id, zone) })
  }
  const current =
    back && laneOf(back) < 0 ? back : rows.find((id) => laneOf(id) < 0)
  const sorted = rows.filter((id) => laneOf(id) >= 0).length

  return (
    <Animated.View className="gap-4" style={shakeStyle}>
      {current && !locked ? (
        <View
          className="gap-2"
          onLayout={(e) => {
            deck.current = e.nativeEvent.layout
          }}
        >
          <Text className="text-center text-xs font-medium text-muted-foreground tabular-nums">
            {t.sortCount(sorted + 1, rows.length)}
          </Text>
          {/* While more items wait, the next card's edge shows under the top one. */}
          <View
            className={cn("relative", sorted < rows.length - 1 && "pb-1.5")}
            onLayout={(e) => {
              card.current = e.nativeEvent.layout
            }}
          >
            {sorted < rows.length - 1 ? (
              <View
                aria-hidden
                className="absolute inset-x-3 top-3 bottom-0 rounded-xl border border-border bg-card"
              />
            ) : null}
            <DeckCard
              key={current}
              text={items[index.get(current)!]!.text}
              onDrop={(x, y) => {
                const c = card.current
                const d = deck.current
                const r = row.current
                const lane = binAt(
                  bins.current,
                  (d?.x ?? 0) + (c?.x ?? 0) + x,
                  (d?.y ?? 0) + (c?.y ?? 0) + y,
                  { x: r?.x ?? 0, y: r?.y ?? 0 }
                )
                if (lane >= 0) place(current, lane)
                return lane >= 0
              }}
            />
          </View>
        </View>
      ) : null}
      <View
        className={cn("gap-2", n === 2 && "flex-row")}
        onLayout={(e) => {
          row.current = e.nativeEvent.layout
        }}
      >
        {groups.map((g, i) => {
          const placed = zones[g.id] ?? []
          return (
            <View
              key={g.id}
              onLayout={(e) => {
                bins.current[i] = e.nativeEvent.layout
              }}
              className={cn(
                "relative gap-2 rounded-xl border border-border p-2",
                n === 2 && "flex-1"
              )}
            >
              <Text className="text-lesson-sm px-1 text-center font-semibold">
                {g.label}
              </Text>
              {current && !locked ? (
                // The open space takes the whole bin's taps, and it comes first, so it stays put
                // as chips pile up and quick taps in one place keep landing.
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={g.label}
                  onPress={() => place(current, i)}
                  className={cn(
                    slotStyles,
                    controlPadding,
                    "active:bg-surface-active items-center"
                  )}
                >
                  <Text className="text-lesson-sm text-muted-foreground">
                    {t.sortHere}
                  </Text>
                </Pressable>
              ) : placed.length ? null : (
                // An empty bin stays outlined, even after checking.
                <View aria-hidden className={cn(slotStyles, controlPadding)}>
                  <Text className="text-lesson-sm">{"​"}</Text>
                </View>
              )}
              {placed.length ? (
                <View className="flex-row flex-wrap gap-1.5">
                  {placed.map((id) => {
                    const it = items[index.get(id)!]!
                    return (
                      <Control
                        key={id}
                        mark={marks[id]}
                        disabled={locked}
                        accessibilityLabel={[plainText(it.text), g.label].join(
                          ", "
                        )}
                        onPress={() => place(id, -1, () => setBack(id))}
                        className="max-w-full px-3 py-1"
                      >
                        <RichText
                          text={it.text}
                          size={CONTROL_TEXT_SIZE}
                          className="text-lesson-sm font-medium"
                        />
                      </Control>
                    )
                  })}
                </View>
              ) : null}
            </View>
          )
        })}
      </View>
    </Animated.View>
  )
}

/**
 * The card on top of the deck: a card the learner is meant to read, not a control. It can be
 * dragged into a bin: it follows the finger on the UI thread, drops where it's let go, and springs
 * back when that's nowhere.
 */
function DeckCard({
  text,
  onDrop,
}: {
  text: string
  /** The card's centre offset from where it started; true when it landed in a bin. */
  onDrop: (dx: number, dy: number) => boolean
}) {
  const x = useSharedValue(0)
  const y = useSharedValue(0)
  const lifted = useSharedValue(0)
  const size = useRef({ width: 0, height: 0 })
  const drop = (dx: number, dy: number) => {
    const { width, height } = size.current
    if (!onDrop(dx + width / 2, dy + height / 2)) {
      x.value = withSpring(0, { damping: 18, stiffness: 180 })
      y.value = withSpring(0, { damping: 18, stiffness: 180 })
    } else {
      x.value = 0
      y.value = 0
    }
  }
  const pan = Gesture.Pan()
    .activateAfterLongPress(120)
    .onStart(() => {
      lifted.value = withTiming(1, { duration: 120 })
    })
    .onUpdate((e) => {
      x.value = e.translationX
      y.value = e.translationY
    })
    .onFinalize((e) => {
      lifted.value = withTiming(0, { duration: 120 })
      runOnJS(drop)(e.translationX, e.translationY)
    })
  const style = useAnimatedStyle(() => ({
    transform: [
      { translateX: x.value },
      { translateY: y.value },
      { scale: 1 + lifted.value * 0.03 },
    ],
    zIndex: lifted.value > 0 ? 10 : 0,
  }))
  return (
    <GestureDetector gesture={pan}>
      <Animated.View
        entering={undefined}
        style={style}
        onLayout={(e) => {
          size.current = e.nativeEvent.layout
        }}
        className="rounded-xl border border-border bg-card px-4 py-6 shadow-xs"
      >
        <RichText
          text={text}
          size={fontSize.base[0] * LESSON_TEXT_SCALE}
          className="text-lesson-base text-center font-semibold"
        />
      </Animated.View>
    </GestureDetector>
  )
}
