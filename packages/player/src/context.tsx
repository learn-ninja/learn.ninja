"use client"

import * as React from "react"

import { emptyPrepared, type Prepared } from "@workspace/player-core/prepared"
import type { Challenge } from "./challenge"
import type { DayStreak } from "./streak"
import { stringsFor, type NextKind, type Strings } from "@workspace/player-core/strings"

interface PlayerContextValue {
  prepared: Prepared
  t: Strings
  /** The player's UI language code, for text that isn't in Strings (the ninja's voices). */
  lang?: string
  dir: "ltr" | "rtl"
  /** URL of the stylesheet lesson visuals load inside their sandbox (Basecoat + Tailwind). */
  visualsCss: string
  /** Only take keyboard shortcuts (Enter, number keys) from inside this element, for several demos on one page. */
  keyScope?: React.RefObject<HTMLElement | null>
  /** The prompt Keep learning copies for the learner's agent. Without it there's no Keep learning box. */
  nextPrompt?: NextPrompt
  /** The link the wrap-up's share box sends. Defaults to the current page. */
  shareUrl?: string
  /** The score this learner was challenged to beat, from the link they opened. */
  challenge?: Challenge
  /** The logged-in learner's handle, named in the challenges they send. */
  challenger?: string
  /** The wrap-up's like. Without it there's no heart. */
  like?: LessonLike
  /** The lesson's maker is the one playing: the wrap-up shows their card instead of the heart. */
  creator?: LessonCreator
  /** Where a logged-out learner logs in so this finish counts on their profile. */
  keepLogIn?: string
  /** The streak this finish lit, for the wrap-up's card. Without it there's no card. */
  streak?: DayStreak
}

/**
 * Builds the prompt Keep learning copies: `kind` is the choice the learner made, `topic` what's in
 * its field, `after` this lesson's title.
 */
export type NextPrompt = (
  kind: NextKind,
  topic: string,
  after: string
) => string

/** A published lesson's likes, and the learner's, for the heart on the wrap-up. */
export interface LessonLike {
  likes: number
  liked: boolean
  /**
   * Likes the lesson (true) or takes the like back, resolving to the lesson's new count or an
   * error. Omit it when the learner is logged out: pressing the heart then offers `loginHref`.
   */
  onChange?: (liked: boolean) => Promise<{ likes?: number; error?: string }>
  /** Where a logged-out learner logs in, coming back to this lesson. */
  loginHref?: string
}

/** What the wrap-up shows the lesson's maker: where it stands, a way to publish it, and its link. */
export interface LessonCreator {
  /** Private (link only), published in Explore, or hidden after a report (it can't be published). */
  status: "private" | "published" | "hidden"
  /** Publishes the lesson to Explore, resolving to an error when it didn't go through. */
  onPublish?: () => Promise<{ error?: string }>
  /** Takes a published lesson out of Explore, back to link only. */
  onUnpublish?: () => Promise<{ error?: string }>
  /** The maker's list of lessons on their profile, once they have a handle. */
  profileHref?: string
  /** The lesson's link, which the prompt Make changes copies names, so the agent updates it. */
  url: string
}

const PlayerContext = React.createContext<PlayerContextValue>({
  prepared: emptyPrepared,
  t: stringsFor("en"),
  dir: "ltr",
  visualsCss: "/lesson-visuals.css",
})

export const PlayerProvider = PlayerContext.Provider
export const usePlayer = () => React.useContext(PlayerContext)

/** Tracks the app's dark mode (the `dark` class on <html>, set by next-themes or Storybook). */
export function useIsDark(): boolean {
  const [dark, setDark] = React.useState(false)
  React.useEffect(() => {
    const root = document.documentElement
    const update = () => setDark(root.classList.contains("dark"))
    update()
    const observer = new MutationObserver(update)
    observer.observe(root, { attributes: true, attributeFilter: ["class"] })
    return () => observer.disconnect()
  }, [])
  return dark
}
