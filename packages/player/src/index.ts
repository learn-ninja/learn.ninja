// Client-safe exports. The server-only preparer is imported from "@workspace/player/prepare". Server
// code that only needs the strings, plain text, logo, times, or saved progress imports those subpaths,
// so it doesn't make the whole player part of every page.
export { LessonPlayer, type LessonPlayerProps } from "./lesson-player"
export type { LessonCreator, LessonLike, NextPrompt } from "./context"
export { parseChallenge, type Challenge } from "./challenge"
export { BrickDemo, type BrickDemoProps } from "./brick-demo"
export type { Answer } from "./check"
export type { Prepared } from "./prepared"
export {
  stringsFor,
  UI_LANGUAGES,
  type NextKind,
  type Strings,
  type Theme,
} from "./strings"
export { timeAgo, shortTimeAgo, exactTime, TimeAgo, timeLeft } from "./time"
export { plainText } from "./plain-text"
export { BRAND, LearnLogo } from "./logo"
export { savedProgress } from "./progress"
export {
  Lantern,
  LanternIcon,
  RestDays,
  StreakScreen,
  StreakWeek,
  type DayState,
  type DayStreak,
  type LanternLook,
  type StreakDay,
} from "./streak"
