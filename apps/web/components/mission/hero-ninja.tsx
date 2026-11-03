"use client"

import * as React from "react"

import {
  Aura,
  Ninja,
  reducedMotion,
  setMood,
  type NinjaMood,
} from "@workspace/player/ninja"
import { Button } from "@workspace/ui/components/button"

import { LivelyLogo } from "@/components/site/lively-logo"

/** Long enough for a bow to finish before he settles. */
const BOW_MS = 1800
/** A beat after the page appears, so the bow reads as a greeting rather than a load jitter. */
const GREET_AFTER_MS = 500
/** What a click gets, in turn. */
const MOODS: NinjaMood[] = ["bow", "cheer", "tilt", "deepbow"]

/** How far above its usual middle the smoke sits (px), so it billows around the ninja and the headline. */
const SMOKE_LIFT = -110

/**
 * The mission page's hero backdrop: the lesson intro's smoke (`Aura`) behind the ninja and the
 * headline. Sits inside a `relative isolate` box and fills it. Decorative; the smoke holds still
 * under reduced motion.
 */
export function MissionSmoke() {
  return <Aura shift={SMOKE_LIFT} />
}

/**
 * The ninja above the mission headline, out of the smoke. His eyes follow the pointer and blink
 * (LivelyLogo), he bows once as the page opens, and a click plays his next move. Reduced motion
 * keeps him still.
 */
export function MissionNinja() {
  const ninja = React.useRef<SVGSVGElement>(null)
  const settle = React.useRef(0)
  const next = React.useRef(0)

  const play = React.useCallback((mood: NinjaMood) => {
    const svg = ninja.current
    if (!svg) return
    window.clearTimeout(settle.current)
    setMood(svg, mood)
    settle.current = window.setTimeout(() => setMood(svg, "idle"), BOW_MS)
  }, [])

  React.useEffect(() => {
    if (reducedMotion()) return
    const greet = window.setTimeout(() => play("bow"), GREET_AFTER_MS)
    return () => {
      window.clearTimeout(greet)
      window.clearTimeout(settle.current)
    }
  }, [play])

  return (
    <Button
      variant="ghost"
      aria-label="Say hello to the ninja"
      className="relative size-20 rounded-full border-0 p-0 hover:bg-transparent sm:size-24 dark:hover:bg-transparent"
      onPress={() => {
        play(MOODS[next.current % MOODS.length]!)
        next.current += 1
      }}
    >
      <LivelyLogo>
        <Ninja ref={ninja} bleed className="absolute -inset-1/4 size-[150%]" />
      </LivelyLogo>
    </Button>
  )
}
