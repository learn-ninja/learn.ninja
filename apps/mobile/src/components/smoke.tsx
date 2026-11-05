import { useCallback, useEffect, useRef, useState, type ReactNode } from "react"
import { View, type LayoutChangeEvent } from "react-native"
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated"

import { Text } from "@/components/ui/text"
import { smokeWords } from "@/lib/smoke-words"
import { cn } from "@/lib/utils"

// The smoke on the intro, after the web's (Aura, SmokeWords, and the vanish classes in
// packages/player/src/ninja.tsx and globals.css): overlapping puffs of two smoke textures, each
// turning slowly at its own pace, behind the title; and "Start lesson" making the intro vanish,
// the smoke flaring and blowing outward, each title word drifting off one after another, the rest
// fading up and away. Phones have no blur to spare, so the words skew and fade without it. Still
// under reduced motion: the smoke stands, and the intro just goes.

// The puffs: where each sits (% of the smoke box), its size (% of the box's width), its starting
// turn, how long one turn takes (s), which way it turns, and how strong it is. The web's own.
const PUFFS: {
  x: number
  y: number
  size: number
  turn: number
  secs: number
  back?: boolean
  alpha: number
}[] = [
  { x: 50, y: 52, size: 60, turn: 0, secs: 70, alpha: 0.85 },
  { x: 36, y: 46, size: 48, turn: 120, secs: 54, back: true, alpha: 0.75 },
  { x: 64, y: 44, size: 50, turn: 210, secs: 62, alpha: 0.75 },
  { x: 30, y: 64, size: 42, turn: 40, secs: 48, alpha: 0.6 },
  { x: 70, y: 63, size: 44, turn: 300, secs: 58, back: true, alpha: 0.6 },
  { x: 50, y: 33, size: 42, turn: 80, secs: 44, back: true, alpha: 0.55 },
  { x: 52, y: 70, size: 46, turn: 160, secs: 66, alpha: 0.55 },
  { x: 20, y: 48, size: 34, turn: 250, secs: 40, alpha: 0.45 },
  { x: 80, y: 46, size: 34, turn: 20, secs: 46, back: true, alpha: 0.45 },
]

const TEXTURES = [
  require("../../assets/smoke/smoke-a.webp"),
  require("../../assets/smoke/smoke-b.webp"),
] as const

/** The smoke's strength in the dark theme (--smoke-a in globals.css). */
const STRENGTH = 0.6
/** The intro's vanishing, in ms: the burst, and the wait before the first kata. */
export const VANISH_MS = 650

const BURST_EASE = Easing.bezier(0.2, 0.7, 0.2, 1)

/**
 * The smoke behind the intro, filling its parent: a box 96% of the width (780 at most) at the web's
 * 600 by 420, centred a little below the middle. `shift` moves it to follow the content (when the
 * ninja is off, his slot folds away). `vanishing` flares it and blows the puffs outward.
 */
export function Aura({
  shift = 0,
  vanishing = false,
}: {
  shift?: number
  vanishing?: boolean
}) {
  const [box, setBox] = useState({ width: 0, height: 0 })
  const reduced = useReducedMotion()
  const strength = useSharedValue(STRENGTH)
  useEffect(() => {
    if (!vanishing || reduced) return
    strength.value = withSequence(
      withTiming(Math.min(1, STRENGTH * 1.6), {
        duration: VANISH_MS * 0.3,
        easing: Easing.out(Easing.ease),
      }),
      withTiming(0, {
        duration: VANISH_MS * 0.7,
        easing: Easing.out(Easing.ease),
      })
    )
  }, [vanishing, reduced, strength])
  const style = useAnimatedStyle(() => ({ opacity: strength.value }))
  const onLayout = (e: LayoutChangeEvent) =>
    setBox({
      width: e.nativeEvent.layout.width,
      height: e.nativeEvent.layout.height,
    })
  const width = Math.min(box.width * 0.96, 780)
  const height = (width * 420) / 600
  return (
    <View
      aria-hidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
      className="absolute inset-0 overflow-hidden"
      onLayout={onLayout}
    >
      {width > 0 ? (
        <Animated.View
          style={[
            {
              position: "absolute",
              width,
              height,
              start: (box.width - width) / 2,
              top: box.height * 0.54 + shift - height / 2,
            },
            style,
          ]}
        >
          {PUFFS.map((p, i) => (
            <Puff
              key={i}
              puff={p}
              width={width}
              height={height}
              texture={TEXTURES[i % 2]!}
              vanishing={vanishing}
              still={reduced}
            />
          ))}
        </Animated.View>
      ) : null}
    </View>
  )
}

function Puff({
  puff,
  width,
  height,
  texture,
  vanishing,
  still,
}: {
  puff: (typeof PUFFS)[number]
  width: number
  height: number
  texture: number
  vanishing: boolean
  still: boolean
}) {
  const turn = useSharedValue(puff.turn)
  const burst = useSharedValue(0)
  useEffect(() => {
    if (still) return
    // One turn after another from its starting turn, at its own pace and direction.
    turn.value = puff.turn
    turn.value = withRepeat(
      withTiming(puff.turn + (puff.back ? -360 : 360), {
        duration: puff.secs * 1000,
        easing: Easing.linear,
      }),
      -1
    )
    return () => cancelAnimation(turn)
  }, [still, puff, turn])
  useEffect(() => {
    if (!vanishing || still) return
    burst.value = withTiming(1, { duration: VANISH_MS, easing: BURST_EASE })
  }, [vanishing, still, burst])
  // Out from the middle, so the burst spreads.
  const bx = (puff.x - 50) * 4
  const by = (puff.y - 50) * 4 - 40
  const style = useAnimatedStyle(() => ({
    transform: [
      { translateX: bx * burst.value },
      { translateY: by * burst.value },
      { scale: 1 + 0.5 * burst.value },
    ],
  }))
  const spin = useAnimatedStyle(() => ({
    transform: [{ rotate: `${turn.value}deg` }],
  }))
  const size = (puff.size / 100) * width
  return (
    <Animated.View
      style={[
        {
          position: "absolute",
          left: (puff.x / 100) * width - size / 2,
          top: (puff.y / 100) * height - size / 2,
          width: size,
          height: size,
          opacity: puff.alpha,
        },
        style,
      ]}
    >
      <Animated.Image
        source={texture}
        resizeMode="stretch"
        style={[{ width: size, height: size }, spin]}
      />
    </Animated.View>
  )
}

/**
 * Text that vanishes into smoke word by word once `vanishing` turns on: each word skews, turns,
 * grows, and drifts up toward the end side, every other one a little further. Words, not letters,
 * so joined scripts like Arabic keep their shapes. `step` is the delay between words (ms).
 */
export function SmokeWords({
  text,
  vanishing,
  step = 40,
  rtl = false,
  className,
}: {
  text: string
  vanishing: boolean
  step?: number
  /** The text's own direction (the lesson's), which the words drift with. */
  rtl?: boolean
  className?: string
}) {
  const words = smokeWords(text)
  return (
    <View
      className="flex-row flex-wrap justify-center"
      style={{ direction: rtl ? "rtl" : "ltr" }}
      accessible
      accessibilityRole="header"
      accessibilityLabel={text}
    >
      {words.map((word, i) => (
        <SmokeWord
          key={i}
          word={word}
          delay={Math.min(i * step, 360)}
          mirror={i % 2 === 1}
          dir={rtl ? -1 : 1}
          vanishing={vanishing}
          className={className}
        />
      ))}
    </View>
  )
}

function SmokeWord({
  word,
  delay,
  mirror,
  dir,
  vanishing,
  className,
}: {
  word: string
  delay: number
  mirror: boolean
  dir: 1 | -1
  vanishing: boolean
  className?: string
}) {
  const reduced = useReducedMotion()
  const t = useSharedValue(0)
  useEffect(() => {
    if (!vanishing || reduced) return
    t.value = withDelay(
      delay,
      withTiming(1, {
        duration: 500,
        easing: Easing.bezier(0.4, 0, 0.7, 1),
      })
    )
  }, [vanishing, reduced, delay, t])
  // The web's smoky and smoky-mirror keyframes, at 16 points to the rem.
  const far = mirror ? { x: 57.6, y: -38.4, s: 1.7 } : { x: 48, y: -32, s: 1.4 }
  const skew = (mirror ? -40 : 40) * dir
  const style = useAnimatedStyle(() => ({
    opacity: 1 - t.value,
    transform: [
      { translateX: dir * far.x * t.value },
      { translateY: far.y * t.value },
      { rotate: `${dir * -14 * t.value}deg` },
      { skewX: `${skew * t.value}deg` },
      { scale: 1 + (far.s - 1) * t.value },
    ],
  }))
  return (
    <Animated.View style={style}>
      {/* In the title's own direction, so a word's trailing space falls between the words
          whatever the interface's direction. */}
      <Text
        className={cn(className)}
        style={{ writingDirection: dir === -1 ? "rtl" : "ltr" }}
      >
        {word}
      </Text>
    </Animated.View>
  )
}

/** The rest of the intro going with it: fading up and away as a block (the web's vanish-fade). */
export function VanishFade({
  vanishing,
  children,
}: {
  vanishing: boolean
  children: ReactNode
}) {
  const reduced = useReducedMotion()
  const t = useSharedValue(0)
  useEffect(() => {
    if (!vanishing || reduced) return
    t.value = withDelay(
      100,
      withTiming(1, { duration: 450, easing: Easing.in(Easing.ease) })
    )
  }, [vanishing, reduced, t])
  const style = useAnimatedStyle(() => ({
    opacity: 1 - t.value,
    transform: [{ translateY: -12 * t.value }],
  }))
  return <Animated.View style={style}>{children}</Animated.View>
}

/**
 * "Start lesson" making the intro vanish: on while the smoke burst plays, then `then` moves on.
 * Under reduced motion it moves on at once. A second press while it vanishes does nothing.
 */
export function useIntroVanish() {
  const reduced = useReducedMotion()
  const [vanishing, setVanishing] = useState(false)
  const busy = useRef(false)
  useEffect(() => () => clearTimeout(timer.current), [])
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const vanish = useCallback(
    (then: () => void) => {
      if (busy.current) return
      if (reduced) {
        then()
        return
      }
      busy.current = true
      setVanishing(true)
      timer.current = setTimeout(() => {
        busy.current = false
        setVanishing(false)
        then()
      }, VANISH_MS)
    },
    [reduced]
  )
  return { vanishing, vanish }
}
