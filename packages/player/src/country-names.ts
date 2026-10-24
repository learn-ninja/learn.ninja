import { COUNTRIES } from "@workspace/spec"

// Country names in the player's language, for a map hotspot's toggles and its "Picked" line. The
// browser has them for every ISO code (and Kosovo's "XK"); the checker's English names are the
// fallback, for an engine or a language without them.

const names = new Map<string, Intl.DisplayNames | null>()

export function countryName(code: string, lang = "en") {
  if (!names.has(lang)) {
    try {
      names.set(lang, new Intl.DisplayNames([lang, "en"], { type: "region" }))
    } catch {
      names.set(lang, null)
    }
  }
  const name = names.get(lang)?.of(code)
  return name && name !== code ? name : (COUNTRIES[code]?.name ?? code)
}
