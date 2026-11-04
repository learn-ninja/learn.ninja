"use client"

import * as React from "react"
import { Volume2, VolumeX } from "lucide-react"

import {
  FOOTER_GREETING,
  FOOTER_LINES,
  footerClip,
} from "@workspace/player/footer-lines"
import { Ninja, useEmote, type NinjaMood } from "@workspace/player/ninja"
import { Button } from "@workspace/ui/components/button"
import { Toggle } from "@workspace/ui/components/toggle"

import { LivelyLogo } from "./lively-logo"

const SOUND_KEY = "learn:footer-sound"

/** What he does with each of `FOOTER_LINES`, in the same order. */
const EMOTES: NinjaMood[] = ["bow", "tilt", "cheer", "rattle", "spin"]
/** Long enough for the slowest emote, and for a held one to read. */
const EMOTE_MS = 1800

function savedSound() {
  try {
    return localStorage.getItem(SOUND_KEY) === "on"
  } catch {
    return false
  }
}

function saveSound(on: boolean) {
  try {
    localStorage.setItem(SOUND_KEY, on ? "on" : "off")
  } catch {
    // Blocked storage: the choice just lasts until the page changes.
  }
}

/**
 * The ninja at the top of the footer: click him and he says his next line with its own emote, in
 * the player's green speech bubble (`TOAST` in packages/player), aloud if the sound is on. The sound
 * starts off and stays as the visitor left it. He's pulled back by the empty edge of his drawing,
 * so he lines up with the name below, and he's drawn with room around him for his moves.
 */
export function FooterNinja({
  greeting = FOOTER_GREETING,
}: {
  /** What he says before the first click; a page can give its own. Shown, not spoken. */
  greeting?: string
}) {
  // Which of his lines he's on; null until the first click, when he shows the greeting.
  const [at, setAt] = React.useState<number | null>(null)
  const [sound, setSound] = React.useState(false)
  const audio = React.useRef<HTMLAudioElement | null>(null)
  const ninja = React.useRef<SVGSVGElement>(null)
  const emote = useEmote(ninja, EMOTE_MS)
  const line = at === null ? greeting : FOOTER_LINES[at]!

  // After mounting, so the server's render and the first one in the browser agree.
  React.useEffect(() => setSound(savedSound()), [])

  function stop() {
    audio.current?.pause()
    audio.current = null
  }

  function say() {
    const next = at === null ? 0 : (at + 1) % FOOTER_LINES.length
    setAt(next)
    emote(EMOTES[next]!)
    stop()
    const clip = sound ? footerClip(FOOTER_LINES[next]!) : null
    if (!clip) return
    audio.current = new Audio(clip)
    audio.current.play().catch(() => {})
  }

  function changeSound(on: boolean) {
    setSound(on)
    saveSound(on)
    if (!on) stop()
  }

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="ghost"
        aria-label="Ask the ninja what to do next"
        className="relative -ms-1 size-16 rounded-full border-0 p-0 hover:bg-transparent dark:hover:bg-transparent"
        onPress={say}
      >
        <LivelyLogo>
          <Ninja ref={ninja} bleed className="absolute -inset-1/4 size-[150%]" />
        </LivelyLogo>
      </Button>
      <div className="flex min-w-0 items-center gap-1.5 rounded-[18px] bg-[color-mix(in_srgb,var(--color-green-500)_18%,var(--background))] py-2 ps-3.5 pe-2.5 text-foreground">
        <div aria-live="polite" className="min-w-0">
          <p
            key={line}
            className="text-sm font-medium motion-safe:animate-in motion-safe:duration-300 motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-1"
          >
            {line}
          </p>
        </div>
        {/* Just the icon, as tall as the text's line, so the bubble keeps its one-line height. */}
        <Toggle
          aria-label="Ninja's voice"
          size="sm"
          className="h-5 min-w-5 shrink-0 rounded-full px-0 text-foreground/70 hover:bg-transparent hover:text-foreground aria-pressed:bg-transparent data-selected:bg-transparent"
          isSelected={sound}
          onChange={changeSound}
        >
          {sound ? <Volume2 /> : <VolumeX />}
        </Toggle>
      </div>
    </div>
  )
}
