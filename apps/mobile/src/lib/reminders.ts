import * as Notifications from "expo-notifications"
import { Storage } from "expo-sqlite/kv-store"
import { router } from "expo-router"
import { useEffect, useRef } from "react"
import { AppState, Linking } from "react-native"

import type { Strings } from "@workspace/player-core/strings"

import { readPreferences } from "./preferences"
import { deviceStorage } from "./progress-storage"
import { readLast } from "./last-lesson"
import { planReminders } from "./reminder-plan"
import { localDay, readDays } from "./streak"
import { useAppStrings } from "./use-strings"
import { refreshWidget } from "./widget"

// The evening streak reminder, as local notifications the app schedules itself: no server, no
// account, and the phone's own time zone. Each time something could change the plan (a finish, the
// app coming to the front, a new language, the switch in Settings), every reminder is cancelled
// and the coming week's are scheduled again from the learning days on the device
// (reminder-plan.ts). Permission is asked once, as the learner leaves the streak screen for the
// first time; never at launch. Tapping one opens the lesson last left unfinished, or Explore.

const ASKED = "learn:reminders-asked"

/** Whether reminders are on: allowed by iOS, and not switched off in Settings. */
async function allowed(): Promise<boolean> {
  if (readPreferences(deviceStorage).reminders === false) return false
  try {
    return (await Notifications.getPermissionsAsync()).granted
  } catch {
    return false
  }
}

let scheduling: Promise<void> = Promise.resolve()
/** The app's strings, from RemindersEffect: the reminders speak the app's language, not a lesson's. */
let strings: Strings | null = null

/** Cancels the scheduled reminders and schedules the coming week's again, if they're on. */
export function rescheduleReminders(): Promise<void> {
  // One at a time: two launches of this racing could leave a cancelled week scheduled twice.
  scheduling = scheduling.then(async () => {
    const t = strings
    if (!t) return
    // The widget shows the same days ahead, so it's written again on the same occasions.
    refreshWidget(t)
    try {
      await Notifications.cancelAllScheduledNotificationsAsync()
      if (!(await allowed())) return
      const href = readLast()?.href ?? "/"
      const plan = planReminders(
        readDays(deviceStorage),
        localDay(),
        new Date(),
        t
      )
      for (const r of plan)
        await Notifications.scheduleNotificationAsync({
          content: { title: r.title, body: r.body, data: { href } },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: r.at,
          },
        })
    } catch {
      // No reminders this time; the next reschedule tries again.
    }
  })
  return scheduling
}

/**
 * Asks iOS for permission the first time the learner leaves the streak screen, and schedules the
 * reminders once it's given. Asked once: after that, Settings (and iOS's own switch) decide.
 */
export async function askForReminders(): Promise<void> {
  try {
    if (Storage.getItemSync(ASKED)) return
    Storage.setItemSync(ASKED, "1")
    const now = await Notifications.getPermissionsAsync()
    if (!now.granted && now.canAskAgain)
      await Notifications.requestPermissionsAsync({
        ios: { allowAlert: true, allowSound: true, allowBadge: false },
      })
  } catch {
    // Not asked; the reminders stay off until iOS allows them.
  }
  await rescheduleReminders()
}

/**
 * The switch in Settings: saves the choice (the caller's update) and, switched on, asks iOS if it
 * still can, or opens the app's page in iOS's Settings when the learner once said no there.
 */
export async function remindersSwitched(on: boolean): Promise<void> {
  if (on)
    try {
      const now = await Notifications.getPermissionsAsync()
      if (!now.granted) {
        Storage.setItemSync(ASKED, "1")
        if (now.canAskAgain)
          await Notifications.requestPermissionsAsync({
            ios: { allowAlert: true, allowSound: true, allowBadge: false },
          })
        else await Linking.openSettings()
      }
    } catch {}
  await rescheduleReminders()
}

/**
 * In the tabs' layout (under the root, so a tapped reminder has a navigator to open in): keeps the reminders scheduled (at launch, whenever the app comes back to
 * the front, and in the app's language), and opens where a tapped reminder leads.
 */
export function RemindersEffect() {
  const { t } = useAppStrings()
  useEffect(() => {
    strings = t
    void rescheduleReminders()
  }, [t])
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") void rescheduleReminders()
    })
    return () => sub.remove()
  }, [])
  const response = Notifications.useLastNotificationResponse()
  const opened = useRef<string | null>(null)
  useEffect(() => {
    if (!response) return
    const id = response.notification.request.identifier
    if (opened.current === id) return
    opened.current = id
    const href = response.notification.request.content.data?.href
    if (typeof href === "string" && href.startsWith("/"))
      router.push(href as never)
  }, [response])
  return null
}
