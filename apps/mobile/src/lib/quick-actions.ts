import * as QuickActions from "expo-quick-actions"
import { useQuickActionRouting } from "expo-quick-actions/router"
import { Storage } from "expo-sqlite/kv-store"
import { useEffect } from "react"

import type { Strings } from "@workspace/player-core/strings"

import { LAST, readLast, type LastLesson } from "./last-lesson"
import { useSession } from "./session"
import { useAppStrings } from "./use-strings"
import { refreshWidget } from "./widget"

// The app icon's quick actions (press and hold it on the home screen): Continue, with the lesson
// last left unfinished under it, then Explore and (logged in) Profile, in the app's language and
// with the system's symbols. The last lesson is kept on the device, so the actions are set again in the
// right language at each launch; finishing that lesson takes Continue away, and so does opening it
// once it's gone (expired, deleted, or another account's).

export function quickActionItems(
  t: Strings,
  last: LastLesson | null,
  signedIn: boolean
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
    ...(signedIn
      ? [
          {
            id: "profile",
            title: t.profile.tab,
            icon: "symbol:person.crop.circle",
            params: { href: "/me" },
          },
        ]
      : []),
  ]
}

/** Whether Profile is offered: the session, as QuickActionsEffect last saw it. */
let withProfile = false

function setItems(t: Strings, last: LastLesson | null) {
  void QuickActions.setItems(quickActionItems(t, last, withProfile)).catch(
    () => {}
  )
  // The medium widget's Continue is the same lesson.
  refreshWidget(t)
}

/**
 * Sets the quick actions in the app's language and opens the one the learner chose (also the one
 * that launched the app). In the tabs' layout, under the root, as expo-quick-actions asks.
 */
export function QuickActionsEffect() {
  const { t } = useAppStrings()
  const session = useSession()
  // Still checking who's signed in: leave the actions as the last launch set them.
  const signedIn = session.state === "loading" ? null : session.state === "in"
  useEffect(() => {
    if (signedIn === null) return
    withProfile = signedIn
    setItems(t, readLast())
  }, [t, signedIn])
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
