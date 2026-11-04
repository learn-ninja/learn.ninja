import { useEffect, useState, type ReactNode } from "react"
import { Pressable, View } from "react-native"
import Animated, {
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import Svg, { Path } from "react-native-svg"

import type { QuestionCount } from "@workspace/player-core/flow"
import type { Strings } from "@workspace/player-core/strings"

import { Button } from "@/components/ui/button"
import { Text } from "@/components/ui/text"
import { colors } from "../../tokens"

// The frame around every lesson screen, as the web draws it on a phone (packages/player/src/shell.tsx
// and the tray in lesson-player.tsx): a header with the way home, the lesson's title on the intro
// and the progress bar after it, then the screen, then the tray with the screen's main action.
// The web's lesson menu (Share, Restart) and settings come with the app's own menus in phase 4.

/**
 * The header: 56 points tall under the status bar, 16 in from the sides. The way home is the
 * web's logo button; in the app it's a close mark, since the lesson is a screen pushed over home.
 */
export function LessonHeader({
  title,
  showProgress,
  progress,
  count,
  startedAt,
  endedAt,
  onClose,
  t,
}: {
  title: string
  /** False on the intro and the wrap-up: the title shows instead. */
  showProgress: boolean
  /** How far through the lesson, 0–100. */
  progress: number
  count: QuestionCount
  startedAt?: number
  endedAt?: number
  onClose: () => void
  t: Strings
}) {
  const insets = useSafeAreaInsets()
  return (
    // Above the lesson, so the progress details can open over it.
    <View className="z-10" style={{ paddingTop: insets.top }}>
      <View className="h-14 flex-row items-center gap-3 px-4">
        <Button
          variant="ghost"
          size="icon"
          // The web's icon-sm (32px) with the phone's larger tap area around it.
          className="h-8 w-8"
          hitSlop={6}
          onPress={onClose}
          accessibilityLabel={t.home}
        >
          <CloseIcon />
        </Button>
        {showProgress ? (
          <LessonProgress
            value={progress}
            count={count}
            startedAt={startedAt}
            endedAt={endedAt}
            t={t}
          />
        ) : (
          <Text
            numberOfLines={1}
            className="min-w-0 flex-1 text-sm font-medium"
            accessibilityRole="header"
          >
            {title}
          </Text>
        )}
        {/* Balances the close button, so the bar sits in the middle as the web's does. */}
        <View className="h-8 w-8" />
      </View>
    </View>
  )
}

/** Lucide's X, the header's close mark. */
function CloseIcon() {
  return (
    <Svg
      width={16}
      height={16}
      viewBox="0 0 24 24"
      fill="none"
      stroke={colors.foreground}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <Path d="M18 6 6 18" />
      <Path d="m6 6 12 12" />
    </Svg>
  )
}

/**
 * One bar for the whole lesson, 10 points tall and fully rounded. As on the web, the question
 * count and the time spent wait behind it: a tap shows them under the bar, another hides them.
 */
function LessonProgress({
  value,
  count,
  startedAt,
  endedAt,
  t,
}: {
  value: number
  count: QuestionCount
  startedAt?: number
  endedAt?: number
  t: Strings
}) {
  const [open, setOpen] = useState(false)
  const counter = count.total > 0 ? `${count.current} / ${count.total}` : null
  // The fill eases to its new width (the web's transition-all duration-500), on the UI thread.
  const width = useSharedValue(value)
  useEffect(() => {
    width.value = withTiming(Math.max(0, Math.min(100, value)), {
      duration: 500,
    })
  }, [value, width])
  const fill = useAnimatedStyle(() => ({ width: `${width.value}%` }))
  return (
    <Animated.View entering={FadeIn.duration(500)} className="min-w-0 flex-1">
      <Pressable
        onPress={() => setOpen((o) => !o)}
        className="h-7 justify-center"
        accessibilityRole="progressbar"
        accessibilityLabel={counter ? `${t.progress}: ${counter}` : t.progress}
        accessibilityValue={{ min: 0, max: 100, now: Math.round(value) }}
      >
        <View className="h-2.5 overflow-hidden rounded-full bg-muted">
          <Animated.View
            className="h-full rounded-full bg-primary"
            style={fill}
          />
        </View>
      </Pressable>
      {open ? (
        // The web's tooltip, under the bar: inverted colors, small text, figures that don't jump.
        <Animated.View
          entering={FadeIn.duration(150)}
          exiting={FadeOut.duration(100)}
          className="absolute top-9 z-10 flex-row gap-1.5 self-center rounded-md bg-foreground px-3 py-1.5"
          accessibilityLiveRegion="polite"
        >
          {counter ? (
            <>
              <Text className="text-xs text-background">
                {count.fixing ? t.fixing : t.progressLabel}
              </Text>
              <Text className="text-xs text-background tabular-nums">
                {counter}
              </Text>
              <Text className="text-xs text-background" aria-hidden>
                ·
              </Text>
            </>
          ) : null}
          <Elapsed startedAt={startedAt} endedAt={endedAt} />
        </Animated.View>
      ) : null}
    </Animated.View>
  )
}

/** Time spent as MM:SS (H:MM:SS past an hour), ticking while it's on screen. */
function Elapsed({
  startedAt,
  endedAt,
}: {
  startedAt?: number
  endedAt?: number
}) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (endedAt) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [endedAt])
  const seconds = startedAt
    ? Math.max(0, Math.floor(((endedAt ?? now) - startedAt) / 1000))
    : 0
  return (
    <Text className="text-xs text-background tabular-nums">
      {formatElapsed(seconds)}
    </Text>
  )
}

export function formatElapsed(seconds: number): string {
  const two = (n: number) => String(n).padStart(2, "0")
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  return h > 0 ? `${h}:${two(m)}:${two(s)}` : `${two(m)}:${two(s)}`
}

/**
 * The tray at the foot of the screen: on a phone it's as dark as the lesson, with the screen's
 * buttons across its width at a thumb-sized height (the web's PHONE_BAR), clear of the home bar.
 */
export function LessonTray({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets()
  return (
    <View
      className="flex-row gap-2 border-t border-transparent px-4 pt-4"
      style={{ paddingBottom: Math.max(16, insets.bottom) }}
    >
      {children}
    </View>
  )
}

/** The tray's main button: a full-width pill, 48 points tall, with 16-point text. */
export function TrayButton({
  label,
  onPress,
  disabled,
}: {
  label: string
  onPress: () => void
  disabled?: boolean
}) {
  return (
    <Button
      size="lg"
      className="h-12 flex-1 rounded-full px-4"
      onPress={onPress}
      disabled={disabled}
    >
      <Text className="text-base">{label}</Text>
    </Button>
  )
}
