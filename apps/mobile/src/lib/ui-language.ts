import { directionOf, uiLanguageFor } from "@workspace/player-core/strings"

import type { Preferences } from "./preferences"

// Which language the app's own screens speak, and which way they run. Pure, so it's tested in Node.
//
// - In a lesson, the web's rule (packages/player/src/lesson-player.tsx): the language the learner
//   chose in the menu, else the lesson's own.
// - Everywhere else (Explore, profiles, log-in, settings): the language they chose, else the
//   device's first language the player has, else English.

/** The player's language inside a lesson in `lessonLanguage`. */
export function lessonUiLanguage(
  prefs: Preferences,
  lessonLanguage: string
): string {
  return chosen(prefs) ?? lessonLanguage
}

/** The app's language outside a lesson, from the device's languages in order (BCP 47 tags). */
export function appUiLanguage(
  prefs: Preferences,
  deviceLanguages: readonly string[]
): string {
  return (
    chosen(prefs) ??
    deviceLanguages.map((tag) => uiLanguageFor(tag)?.code).find(Boolean) ??
    "en"
  )
}

const chosen = (prefs: Preferences) =>
  prefs.uiLanguage && uiLanguageFor(prefs.uiLanguage)
    ? prefs.uiLanguage
    : undefined

/** Right to left for Arabic and Hebrew (and the other right-to-left languages a lesson may be in). */
export const isRtl = (lang: string) => directionOf(lang) === "rtl"
