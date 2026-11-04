import { useEffect, useRef } from "react"

import type { NinjaLevel } from "@workspace/player-core/strings"
import type { LinePicker } from "@workspace/player-core/voices"

import { API_BASE_URL } from "./config"
import { playSound, preloadSounds } from "./sound"
import { upcomingVoice, voiceUrl } from "./voice"

/**
 * The ninja saying the line that heads the feedback, once per piece of feedback (`key`: the run,
 * screen, attempt, and phase), as the web's useSpokenLine does. The feedback on screen when the
 * lesson opened (resumed progress) was already said, so he stays quiet until the learner moves on.
 * A new line, muting, or leaving the screen stops the one playing. Whatever he'd say next is loaded
 * while the learner answers, so it comes with the feedback.
 */
export function useNinjaVoice({
  line,
  key,
  lang,
  level,
  pickLine,
  on,
}: {
  line: string | null
  key: string
  lang: string
  level: NinjaLevel
  pickLine: LinePicker
  on: boolean
}) {
  const said = useRef(key)
  useEffect(() => {
    if (!on || said.current === key) return
    const url = voiceUrl(API_BASE_URL, lang, line)
    if (!url) return
    said.current = key
    return playSound(url)
  }, [on, key, line, lang])
  const upcoming = on
    ? upcomingVoice(API_BASE_URL, lang, level, pickLine).join(" ")
    : ""
  useEffect(() => {
    if (upcoming) preloadSounds(upcoming.split(" "))
  }, [upcoming])
}
