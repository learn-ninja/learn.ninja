import { useCallback, useSyncExternalStore } from "react"

import {
  readPreferences,
  writePreferences,
  type Preferences,
} from "./preferences"
import { deviceStorage } from "./progress-storage"

// The preferences as a hook: read once from the device, and every screen that uses them (the
// player, the sound toggle in the header) sees a change at once.

let current: Preferences | null = null
const listeners = new Set<() => void>()

function snapshot(): Preferences {
  return (current ??= readPreferences(deviceStorage))
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function usePreferences() {
  const prefs = useSyncExternalStore(subscribe, snapshot, snapshot)
  const update = useCallback((patch: Partial<Preferences>) => {
    current = writePreferences(deviceStorage, patch)
    listeners.forEach((l) => l())
  }, [])
  return [prefs, update] as const
}
