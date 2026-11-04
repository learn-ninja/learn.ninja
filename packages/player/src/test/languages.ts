import { loadLanguage, UI_LANGUAGES } from "@workspace/player-core/strings"

// Tests read any language synchronously (stringsFor, voiceLines), as a page does once its language
// has loaded: load them all first.
await Promise.all(UI_LANGUAGES.map((l) => loadLanguage(l.code)))
