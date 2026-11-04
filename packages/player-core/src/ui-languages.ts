// The languages the player's own text comes in, and the lookup from any language code to one of them.
// Its own module so strings.ts and language.ts can both import it without importing each other.

/**
 * Languages the player's own text is translated into: the code, the language's name in itself (for
 * the language menu), and the locale React Aria ships its own strings under. React Aria has no
 * Hindi, Indonesian, Vietnamese, or Thai, so its few announcements fall back to English there.
 */
export const UI_LANGUAGES = [
  { code: "en", label: "English", aria: "en-US" },
  { code: "es", label: "Español", aria: "es-ES" },
  { code: "pt", label: "Português (Brasil)", aria: "pt-BR" },
  { code: "fr", label: "Français", aria: "fr-FR" },
  { code: "de", label: "Deutsch", aria: "de-DE" },
  { code: "it", label: "Italiano", aria: "it-IT" },
  { code: "nl", label: "Nederlands", aria: "nl-NL" },
  { code: "pl", label: "Polski", aria: "pl-PL" },
  { code: "ru", label: "Русский", aria: "ru-RU" },
  { code: "uk", label: "Українська", aria: "uk-UA" },
  { code: "tr", label: "Türkçe", aria: "tr-TR" },
  { code: "ar", label: "العربية", aria: "ar-AE" },
  { code: "he", label: "עברית", aria: "he-IL" },
  { code: "hi", label: "हिन्दी", aria: "en-US" },
  { code: "id", label: "Bahasa Indonesia", aria: "en-US" },
  { code: "vi", label: "Tiếng Việt", aria: "en-US" },
  { code: "th", label: "ไทย", aria: "en-US" },
  { code: "ja", label: "日本語", aria: "ja-JP" },
  { code: "ko", label: "한국어", aria: "ko-KR" },
  { code: "zh", label: "中文（简体）", aria: "zh-CN" },
  { code: "zh-tw", label: "中文（繁體）", aria: "zh-TW" },
] as const

export type UiLanguage = (typeof UI_LANGUAGES)[number]["code"]

/** The player's language for a code ("ar", "ar-EG", "zh-Hant-TW", "en-US"…): the base language, except Traditional Chinese. */
function normalize(lang: string): UiLanguage | undefined {
  const lower = lang.toLowerCase()
  if (/^zh(-hant|-tw|-hk|-mo)/.test(lower)) return "zh-tw"
  const base = lower.split("-")[0]
  return UI_LANGUAGES.find((l) => l.code === base)?.code
}

/** The menu entry for a language code, or undefined when the player has no translation for it. */
export function uiLanguageFor(lang: string) {
  const code = normalize(lang)
  return UI_LANGUAGES.find((l) => l.code === code)
}
