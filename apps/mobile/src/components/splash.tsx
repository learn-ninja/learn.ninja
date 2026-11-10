import * as SplashScreen from "expo-splash-screen"
import { useEffect, useRef, useState } from "react"
import { useWindowDimensions, View } from "react-native"
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from "react-native-reanimated"

import { Aura } from "@/components/smoke"
import { useSession } from "@/lib/session"
import {
  SPLASH_BACKGROUND,
  SPLASH_BURST,
  SPLASH_GATHER,
  SPLASH_MAX_WAIT,
  SPLASH_SIZE,
} from "@/lib/splash"

// The handoff from the launch screen. The native launch screen (expo-splash-screen, app.config.ts)
// can't move, so this draws the same mark at the same place over the app, takes over from it once
// the mark has painted, and holds until the session is known (or SPLASH_MAX_WAIT has passed).
// Then the ninja vanishes the way a lesson's intro does: the smoke gathers behind him, flares and
// blows outward (Aura in smoke.tsx), and he and the dark go with it, showing the app underneath.
// Under reduced motion it just fades.

// Kept up from launch until the handoff below takes over (expo-router hides it on the first render
// otherwise). Module scope, so it runs before anything renders.
void SplashScreen.preventAutoHideAsync().catch(() => {})

const MARK = require("../../assets/images/splash-icon.png")

type Phase = "hold" | "gather" | "burst" | "done"

export function Splash() {
  const session = useSession()
  const reduced = useReducedMotion()
  const { height } = useWindowDimensions()
  const [painted, setPainted] = useState(false)
  const [waited, setWaited] = useState(false)
  const [phase, setPhase] = useState<Phase>("hold")
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])

  const ready = session.state !== "loading" || waited

  // The native launch screen goes once the mark under it has painted, so nothing flickers. If the
  // image never loads, the wait below still lets the app through.
  useEffect(() => {
    const wait = setTimeout(() => setWaited(true), SPLASH_MAX_WAIT)
    return () => clearTimeout(wait)
  }, [])
  useEffect(() => {
    if (painted || waited) SplashScreen.hide()
  }, [painted, waited])

  const smoke = useSharedValue(0)
  const mark = useSharedValue(1)
  const markOpacity = useSharedValue(1)
  const dark = useSharedValue(1)

  const started = useRef(false)
  useEffect(() => {
    if (!ready || started.current) return
    started.current = true
    const later = (ms: number, next: Phase) =>
      timers.current.push(setTimeout(() => setPhase(next), ms))
    if (reduced) {
      dark.value = withTiming(0, { duration: 200 })
      markOpacity.value = withTiming(0, { duration: 200 })
      later(200, "done")
      return
    }
    setPhase("gather")
    // The smoke gathers behind him and he draws in a breath...
    smoke.value = withTiming(1, {
      duration: SPLASH_GATHER,
      easing: Easing.out(Easing.ease),
    })
    mark.value = withSequence(
      withTiming(0.92, {
        duration: SPLASH_GATHER,
        easing: Easing.inOut(Easing.ease),
      }),
      // ...then he's gone in the burst, and the dark lifts off the app.
      withTiming(1.3, { duration: 300, easing: Easing.out(Easing.ease) })
    )
    markOpacity.value = withDelay(
      SPLASH_GATHER,
      withTiming(0, { duration: 260, easing: Easing.in(Easing.ease) })
    )
    dark.value = withDelay(
      SPLASH_GATHER + 80,
      withTiming(0, { duration: 420, easing: Easing.out(Easing.ease) })
    )
    later(SPLASH_GATHER, "burst")
    later(SPLASH_GATHER + SPLASH_BURST, "done")
  }, [ready, reduced, smoke, mark, markOpacity, dark])

  useEffect(() => () => timers.current.forEach(clearTimeout), [])

  const darkStyle = useAnimatedStyle(() => ({ opacity: dark.value }))
  const smokeStyle = useAnimatedStyle(() => ({ opacity: smoke.value }))
  const markStyle = useAnimatedStyle(() => ({
    opacity: markOpacity.value,
    transform: [{ scale: mark.value }],
  }))

  if (phase === "done") return null
  return (
    <View
      aria-hidden
      importantForAccessibility="no-hide-descendants"
      // It takes the taps only while it covers the app.
      pointerEvents={phase === "hold" || phase === "gather" ? "auto" : "none"}
      style={{ position: "absolute", top: 0, bottom: 0, start: 0, end: 0 }}
    >
      <Animated.View
        style={[
          {
            position: "absolute",
            top: 0,
            bottom: 0,
            start: 0,
            end: 0,
            backgroundColor: SPLASH_BACKGROUND,
          },
          darkStyle,
        ]}
      />
      {reduced ? null : (
        <Animated.View
          style={[
            { position: "absolute", top: 0, bottom: 0, start: 0, end: 0 },
            smokeStyle,
          ]}
        >
          {/* Aura sits a little below the middle, for the intro's title; the mark is dead centre. */}
          <Aura shift={-0.04 * height} vanishing={phase === "burst"} />
        </Animated.View>
      )}
      <View
        style={{
          position: "absolute",
          top: 0,
          bottom: 0,
          start: 0,
          end: 0,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Animated.Image
          source={MARK}
          onLoad={() => requestAnimationFrame(() => setPainted(true))}
          style={[{ width: SPLASH_SIZE, height: SPLASH_SIZE }, markStyle]}
        />
      </View>
    </View>
  )
}
