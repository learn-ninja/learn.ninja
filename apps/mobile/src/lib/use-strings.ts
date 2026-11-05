import { getLocales } from "expo-localization"
import { useEffect, useState } from "react"

import {
  directionOf,
  loadLanguage,
  stringsFor,
  type Strings,
} from "@workspace/player-core/strings"

import { appUiLanguage } from "./ui-language"
import { usePreferences } from "./use-preferences"

// The player's words in a language, for a screen: English (or what's already loaded) at once, and
// the language's own once its pack has loaded, which is quick (it's bundled; loadLanguage keeps it).

export function useStringsFor(lang: string): Strings {
  const [, setLoaded] = useState<string | null>(null)
  useEffect(() => {
    let live = true
    void loadLanguage(lang).then(() => live && setLoaded(lang))
    return () => {
      live = false
    }
  }, [lang])
  return stringsFor(lang)
}

/** The device's languages, best first, as BCP 47 tags. */
export function deviceLanguages(): string[] {
  try {
    return getLocales().map((l) => l.languageTag)
  } catch {
    return []
  }
}

/** The app's language outside a lesson (ui-language.ts), its words, and its direction. */
export function useAppStrings() {
  const [prefs] = usePreferences()
  const lang = appUiLanguage(prefs, deviceLanguages())
  const t = useStringsFor(lang)
  return { lang, t, dir: directionOf(lang) }
}
