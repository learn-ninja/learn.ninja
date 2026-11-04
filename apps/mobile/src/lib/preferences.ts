import type { NinjaLevel, TextSize } from "@workspace/player-core/strings"

// The learner's player preferences, kept on the device under the web's key and in its shape
// (`learn:preferences`, packages/player/src/shell.tsx), so the two players read the same settings
// and nothing needs converting when settings sync later. The app reads the ninja's character and
// the sound so far; the rest is kept as it is, so a later write doesn't drop it.

export const PREFERENCES_KEY = "learn:preferences"

export interface Preferences {
  textSize?: TextSize
  uiLanguage?: string
  tray?: "open" | "closed"
  /** The ninja's voice and the player's sound effects (on until muted). */
  sound?: "on" | "off"
  /** The ninja's character (Sensei until changed). */
  ninja?: NinjaLevel
}

/** What the preferences are read from and written to: expo-sqlite's kv-store, or a map in tests. */
export interface PreferenceStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

const LEVELS: readonly NinjaLevel[] = ["off", "sensei", "casual", "unhinged"]
/** The characters were renamed on the web: Normal became Default (now Casual), and Sensei took Caffeinated's place. */
const RENAMED: Record<string, NinjaLevel> = {
  normal: "casual",
  default: "casual",
  caffeinated: "sensei",
}

/** The saved preferences, with the renamed characters brought up to date. Nothing saved, or unreadable, is none. */
export function readPreferences(storage: PreferenceStorage): Preferences {
  try {
    const saved = JSON.parse(storage.getItem(PREFERENCES_KEY) ?? "{}") as
      (Preferences & { ninja?: string }) | null
    if (!saved || typeof saved !== "object" || Array.isArray(saved)) return {}
    const out: Preferences & { ninja?: string } = { ...saved }
    if (out.ninja && out.ninja in RENAMED) out.ninja = RENAMED[out.ninja]
    if (out.ninja !== undefined && !LEVELS.includes(out.ninja as NinjaLevel))
      delete out.ninja
    if (out.sound !== undefined && out.sound !== "on" && out.sound !== "off")
      delete out.sound
    return out as Preferences
  } catch {
    return {}
  }
}

/** Saves a change on top of what's saved, keeping the settings the app doesn't use yet. */
export function writePreferences(
  storage: PreferenceStorage,
  patch: Partial<Preferences>
): Preferences {
  const next = { ...readPreferences(storage), ...patch }
  try {
    storage.setItem(PREFERENCES_KEY, JSON.stringify(next))
  } catch {
    // Not saved; the choice still applies until the app closes.
  }
  return next
}

/** The ninja's character, Sensei unless the learner chose another. */
export const ninjaOf = (prefs: Preferences): NinjaLevel =>
  prefs.ninja ?? "sensei"

/** Whether sound is on, as it is until the learner mutes it. */
export const soundOf = (prefs: Preferences): boolean => prefs.sound !== "off"
