// The player's own text (buttons, feedback titles, helper lines), translated by the player.
// Lesson content stays in the lesson's language. One file per language lives in ./locales.

import type { Level, Subject } from "@workspace/spec"

import { STRINGS } from "./locales"

export type Strings = {
  start: string
  check: string
  continue: string
  tryAgain: string
  why: string
  hint: string
  /** A scenario's brief: show the rest at once. */
  skip: string
  /** After a scenario miss: back to the decision (it replaces Try again). */
  rewind: string
  /** After a scenario, every option's outcome (it replaces Why?). */
  everyPath: string
  /** The button that plays a scenario's brief again. */
  replayBrief: string
  /** A scenario option already picked and rewound. */
  tried: string
  /** Under a hotspot's visual: the parts picked, by name. */
  picked: (parts: string) => string
  hookNote: string
  minutes: (n: number) => string
  /** A lesson published under a minute ago (older ages come from Intl.RelativeTimeFormat). */
  justNow: string
  /** Time left on a published link: days from 24 hours up, hours below. */
  expires: { days: (n: number) => string; hours: (n: number) => string }
  levels: Record<Level, string>
  /** The subject's name in the player's language. Shown nowhere since spec 0.8 (rows and the title screen show tags); kept for Explore filters and subject pages. */
  subjects: Record<Subject, string>
  objective: string
  warmUp: string
  concept: (i: number, n: number) => string
  practice: string
  challenge: string
  fixing: string
  helper: {
    choiceOne: string
    choiceMany: string
    compare: string
    sort: string
    order: string
    match: string
    blank: string
    scenario: string
  }
  miss: {
    missOne: string
    hotspot: string
    hotspotLine: string
    sort: (n: number) => string
    order: string
    match: (n: number) => string
    blank: string
  }
  optionLabel: (letter: string) => string
  pool: string
  /** Announced when a sort item moves; `group` is the pool's name when it's taken back out. */
  placedIn: (item: string, group: string) => string
  /** Announced when an order item lands in a numbered slot. */
  placedAt: (item: string, n: number) => string
  wordBank: string
  emptyGap: string
  /** Name of an HTML visual with no alt text. */
  visual: string
  /** The notch that opens and closes the tray of action buttons. */
  showActions: string
  hideActions: string
  fixTitle: string
  fixBody: (n: number) => string
  fixStart: string
  done: string
  firstTry: string
  secondTry: string
  missed: string
  takeaways: string
  next: string
  restart: string
  progress: string
  /** Short label before the counter in the progress bar tooltip. */
  progressLabel: string
  restartTitle: string
  restartBody: string
  stay: string
  home: string
  share: string
  docs: string
  /** The title in the header: press to edit it. */
  renameLesson: string
  lessonName: string
  lessonMenu: string
  linkCopied: string
  theory: string
  theoryEmpty: string
  closeTheory: string
  by: string
  textSize: string
  /** Marks the option a setting starts on, after its name in the menu. */
  defaultOption: string
  sizes: Record<TextSize, string>
  sizesShort: Record<TextSize, string>
  theme: string
  themes: Record<Theme, string>
  language: string
  /** The sound setting in the tray: its name, and its state while muted. */
  sound: string
  muted: string
  /** The ninja setting: which character he plays, each with a one-line description. */
  ninja: string
  ninjaLevels: Record<NinjaLevel, string>
  ninjaHints: Record<NinjaLevel, string>
  /** The keyboard shortcuts dialog, opened from the footer or with "?". */
  shortcuts: string
  shortcutMain: string
  shortcutPick: string
  /** Drag and drop by keyboard: Enter on a handle, then Tab to a spot. */
  shortcutOrder: string
  shortcutSort: string
  shortcutUnsort: string
  /** D opens and closes the tray of buttons. */
  shortcutTray: string
  shortcutHelp: string
  /** The gear menu in the header (theme, language, docs). */
  settings: string
  /** Footer links to the legal pages. */
  privacy: string
  terms: string
}

export type TextSize = "sm" | "md" | "lg"
export type Theme = "system" | "light" | "dark"
/** The ninja's character: hidden, plain and short, a calm mentor, or a nervous wreck. */
export type NinjaLevel = "off" | "sensei" | "casual" | "unhinged"

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

/** The player's text for a language code, falling back to English. */
export function stringsFor(lang: string): Strings {
  return STRINGS[normalize(lang) ?? "en"]
}

/** React Aria's locale for a UI language (its strings are keyed by full locale, Arabic as ar-AE). */
export function ariaLocaleFor(lang: string): string {
  return uiLanguageFor(lang)?.aria ?? "en-US"
}
