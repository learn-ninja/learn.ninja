"use client"

import * as React from "react"

import {
  Ninja,
  reducedMotion,
  useEmote,
  type NinjaMood,
} from "@workspace/player/ninja"
import { Button } from "@workspace/ui/components/button"

import { LivelyLogo } from "@/components/site/lively-logo"

/** Long enough for a bow to finish before he settles, as in the footer. */
const EMOTE_MS = 1800
/** A beat after the page appears, so the bow reads as a greeting rather than a load jitter. */
const GREET_AFTER_MS = 500
/** What a click gets, in turn. */
const MOODS: NinjaMood[] = ["bow", "cheer", "tilt", "deepbow"]

/**
 * The ninja above the mission headline, in the smoke. His eyes follow the pointer and blink
 * (LivelyLogo), he bows once as the page opens, and a click plays his next move. Reduced motion
 * skips the greeting.
 */
export function MissionNinja() {
  const ninja = React.useRef<SVGSVGElement>(null)
  const emote = useEmote(ninja, EMOTE_MS)
  const next = React.useRef(0)

  React.useEffect(() => {
    if (reducedMotion()) return
    const greet = window.setTimeout(() => emote("bow"), GREET_AFTER_MS)
    return () => window.clearTimeout(greet)
  }, [emote])

  return (
    <Button
      variant="ghost"
      aria-label="Say hello to the ninja"
      className="relative size-20 rounded-full border-0 p-0 hover:bg-transparent sm:size-24 dark:hover:bg-transparent"
      onPress={() => {
        emote(MOODS[next.current % MOODS.length]!)
        next.current += 1
      }}
    >
      <LivelyLogo>
        <Ninja ref={ninja} bleed className="absolute -inset-1/4 size-[150%]" />
      </LivelyLogo>
    </Button>
  )
}
