import { describe, expect, it } from "vitest"

import {
  ninjaOf,
  PREFERENCES_KEY,
  readPreferences,
  soundOf,
  writePreferences,
} from "./preferences"

function memory(initial?: string) {
  const map = new Map<string, string>()
  if (initial !== undefined) map.set(PREFERENCES_KEY, initial)
  return {
    map,
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
  }
}

describe("preferences", () => {
  it("defaults to the sensei with sound on", () => {
    const prefs = readPreferences(memory())
    expect(ninjaOf(prefs)).toBe("sensei")
    expect(soundOf(prefs)).toBe(true)
  })

  it("mutes and unmutes under the web's key and shape", () => {
    const storage = memory()
    writePreferences(storage, { sound: "off" })
    expect(JSON.parse(storage.map.get("learn:preferences")!)).toEqual({
      sound: "off",
    })
    expect(soundOf(readPreferences(storage))).toBe(false)
    writePreferences(storage, { sound: "on" })
    expect(soundOf(readPreferences(storage))).toBe(true)
  })

  it("keeps the settings the app doesn't use when it writes", () => {
    const storage = memory(
      JSON.stringify({ textSize: "lg", uiLanguage: "ar", tray: "closed" })
    )
    writePreferences(storage, { sound: "off" })
    expect(JSON.parse(storage.map.get(PREFERENCES_KEY)!)).toEqual({
      textSize: "lg",
      uiLanguage: "ar",
      tray: "closed",
      sound: "off",
    })
  })

  it("brings the web's renamed characters up to date", () => {
    expect(readPreferences(memory('{"ninja":"normal"}')).ninja).toBe("casual")
    expect(readPreferences(memory('{"ninja":"caffeinated"}')).ninja).toBe(
      "sensei"
    )
    expect(readPreferences(memory('{"ninja":"off"}')).ninja).toBe("off")
  })

  it("ignores what it can't read", () => {
    expect(readPreferences(memory("{"))).toEqual({})
    expect(readPreferences(memory("null"))).toEqual({})
    expect(readPreferences(memory('{"ninja":"ronin","sound":1}'))).toEqual({})
  })
})
