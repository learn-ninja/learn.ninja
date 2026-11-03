// The player's own text (buttons, feedback titles, helper lines), translated by the player.
// Lesson content stays in the lesson's language. One file per language lives in ./locales.

import type { Level, Subject } from "@workspace/spec"

import { packFor } from "./language"

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
  /** On phones, over the sort item on top of the deck: "2 of 5". */
  sortCount: (i: number, n: number) => string
  /** On phones, in each sort group's open space: tapping it puts the top item there. */
  sortHere: string
  /** The Check button while sort items wait to be sorted: "2 left to sort". */
  sortLeft: (n: number) => string
  /** Announced when an order item lands in a numbered slot. */
  placedAt: (item: string, n: number) => string
  /** Announced in a match kata when a pair is made right. */
  matched: (left: string, right: string) => string
  /** Announced in a match kata when two items don't go together. */
  notAPair: string
  /** A checked answer's result as words, for screen readers. */
  markCorrect: string
  markWrong: string
  markPartial: string
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
  /** The wrap-up's score line: "8 of 9 on the first try". */
  firstTryCount: (first: number, total: number) => string
  /** The score line on a perfect run: "All 9 on the first try". */
  allFirstTry: (total: number) => string
  takeaways: string
  /** The wrap-up's Keep learning list: what to ask the learner's agent for next. */
  keepLearning: string
  /** Its rows: the lesson's suggested next topic, this topic deeper, or this topic harder. */
  keepKinds: Record<NextKind, string>
  /** Keep learning's rows say to screen readers what their copied prompts are for. */
  nextHint: string
  copyPrompt: string
  promptCopied: string
  /** The wrap-up's main button: the score, sent as a challenge. */
  challengeTitle: string
  /** The message sent with the challenge link. */
  challengeMessage: (first: number, total: number) => string
  /** That button for someone who was challenged themselves. */
  challengeBack: string
  /** The toast after the challenge was copied (desktop; phones open the share sheet), and what to do next. */
  messageCopied: string
  challengeCopiedHint: string
  /** On the title screen of a challenge link: the sender's score, `by` their handle when they were logged in. */
  challengeFrom: (first: number, total: number, by?: string) => string
  /** On the challenged learner's wrap-up: their first tries (`mine`) against the sender's. */
  challengeWon: (mine: number, theirs: number, by?: string) => string
  challengeTied: (score: number, by?: string) => string
  challengeLost: (mine: number, theirs: number, by?: string) => string
  /** The wrap-up's bar with a segment for each question (its label), and what each segment means. */
  howYouDid: string
  outcomes: { first: string; second: string; missed: string }
  /** The streak screen before the wrap-up, on the day's first lesson: the days in a row ("12-day streak"), said to screen readers. */
  streakDays: (days: number) => string
  /** The words under its big number ("day streak"). */
  streakUnit: (days: number) => string
  /** Its line under the week: a streak going on, the first day ever, or day 1 after one broke. */
  streakLit: string
  streakStarts: string
  streakAgain: string
  /** The row of the last seven days' lanterns, to screen readers, and each day's state. */
  streakWeek: string
  streakDayLit: string
  streakDayRest: string
  streakDayUnlit: string
  /** Today before its lesson, and the days still to come. */
  streakDayOpen: string
  /** The rest days section, under the streak's week (the header's popover and the streak screen). */
  restTitle: string
  /** Its info button, and what it opens: how rest days recharge and get used. */
  restInfo: (perRest: number, max: number) => string
  /** The lantern slots, said to screen readers ("1 of 2 saved"). */
  restSaved: (saved: number, max: number) => string
  /** The bar toward the next rest day, and its value ("2 of 3 days"). */
  restProgress: string
  restProgressValue: (days: number, of: number) => string
  /** Shown in the bar's place while all are saved, since learning days don't count then. */
  restFull: string
  /** The wrap-up's heart, before and after the learner likes the lesson. */
  like: string
  liked: string
  /** Shown in the heart's place when a logged-out learner presses it, beside the Log in link. */
  likeLogIn: string
  logIn: string
  /** Under a logged-out learner's score, linking to log in: their finish then counts on their profile. */
  keepLogIn: string
  likeFailed: string
  /** The maker's Share: where the lesson stands (its icon), the switch to publish it, and Make changes. */
  creatorPrivate: string
  /** The switch's fixed label: what turning it on does, whatever the lesson's state (publishedBody under it). */
  showInExplore: string
  creatorPublished: string
  creatorHidden: string
  publishBody: string
  publishedBody: string
  hiddenBody: string
  publish: string
  publishFailed: string
  /** Takes a published lesson back out of Explore, from the maker's Share. */
  makePrivate: string
  makePrivateFailed: string
  /** The toast after making it private (publishing says creatorPublished), and its button to go back. */
  madePrivate: string
  undo: string
  makeChanges: string
  /** The Make changes dialog: what to do with what it copies. */
  changesBody: string
  /** The changes the dialog offers as checkboxes, each also a line of the copied prompt. */
  changes: Record<LessonChange, string>
  /** The Make changes dialog's level picker, and its line of the copied prompt with the level's name. */
  changesLevel: string
  changeLevel: (level: string) => string
  changesOther: string
  changesPlaceholder: string
  copyChanges: string
  changesCopied: string
  changesEmpty: string
  copyFailed: string
  /** The copied prompt's opening, with the lesson's link; the changes follow as a list. */
  changesPrompt: (url: string) => string
  cancel: string
  changesDone: string
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
  /** The button beside the lesson's link in the maker's Share. */
  copyLink: string
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

/**
 * Strings only English has so far: every other language falls back to English for them
 * (loadLanguage). Translate them and take them off this list before shipping, or switch
 * UI_TRANSLATIONS off while they wait.
 */
export type Untranslated = never
/** A language's own strings: everything but the ones still waiting for translation. */
export type Translation = Omit<Strings, Untranslated>

/** The ready-made changes the Make changes dialog offers. */
export const LESSON_CHANGES = ["visual", "shorter", "examples"] as const
export type LessonChange = (typeof LESSON_CHANGES)[number]
/** What Keep learning asks the agent for, in the order its choices show. */
export const NEXT_KINDS = ["next", "deeper", "harder"] as const
export type NextKind = (typeof NEXT_KINDS)[number]
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

/**
 * Whether the player's interface follows the learner: their saved choice, the language menu, and
 * the lesson's language. Off, it's always English, and only ?ui= shows a translation, for testing.
 * Lessons themselves are written in any language either way.
 */
export const UI_TRANSLATIONS = true

/** The menu entry for a language code, or undefined when the player has no translation for it. */
export function uiLanguageFor(lang: string) {
  const code = normalize(lang)
  return UI_LANGUAGES.find((l) => l.code === code)
}

/**
 * The player's text for a language code, falling back to English: for a language other than
 * English, once it's loaded (loadLanguage, or useStrings in a component).
 */
export function stringsFor(lang: string): Strings {
  return packFor(lang).strings
}

export { loadLanguage, useStrings } from "./language"

/** React Aria's locale for a UI language (its strings are keyed by full locale, Arabic as ar-AE). */
export function ariaLocaleFor(lang: string): string {
  return uiLanguageFor(lang)?.aria ?? "en-US"
}
