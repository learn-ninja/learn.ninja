import { Storage } from "expo-sqlite/kv-store"

import type { ProgressStorage } from "@workspace/player-core/progress"

/**
 * Where the app keeps each lesson's progress: expo-sqlite's key-value store, which is synchronous
 * like the web's localStorage, so a lesson opens on the kata the learner left without a blank
 * frame first. player-core/progress.ts decides what's kept and how it's restored.
 */
export const deviceStorage: ProgressStorage = {
  get length() {
    return Storage.getLengthSync()
  },
  key: (index) => Storage.getKeyByIndexSync(index),
  getItem: (key) => Storage.getItemSync(key),
  setItem: (key, value) => Storage.setItemSync(key, value),
  removeItem: (key) => {
    Storage.removeItemSync(key)
  },
}
