import { useRef, useState, type ComponentRef } from "react"
import { Pressable, ScrollView, View } from "react-native"
import Svg, { Rect, Text as SvgText } from "react-native-svg"

import type { Strings } from "@workspace/player-core/strings"

import { useDirection } from "@/components/direction"
import { Text } from "@/components/ui/text"
import { CELL, columnX, describeDay, monthLabels, STEP } from "@/lib/activity"
import type { ActivityCell, ActivityGridData } from "@/lib/feed"
import { colors, fontSize } from "../../../tokens"

// A year of learning as GitHub draws a year of commits, after the web's ActivityGrid
// (apps/web/components/explore/activity-grid.tsx): 53 week columns, Sunday at the top, a shade per
// day, month labels above, and under it the year's total (a tap shows the streaks) and the
// Less/More legend. A rest day that kept the streak is the lantern's blue. On a phone it scrolls
// sideways, starting at the newest weeks; a tap on a day says what it holds, as the web's tooltip.

const LEVEL = [
  colors.activity[0],
  colors.activity[1],
  colors.activity[2],
  colors.activity[3],
  colors.activity[4],
] as const
const MONTH_ROW = 16
/** The web's ring-foreground/5 around each cell. */
const RING = "rgba(250, 250, 250, 0.05)"

const fillOf = (cell: ActivityCell) =>
  cell.rest ? colors.activity.rest : LEVEL[cell.level]

export function ActivityGrid({
  grid,
  lang,
  t,
}: {
  grid: ActivityGridData
  lang: string
  t: Strings
}) {
  const rtl = useDirection() === "rtl"
  const [picked, setPicked] = useState<ActivityCell | null>(null)
  const [streaks, setStreaks] = useState(false)
  const scroller = useRef<ComponentRef<typeof ScrollView>>(null)
  const columns = grid.columns.length
  const width = columns * STEP - (STEP - CELL)
  const height = MONTH_ROW + 7 * STEP - (STEP - CELL)
  return (
    <View className="gap-2">
      <ScrollView
        ref={scroller}
        horizontal
        showsHorizontalScrollIndicator={false}
        // Newest weeks first: the end, which is the left in right to left.
        onContentSizeChange={() => {
          if (!rtl) scroller.current?.scrollToEnd({ animated: false })
        }}
        className="-mx-4"
        contentContainerClassName="px-4"
      >
        <Svg
          width={width}
          height={height}
          accessible
          accessibilityLabel={`${t.profile.grid}. ${t.profile.yearTotal(grid.total)}`}
        >
          {monthLabels(grid, lang).map((m) => (
            <SvgText
              key={m.column}
              x={
                rtl
                  ? columnX(m.column, columns, true) + CELL
                  : columnX(m.column, columns, false)
              }
              y={fontSize.xs[0]}
              fontSize={fontSize.xs[0]}
              fill={colors.muted.foreground}
              textAnchor={rtl ? "end" : "start"}
            >
              {m.label}
            </SvgText>
          ))}
          {grid.columns.map((week, col) =>
            week.map((cell, row) =>
              cell ? (
                <Rect
                  key={cell.day}
                  x={columnX(col, columns, rtl)}
                  y={MONTH_ROW + row * STEP}
                  width={CELL}
                  height={CELL}
                  rx={2}
                  fill={fillOf(cell)}
                  stroke={picked?.day === cell.day ? colors.ring : RING}
                  strokeWidth={1}
                  onPress={() =>
                    setPicked((p) => (p?.day === cell.day ? null : cell))
                  }
                />
              ) : null
            )
          )}
        </Svg>
      </ScrollView>
      {picked ? (
        <Text
          className="text-xs text-muted-foreground"
          accessibilityLiveRegion="polite"
        >
          {describeDay(picked, lang, t)}
        </Text>
      ) : null}
      <View className="flex-row items-center justify-between gap-4">
        <Pressable
          onPress={() => setStreaks((s) => !s)}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityHint={
            grid.streak.longest > 0
              ? t.profile.streaks(grid.streak.current, grid.streak.longest)
              : t.profile.noStreak
          }
        >
          <Text className="text-xs text-muted-foreground underline">
            {t.profile.yearTotal(grid.total)}
          </Text>
        </Pressable>
        <View className="flex-row items-center gap-[3px]" aria-hidden>
          <Text className="me-1 text-xs text-muted-foreground">
            {t.profile.less}
          </Text>
          {LEVEL.map((color, level) => (
            <View
              key={level}
              className="h-2.5 w-2.5"
              // The web's rounded-xs (2 points), which Tailwind 3 doesn't have.
              style={{
                backgroundColor: color,
                borderColor: RING,
                borderWidth: 1,
                borderRadius: 2,
              }}
            />
          ))}
          <Text className="ms-1 text-xs text-muted-foreground">
            {t.profile.more}
          </Text>
        </View>
      </View>
      {streaks ? (
        <Text
          className="text-xs text-muted-foreground"
          accessibilityLiveRegion="polite"
        >
          {grid.streak.longest > 0
            ? t.profile.streaks(grid.streak.current, grid.streak.longest)
            : t.profile.noStreak}
        </Text>
      ) : null}
    </View>
  )
}
