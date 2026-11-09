import { ExtensionStorage } from "@bacons/apple-targets"
import { Platform } from "react-native"

import type { Strings } from "@workspace/player-core/strings"

import { deviceStorage } from "./progress-storage"
import { readLast } from "./last-lesson"
import { localDay, readDays } from "./streak"
import { APP_GROUP, SNAPSHOT_KEY, widgetSnapshot } from "./widget-snapshot"

// Writes the widget's snapshot (widget-snapshot.ts) to the App Group and asks WidgetKit to draw it
// again. Called whenever what it shows could change: the day's first finish, a lesson left
// unfinished or finished, the app coming to the front, a new language. iOS only.

let storage: ExtensionStorage | null = null

export function refreshWidget(t: Strings) {
  if (Platform.OS !== "ios") return
  try {
    storage ??= new ExtensionStorage(APP_GROUP)
    const snapshot = widgetSnapshot(
      readDays(deviceStorage),
      localDay(),
      readLast(),
      t
    )
    storage.set(SNAPSHOT_KEY, JSON.stringify(snapshot))
    ExtensionStorage.reloadWidget()
  } catch {
    // No widget data this time (no App Group in this build); the next refresh tries again.
  }
}
