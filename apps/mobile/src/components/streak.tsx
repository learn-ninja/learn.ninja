import { useEffect, useId, useState, type ReactNode } from "react"
import { Pressable, View } from "react-native"
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withTiming,
} from "react-native-reanimated"
import Svg, {
  Circle,
  ClipPath,
  Defs,
  Path,
  RadialGradient,
  Stop,
} from "react-native-svg"

import {
  LEARN_PER_REST,
  MAX_REST,
  restBeforeToday,
  type DayState,
  type DayStreak,
  type StreakDay,
} from "@workspace/player-core/streak"
import type { Strings } from "@workspace/player-core/strings"

import { Text } from "@/components/ui/text"
import { milestone } from "@/lib/haptics"
import { playEffect, preloadEffects, type Sound } from "@/lib/sound"
import { weekOf } from "@/lib/streak"
import { cn } from "@/lib/utils"
import { colors } from "../../tokens"

// The day streak, drawn as the web draws it (packages/player/src/streak.tsx): a paper lantern
// (chōchin), lit on a day with a finished lesson, a blue outline on a rest day, unlit on a missed
// one; the week as a row of them; the rest days saved and the bar toward the next; and the streak
// screen that lights today's lantern on the day's first finished lesson, with the lantern's
// sound and its flame burning until the learner continues, and a heavy tap as it catches.

/** How a lantern is drawn: lit, a rest day's blue outline, unlit, or a day still to come. */
export type LanternLook = "lit" | "rest" | "unlit" | "ahead"

const LOOKS: Record<LanternLook, { color: string; opacity: number }> = {
  lit: { color: colors.streak.lit, opacity: 1 },
  rest: { color: colors.streak.rest, opacity: 1 },
  unlit: { color: colors.muted.foreground, opacity: 1 },
  // Faded as a whole, so lines that cross don't show darker.
  ahead: { color: colors.muted.foreground, opacity: 0.4 },
}

// The lantern's lines on a 24-unit grid, the web's own.
const PAPER =
  "M7.75 4.67h8.5c2.54 1.46 4.25 4.2 4.25 7.33s-1.71 5.87-4.25 7.33h-8.5C5.21 17.87 3.5 15.13 3.5 12s1.71-5.87 4.25-7.33z"
const STRIPES =
  "M12 4.67v14.66M9.6 4.67C8 7 7.3 9.3 7.3 12s.7 5 2.3 7.33M14.4 4.67c1.6 2.33 2.3 4.63 2.3 7.33s-.7 5-2.3 7.33"
const CAPS =
  "M7.75 4.67V2.54C7.75 1.69 8.44 1 9.29 1h5.42c.85 0 1.54.69 1.54 1.54v2.13M7.75 19.33v2.13c0 .85.69 1.54 1.54 1.54h5.42c.85 0 1.54-.69 1.54-1.54v-2.13"

// The candle's light: the paper yellow-white in the middle and orange at the edges, and a halo of
// the same orange falling off around it as light does (roughly 1 / (1 + d²)).
const PAPER_LIGHT = [
  [0, "#fffbeb"],
  [0.5, "#fde68a"],
  [0.82, "#fb923c"],
  [1, "#ea580c"],
] as const
const HALO = "#f97316"
const EDGE = 8.6
const REACH = 16
const HALO_STOPS = Array.from({ length: 10 }, (_, k) => {
  const t = k / 9
  const start = EDGE / REACH
  const d = t * (REACH - EDGE)
  const spread = (REACH - EDGE) * 0.22
  return {
    offset: start + t * (1 - start),
    alpha: (1 / (1 + (d / spread) ** 2)) * (1 - t),
  }
})
/** How far past the 24-unit box the halo reaches, in grid units. */
const BLEED = 6

/**
 * The streak's lantern. A small one is an outline in its look's color. A `big` lit one is in the
 * foreground color with candlelight in its paper and a halo past its outline, which fade in as it
 * lights (the dark theme's 60% halo).
 */
export function Lantern({
  look,
  size = 16,
  big = false,
  strokeWidth = 2,
}: {
  look: LanternLook
  size?: number
  big?: boolean
  strokeWidth?: number
}) {
  const id = useId().replace(/:/g, "")
  const lit = look === "lit"
  const light = useSharedValue(lit ? 1 : 0)
  useEffect(() => {
    light.value = withTiming(lit ? 1 : 0, { duration: 700 })
  }, [lit, light])
  const lightStyle = useAnimatedStyle(() => ({ opacity: light.value }))
  const { color, opacity } =
    big && lit ? { color: colors.foreground, opacity: 1 } : LOOKS[look]
  const out = (size * BLEED) / 24
  return (
    <View
      aria-hidden
      style={{ width: size, height: size, opacity }}
      pointerEvents="none"
    >
      {big ? (
        <Animated.View
          style={[
            {
              position: "absolute",
              start: -out,
              top: -out,
              width: size + 2 * out,
              height: size + 2 * out,
            },
            lightStyle,
          ]}
        >
          <Svg
            width={size + 2 * out}
            height={size + 2 * out}
            viewBox={`${-BLEED} ${-BLEED} ${24 + 2 * BLEED} ${24 + 2 * BLEED}`}
          >
            <Defs>
              <RadialGradient
                id={`${id}-halo`}
                gradientUnits="userSpaceOnUse"
                cx="12"
                cy="12.4"
                r={REACH}
              >
                {HALO_STOPS.map(({ offset, alpha }) => (
                  <Stop
                    key={offset}
                    offset={offset}
                    stopColor={HALO}
                    stopOpacity={alpha}
                  />
                ))}
              </RadialGradient>
              <RadialGradient
                id={`${id}-paper`}
                gradientUnits="userSpaceOnUse"
                cx="12"
                cy="12.6"
                r="9"
              >
                {PAPER_LIGHT.map(([offset, stop]) => (
                  <Stop key={offset} offset={offset} stopColor={stop} />
                ))}
              </RadialGradient>
            </Defs>
            <Circle
              cx="12"
              cy="12.4"
              r={REACH}
              fill={`url(#${id}-halo)`}
              opacity={0.6}
            />
            <Path d={PAPER} fill={`url(#${id}-paper)`} />
          </Svg>
        </Animated.View>
      ) : null}
      <Svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <Defs>
          <ClipPath id={`${id}-clip`}>
            <Path d={PAPER} />
          </ClipPath>
        </Defs>
        <Path d={STRIPES} clipPath={`url(#${id}-clip)`} />
        <Path d={PAPER} />
        <Path d={CAPS} />
      </Svg>
    </View>
  )
}

/** A lantern that swings once from its top cap (the web's lantern-sway), when `swing` turns on. */
function Swinging({
  swing,
  children,
}: {
  swing: boolean
  children: ReactNode
}) {
  const reduced = useReducedMotion()
  const rot = useSharedValue(0)
  useEffect(() => {
    if (!swing || reduced) return
    const ease = { easing: Easing.inOut(Easing.ease) }
    rot.value = withSequence(
      withTiming(6, { duration: 300, ...ease }),
      withTiming(-4, { duration: 360, ...ease }),
      withTiming(2, { duration: 300, ...ease }),
      withTiming(0, { duration: 240, ...ease })
    )
  }, [swing, reduced, rot])
  const style = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rot.value}deg` }],
  }))
  return (
    <Animated.View style={[{ transformOrigin: "50% 12%" }, style]}>
      {children}
    </Animated.View>
  )
}

const LOOK_OF: Record<DayState | "ahead", LanternLook> = {
  lit: "lit",
  rest: "rest",
  missed: "unlit",
  open: "unlit",
  ahead: "ahead",
}

/** The weekday a week starts on in `lang`'s region, 0 for Sunday; Monday where it can't be told. */
function weekStart(lang: string): number {
  try {
    const locale = new Intl.Locale(lang) as Intl.Locale & {
      getWeekInfo?: () => { firstDay: number }
      weekInfo?: { firstDay: number }
    }
    const first = (locale.getWeekInfo?.() ?? locale.weekInfo)?.firstDay
    if (first) return first % 7
  } catch {
    // An unknown language: Monday, as most of the world counts.
  }
  return 1
}

const dateOf = (day: string) => new Date(`${day}T00:00:00Z`)

/**
 * This calendar week as a row of lanterns over their weekday letters, from the day the language's
 * region starts its week: the days so far, today's letter in the foreground, the rest faint.
 */
export function StreakWeek({
  days,
  lang,
  t,
}: {
  days: StreakDay[]
  lang: string
  t: Strings
}) {
  const today = days.at(-1)?.day
  if (!today) return null
  const week = weekOf(days, weekStart(lang))
  const name = (day: string, weekday: "narrow" | "long") => {
    try {
      return new Intl.DateTimeFormat(lang, {
        weekday,
        timeZone: "UTC",
      }).format(dateOf(day))
    } catch {
      return ""
    }
  }
  const said = {
    lit: t.streakDayLit,
    rest: t.streakDayRest,
    missed: t.streakDayUnlit,
    open: t.streakDayOpen,
    ahead: t.streakDayOpen,
  }
  return (
    <View
      className="flex-row"
      accessibilityRole="list"
      accessibilityLabel={`${t.streakWeek}: ${week
        .map((d) => `${name(d.day, "long")}: ${said[d.state]}`)
        .join(", ")}`}
    >
      {week.map((d) => (
        <View
          key={d.day}
          className="flex-1 items-center gap-1"
          importantForAccessibility="no-hide-descendants"
        >
          <Lantern look={LOOK_OF[d.state]} size={20} />
          <Text
            className={cn(
              "text-xs",
              d.day === today
                ? "font-medium text-foreground"
                : "text-muted-foreground"
            )}
          >
            {name(d.day, "narrow")}
          </Text>
        </View>
      ))}
    </View>
  )
}

/**
 * The rest days: a lantern slot for each one that can be saved (blue once it is), and a bar of
 * the learning days toward the next with the count beside it, back at 0 once it recharges one.
 * While both are saved, a line says so in the bar's place. The title, underlined, explains the
 * rule on a tap. `justFilled` holds the bar full for the moment the recharge happens.
 */
export function RestDays({
  streak,
  justFilled = false,
  t,
}: {
  streak: Pick<DayStreak, "rest" | "toward" | "recharged">
  justFilled?: boolean
  t: Strings
}) {
  const { rest, toward } = streak
  const full = rest >= MAX_REST
  const filled = full || justFilled ? LEARN_PER_REST : toward
  const [infoOpen, setInfoOpen] = useState(false)
  const bar = useSharedValue(filled / LEARN_PER_REST)
  useEffect(() => {
    bar.value = withTiming(filled / LEARN_PER_REST, { duration: 500 })
  }, [filled, bar])
  const fill = useAnimatedStyle(() => ({ width: `${bar.value * 100}%` }))
  return (
    <View className="gap-2">
      <View className="flex-row items-center justify-between gap-3">
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ expanded: infoOpen }}
          accessibilityHint={t.restInfo(LEARN_PER_REST, MAX_REST)}
          onPress={() => setInfoOpen((o) => !o)}
          hitSlop={8}
        >
          <Text
            className="text-sm text-foreground underline"
            style={{ textDecorationStyle: "dotted" }}
          >
            {t.restTitle}
          </Text>
        </Pressable>
        <View
          className="flex-row gap-1"
          accessible
          accessibilityRole="image"
          accessibilityLabel={t.restSaved(rest, MAX_REST)}
        >
          {Array.from({ length: MAX_REST }, (_, i) => (
            <Lantern key={i} look={i < rest ? "rest" : "ahead"} />
          ))}
        </View>
      </View>
      {infoOpen ? (
        <Text className="text-start text-sm text-muted-foreground">
          {t.restInfo(LEARN_PER_REST, MAX_REST)}
        </Text>
      ) : null}
      {full && !justFilled ? (
        <Text className="text-start text-sm text-muted-foreground">
          {t.restFull}
        </Text>
      ) : (
        <View
          className="flex-row items-center gap-3"
          accessible
          accessibilityRole="progressbar"
          accessibilityLabel={t.restProgress}
          accessibilityValue={{
            min: 0,
            max: LEARN_PER_REST,
            now: filled,
            text: t.restProgressValue(filled, LEARN_PER_REST),
          }}
        >
          <View className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
            <Animated.View
              className="h-full rounded-full"
              style={[{ backgroundColor: colors.streak.rest }, fill]}
            />
          </View>
          <Text className="text-xs text-muted-foreground">
            {t.restProgressValue(filled, LEARN_PER_REST)}
          </Text>
        </View>
      )}
    </View>
  )
}

/** How long the screen waits before lighting today's lantern, so the learner sees it happen. */
const LIGHT_DELAY = 500
/** How long a bar that just recharged a rest day stays full before it empties for the next. */
const EMPTY_DELAY = 1200
/** How long after the lantern lights its flame settles into burning. */
const FLAME_DELAY = 300
/** How long the flame takes to fade when the learner continues. */
const FLAME_FADE = 300

/**
 * The screen before the wrap-up on the day's first finished lesson, as the web's StreakScreen: a
 * big lantern that lights and swings once with a heavy tap, the count ticking up under it, then
 * the week with today lit and a line under it, and the rest days, whose bar fills with today. Under
 * reduced motion it opens lit. With `sound`, the lantern is heard lighting and its flame burns until
 * the learner continues. Continue is in the tray.
 */
export function StreakScreen({
  streak,
  sound,
  lang,
  t,
}: {
  streak: DayStreak
  sound: boolean
  lang: string
  t: Strings
}) {
  const reduced = useReducedMotion()
  const [lit, setLit] = useState(false)
  const [emptied, setEmptied] = useState(false)
  useEffect(() => {
    if (sound) preloadEffects(["lantern", "flame"])
    const delay = reduced ? 0 : LIGHT_DELAY
    const sounds: Sound[] = []
    const ids = [
      setTimeout(() => {
        setLit(true)
        milestone()
        if (sound) sounds.push(playEffect("lantern"))
      }, delay),
      setTimeout(() => {
        if (sound) sounds.push(playEffect("flame", { loop: true }))
      }, delay + FLAME_DELAY),
      setTimeout(() => setEmptied(true), delay + EMPTY_DELAY),
    ]
    return () => {
      ids.forEach(clearTimeout)
      sounds.forEach((s) => s.stop(FLAME_FADE))
    }
  }, [sound, reduced])

  const { current, longest } = streak
  // Until it lights, the count and the week are yesterday's.
  const shown = lit ? current : Math.max(current - 1, 0)
  const days = lit
    ? streak.days
    : streak.days.map((d, i) =>
        i === streak.days.length - 1 ? { ...d, state: "open" as const } : d
      )
  const line =
    current > 1 ? t.streakLit : longest > 1 ? t.streakAgain : t.streakStarts
  return (
    <View className="items-center gap-8">
      <Swinging swing={lit}>
        <Lantern
          look={lit ? "lit" : "unlit"}
          big
          size={112}
          strokeWidth={1.25}
        />
      </Swinging>
      <View
        className="items-center"
        accessible
        accessibilityRole="header"
        accessibilityLabel={t.streakDays(current)}
      >
        <Text
          className="text-4xl font-bold"
          style={{
            color: lit ? colors.streak.count : colors.muted.foreground,
            fontVariant: ["tabular-nums"],
          }}
        >
          {shown}
        </Text>
        <Text className="text-2xl font-semibold">{t.streakUnit(current)}</Text>
      </View>
      <View className="w-full max-w-xs gap-4 rounded-xl border border-border bg-card p-4 shadow-xs">
        <StreakWeek days={days} lang={lang} t={t} />
        <Text className="text-center text-sm font-medium text-muted-foreground">
          {line}
        </Text>
        <View className="border-t border-border pt-3">
          <RestDays
            streak={lit ? streak : restBeforeToday(streak)}
            justFilled={lit && !emptied && streak.recharged}
            t={t}
          />
        </View>
      </View>
    </View>
  )
}

/**
 * The streak on the wrap-up, in a card under the score: the count beside a lantern, and the week.
 * The web shows it in its header's lantern instead; the app has no account control there yet.
 */
export function StreakCard({
  streak,
  lang,
  t,
}: {
  streak: DayStreak
  lang: string
  t: Strings
}) {
  const today = streak.days.at(-1)?.state
  return (
    <View className="w-full gap-3 rounded-xl border border-border bg-card p-4 shadow-xs">
      <View className="flex-row items-center gap-2">
        <Lantern look={today === "lit" ? "lit" : "unlit"} />
        <Text className="text-sm font-medium">
          {t.streakDays(streak.current)}
        </Text>
      </View>
      <StreakWeek days={streak.days} lang={lang} t={t} />
    </View>
  )
}
