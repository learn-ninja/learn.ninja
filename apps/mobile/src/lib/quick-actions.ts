import * as QuickActions from "expo-quick-actions"
import { useQuickActionRouting } from "expo-quick-actions/router"
import { Storage } from "expo-sqlite/kv-store"
import { useEffect } from "react"

import type { Strings } from "@workspace/player-core/strings"

import { useAppStrings } from "./use-strings"

// The app icon's quick actions (press and hold it on the home screen): Continue, with the lesson
// last left unfinished under it, then Explore and Profile, in the app's language and with the
// system's symbols. The last lesson is kept on the device, so the actions are set again in the
// right language at each launch; finishing that lesson takes Continue away, and so does opening it
// once it's gone (expired, deleted, or another account's).

export interface LastLesson {
  /** The app's route for it, /l/{slugId}. */
  href: string
  title: string
}

const LAST = "learn:last-lesson"

export function quickActionItems(
  t: Strings,
  last: LastLesson | null
): QuickActions.Action[] {
  return [
    ...(last
      ? [
          {
            id: "continue",
            title: t.continue,
            subtitle: last.title,
            icon: "symbol:play.fill",
            params: { href: last.href },
          },
        ]
      : []),
    {
      id: "explore",
      title: t.feed.title,
      icon: "symbol:safari",
      params: { href: "/" },
    },
    {
      id: "profile",
      title: t.profile.tab,
      icon: "symbol:person.crop.circle",
      params: { href: "/me" },
    },
  ]
}

/** The lesson last left unfinished, if any: Continue's, and where a streak reminder opens. */
export function readLast(): LastLesson | null {
  try {
    const raw = Storage.getItemSync(LAST)
    const last: unknown = raw ? JSON.parse(raw) : null
    return last &&
      typeof last === "object" &&
      "href" in last &&
      "title" in last &&
      typeof last.href === "string" &&
      typeof last.title === "string"
      ? { href: last.href, title: last.title }
      : null
  } catch {
    return null
  }
}

function setItems(t: Strings, last: LastLesson | null) {
  void QuickActions.setItems(quickActionItems(t, last)).catch(() => {})
}

/**
 * Sets the quick actions in the app's language and opens the one the learner chose (also the one
 * that launched the app). In the tabs' layout, under the root, as expo-quick-actions asks.
 */
export function QuickActionsEffect() {
  const { t } = useAppStrings()
  useEffect(() => setItems(t, readLast()), [t])
  useQuickActionRouting()
  return null
}

/** Takes Continue away if it's for `href`: the lesson no longer opens. */
export function forgetLastLesson(href: string, t: Strings) {
  try {
    if (readLast()?.href !== href) return
    Storage.removeItemSync(LAST)
    setItems(t, null)
  } catch {
    // The actions stay as they were.
  }
}

/**
 * Keeps the open lesson as Continue's until it's finished (`done`), then takes Continue away. Only
 * while `active` (the lesson is on screen): a row's peek loads the lesson's screen out of sight,
 * and peeking isn't opening.
 */
export function useLastLesson(
  href: string,
  title: string,
  done: boolean,
  active: boolean
) {
  const { t } = useAppStrings()
  useEffect(() => {
    if (!active) return
    try {
      const last = readLast()
      if (done) {
        if (last?.href !== href) return
        Storage.removeItemSync(LAST)
        setItems(t, null)
      } else {
        Storage.setItemSync(LAST, JSON.stringify({ href, title }))
        setItems(t, { href, title })
      }
    } catch {
      // The actions stay as they were.
    }
  }, [href, title, done, active, t])
}
