import { getLocales } from "expo-localization"
import { useEffect, useState, useSyncExternalStore } from "react"
import { AppState } from "react-native"

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

function readDeviceLanguages(): string[] {
  try {
    return getLocales().map((l) => l.languageTag)
  } catch {
    return []
  }
}

// The device's languages are a native call, so they're read once here, not on every render of
// every screen, and again only when the app comes back to the front (where a change made in
// Settings shows up), telling the screens only if they changed.
let languages = readDeviceLanguages()
const listeners = new Set<() => void>()
AppState.addEventListener("change", (state) => {
  if (state !== "active") return
  const next = readDeviceLanguages()
  if (next.join() === languages.join()) return
  languages = next
  for (const listener of listeners) listener()
})
const subscribe = (listener: () => void) => {
  listeners.add(listener)
  return () => void listeners.delete(listener)
}

/** The device's languages, best first, as BCP 47 tags. */
export const deviceLanguages = (): readonly string[] => languages

/** The app's language outside a lesson (ui-language.ts), its words, and its direction. */
export function useAppStrings() {
  const [prefs] = usePreferences()
  const device = useSyncExternalStore(subscribe, deviceLanguages)
  const lang = appUiLanguage(prefs, device)
  const t = useStringsFor(lang)
  return { lang, t, dir: directionOf(lang) }
}
