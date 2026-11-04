import { use } from "react"

import { LOADERS } from "./locales"
import { en } from "./locales/en"
import { en as enVoices } from "./locales/voices/en"
import {
  uiLanguageFor,
  type Strings,
  type Translation,
  type UiLanguage,
} from "./strings"
import type { Voices } from "./voices"

// The player's languages. English is built in; every other one is a chunk of its own, loaded when a
// lesson is shown in it (see locales/index.ts). Loaded packs are kept for the life of the page, or
// of the server process, where the same few languages come up again and again.

/** One language: the player's text and the ninja's lines. */
export interface Pack {
  strings: Strings
  voices: Voices
}

/** A language as its chunk has it: strings still waiting for translation are left out. */
export interface PackChunk {
  strings: Translation
  voices: Voices
}

const ENGLISH: Pack = { strings: en, voices: enVoices }
const packs = new Map<UiLanguage, Pack>([["en", ENGLISH]])
const loading = new Map<UiLanguage, Promise<Pack>>()

const codeOf = (lang: string): UiLanguage => uiLanguageFor(lang)?.code ?? "en"

/** A language's pack once it's loaded, and English until then (or for a language the player lacks). */
export function packFor(lang: string): Pack {
  return packs.get(codeOf(lang)) ?? ENGLISH
}

/**
 * Loads a language's pack. The same promise every time, so React's `use` can wait on it. A chunk
 * that fails to load (offline) resolves to English, and the next call tries again.
 */
export function loadLanguage(lang: string): Promise<Pack> {
  const code = codeOf(lang)
  const ready = packs.get(code)
  if (ready) return Promise.resolve(ready)
  let promise = loading.get(code)
  if (!promise) {
    promise = LOADERS[code as Exclude<UiLanguage, "en">]().then(
      (chunk) => {
        // English stands in for any strings still waiting for translation (Untranslated).
        const pack = { ...chunk, strings: { ...en, ...chunk.strings } }
        packs.set(code, pack)
        return pack
      },
      () => {
        loading.delete(code)
        return ENGLISH
      }
    )
    loading.set(code, promise)
  }
  return promise
}

/**
 * The player's text in `lang`. Suspends until the language is loaded, so the server renders the
 * lesson in its language and the browser waits for that chunk before hydrating, rather than
 * showing English first. Switch languages inside a transition to keep the old text up meanwhile.
 */
export function useStrings(lang: string): Strings {
  return packs.get(codeOf(lang))?.strings ?? use(loadLanguage(lang)).strings
}
