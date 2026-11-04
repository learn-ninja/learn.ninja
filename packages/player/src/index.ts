// Client-safe exports. The server-only preparer is imported from "@workspace/player/prepare". Server
// code that only needs the strings, plain text, logo, times, or saved progress imports those subpaths,
// so it doesn't make the whole player part of every page.
export { LessonPlayer, type LessonPlayerProps } from "./lesson-player"
export type { LessonCreator, LessonLike, NextPrompt } from "./context"
export { parseChallenge, type Challenge } from "./challenge"
export { KataDemo, type KataDemoProps } from "./kata-demo"
export type { Answer } from "@workspace/player-core/check"
export type { Prepared } from "@workspace/player-core/prepared"
export {
  stringsFor,
  UI_LANGUAGES,
  type NextKind,
  type Strings,
  type Theme,
} from "@workspace/player-core/strings"
export { timeAgo, shortTimeAgo, exactTime, TimeAgo, timeLeft } from "./time"
export { plainText } from "@workspace/player-core/plain-text"
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
