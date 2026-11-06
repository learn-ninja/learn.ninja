import { createContext, useContext } from "react"

import type { Challenge } from "@workspace/player-core/challenge"
import type { Mark } from "@workspace/player-core/check"
import type { NinjaLevel } from "@workspace/player-core/strings"

import type { Streak } from "@/lib/streak"

/**
 * What the screens need from the player around them for the ninja and his smoke, so the screens
 * take it without new props: his setting (Off leaves him out), whether the intro is vanishing, and
 * on the wrap-up the day streak (with the streak screen first on the day's first finish) and
 * whether the sound effects are on, and its Share.
 */
export interface Stage {
  ninja: NinjaLevel
  vanishing: boolean
  streak: Streak | null
  streakScreen: boolean
  sound: boolean
  /** Shares the challenge for the learner's first tries (the wrap-up's Challenge friend). */
  onShare: ((first: number, total: number) => void) | null
  /** The player's own language (the learner's choice, else the lesson's): the streak's weekdays. */
  uiLang: string
  /** The score a friend sent with the link (?c= and ?by=), when it still fits the lesson. */
  challenge?: Challenge
  /** A checked answer's mark in words, for VoiceOver, in the player's language (lib/mark-words.ts). */
  markWord: (mark: Mark | undefined) => string | undefined
}

export const StageContext = createContext<Stage>({
  ninja: "sensei",
  vanishing: false,
  streak: null,
  streakScreen: false,
  sound: false,
  onShare: null,
  uiLang: "en",
  markWord: () => undefined,
})

export const useStage = () => useContext(StageContext)
