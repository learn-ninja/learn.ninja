import { describe, expect, it } from "vitest"

import { addDays } from "@workspace/player-core/streak"

import { refreshAccountDays } from "./account-days"
import {
  ACCOUNT_DAYS_KEY,
  currentStreak,
  DAYS_KEY,
  FINISHED_PREFIX,
  forgetAccountDays,
  keepAccountDays,
  localDay,
  readDays,
  recordFinish,
  weekOf,
} from "./streak"

function memory(days?: string[]) {
  const map = new Map<string, string>()
  if (days) map.set(DAYS_KEY, JSON.stringify(days))
  return {
    map,
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
  }
}

const MON = "2026-11-02"
const day = (n: number) => addDays(MON, n)

/** Finishes a lesson on each of these days, in order, and returns the last result. */
function learnOn(storage: ReturnType<typeof memory>, ...offsets: number[]) {
  let last
  for (const n of offsets) last = recordFinish(storage, { today: day(n) })
  return last!
}

describe("the day streak on the device", () => {
  it("starts on the first finished lesson, with one rest day saved", () => {
    const storage = memory()
    const { streak, lit } = recordFinish(storage, { today: MON })
    expect(lit).toBe(true)
    expect(streak.current).toBe(1)
    expect(streak.rest).toBe(1)
    expect(streak.days.at(-1)).toEqual({ day: MON, state: "lit" })
  })

  it("lights today once: a replay or a second lesson the same day lights nothing new", () => {
    const storage = memory()
    recordFinish(storage, { today: MON })
    const again = recordFinish(storage, { today: MON })
    expect(again.lit).toBe(false)
    expect(again.streak.current).toBe(1)
    expect(readDays(storage)).toEqual([MON])
  })

  it("grows by one each day in a row, and keeps across days", () => {
    const storage = memory()
    const { streak } = learnOn(storage, 0, 1, 2, 3)
    expect(streak.current).toBe(4)
    expect(streak.longest).toBe(4)
    // Reading it back another day, before that day's lesson, it holds: today is still open.
    const tomorrow = currentStreak(storage, day(4))
    expect(tomorrow.current).toBe(4)
    expect(tomorrow.days.at(-1)).toEqual({ day: day(4), state: "open" })
  })

  it("spends a rest day on a missed day: the streak keeps but doesn't grow", () => {
    const storage = memory()
    learnOn(storage, 0, 1)
    // Day 2 is missed; a rest day covers it.
    const { streak } = learnOn(storage, 3)
    expect(streak.current).toBe(3)
    expect(streak.days.find((d) => d.day === day(2))?.state).toBe("rest")
  })

  it("never adds a frozen day to the count", () => {
    const storage = memory()
    learnOn(storage, 0, 1)
    const covered = currentStreak(storage, day(3))
    // Two learning days; day 2 was a rest day; day 3 is open.
    expect(covered.current).toBe(2)
    expect(covered.days.find((d) => d.day === day(2))?.state).toBe("rest")
  })

  it("saves a rest day every second learning day, up to two", () => {
    const storage = memory()
    expect(learnOn(storage, 0).streak).toMatchObject({ rest: 1, toward: 1 })
    expect(learnOn(storage, 1).streak).toMatchObject({
      rest: 2,
      toward: 0,
      recharged: true,
    })
    // Both saved: learning days don't count toward a third.
    expect(learnOn(storage, 2).streak).toMatchObject({ rest: 2, toward: 0 })
  })

  it("ends when a day is missed with no rest day left, and starts again", () => {
    const storage = memory()
    learnOn(storage, 0)
    // One rest day saved: day 1 spends it, day 2 ends the streak.
    const { streak } = learnOn(storage, 3)
    expect(streak.current).toBe(1)
    expect(streak.longest).toBe(1)
    expect(streak.days.find((d) => d.day === day(2))?.state).toBe("missed")
  })

  it("keeps a published lesson's finish under the web's key for sign-in", () => {
    const storage = memory()
    recordFinish(storage, { today: MON, id: "abc123", at: 1_700_000_000_000 })
    expect(JSON.parse(storage.map.get(`${FINISHED_PREFIX}abc123`)!)).toEqual({
      at: 1_700_000_000_000,
    })
    expect(FINISHED_PREFIX).toBe("learn:finished:")
    // A bundled lesson has no id on the server: only the day is kept.
    const local = memory()
    recordFinish(local, { today: MON })
    expect([...local.map.keys()]).toEqual([DAYS_KEY])
  })

  it("reads only well-formed days", () => {
    expect(readDays(memory(["2026-11-02", "nope", "2026-11-01"]))).toEqual([
      "2026-11-01",
      "2026-11-02",
    ])
    const broken = memory()
    broken.map.set(DAYS_KEY, "{")
    expect(readDays(broken)).toEqual([])
  })

  it("counts days on the device's own clock", () => {
    expect(localDay(new Date(2026, 0, 5, 23, 59))).toBe("2026-01-05")
    expect(localDay(new Date(2026, 11, 31, 0, 1))).toBe("2026-12-31")
  })
})

describe("the signed-in account's streak", () => {
  // The tester's case: four days in a row on the web, then a lesson in the app on the fifth. The
  // streak screen showed day 1 from the device's own (empty) days.
  const web = [day(0), day(1), day(2), day(3)]

  it("carries on the account's streak, not the device's", () => {
    const storage = memory()
    keepAccountDays(storage, { user: "ada", days: web, today: day(4) })
    const { streak, lit } = recordFinish(storage, { today: day(4) })
    expect(lit).toBe(true)
    expect(streak.current).toBe(5)
    // The device's own days are left alone: they're the logged-out streak.
    expect(storage.map.has(DAYS_KEY)).toBe(false)
    expect(readDays(storage)).toEqual([...web, day(4)])
  })

  it("lights nothing when the account already learned today, on the web", () => {
    const storage = memory()
    keepAccountDays(storage, { user: "ada", days: [...web, day(4)], today: day(4) })
    const { streak, lit } = recordFinish(storage, { today: day(4) })
    expect(lit).toBe(false)
    expect(streak.current).toBe(5)
  })

  it("matches the profile's walk, rest days included", () => {
    const storage = memory()
    // Day 2 missed on the account: a rest day covers it, and it doesn't count.
    keepAccountDays(storage, { user: "ada", days: [day(0), day(1), day(3)], today: day(4) })
    const { streak } = recordFinish(storage, { today: day(4) })
    expect(streak.current).toBe(4)
    expect(streak.days.find((d) => d.day === day(2))?.state).toBe("rest")
  })

  it("keeps this week's finishes the server hasn't got yet, and only for the same account", () => {
    const storage = memory()
    keepAccountDays(storage, { user: "ada", days: web, today: day(4) })
    recordFinish(storage, { today: day(4) })
    // The server answers before the finish landed: today stays.
    keepAccountDays(storage, { user: "ada", days: web, today: day(4) })
    expect(readDays(storage).at(-1)).toBe(day(4))
    // Another account's days replace them all.
    keepAccountDays(storage, { user: "bob", days: [day(1)], today: day(4) })
    expect(readDays(storage)).toEqual([day(1)])
    // A pending finish over a week old is the server's to have refused.
    keepAccountDays(storage, { user: "bob", days: [], today: day(9) })
    expect(readDays(storage)).toEqual([])
  })

  it("is the device's own again after signing out", () => {
    const storage = memory([day(3)])
    keepAccountDays(storage, { user: "ada", days: web, today: day(4) })
    expect(forgetAccountDays(storage)).toBe(true)
    expect(storage.map.has(ACCOUNT_DAYS_KEY)).toBe(false)
    expect(readDays(storage)).toEqual([day(3)])
    expect(forgetAccountDays(storage)).toBe(false)
  })

  it("keeps the server's days, and what the device had when the server can't answer", async () => {
    const storage = memory()
    const today = day(4)
    expect(
      await refreshAccountDays("ada", {
        storage,
        today,
        get: async () => ({ status: 200, days: [...web, "nope"] }),
      })
    ).toBe(true)
    expect(readDays(storage)).toEqual(web)
    for (const get of [
      async () => ({ status: 401 }),
      async () => ({ status: 500 }),
      async () => Promise.reject(new Error("offline")),
    ])
      expect(await refreshAccountDays("ada", { storage, today, get })).toBe(false)
    expect(readDays(storage)).toEqual(web)
  })
})

describe("weekOf", () => {
  it("lays out this week from the region's first day, today included", () => {
    // Wednesday 2026-11-04, in a Monday-first region: Mon and Tue done, Wed today, four to come.
    const storage = memory()
    learnOn(storage, 0, 1, 2)
    const week = weekOf(currentStreak(storage, day(2)).days, 1)
    expect(week.map((d) => d.day)).toEqual([0, 1, 2, 3, 4, 5, 6].map(day))
    expect(week.map((d) => d.state)).toEqual([
      "lit",
      "lit",
      "lit",
      "ahead",
      "ahead",
      "ahead",
      "ahead",
    ])
  })

  it("starts on Sunday where the region does", () => {
    const week = weekOf(currentStreak(memory(), day(2)).days, 0)
    expect(week[0]!.day).toBe(day(-1))
    expect(week).toHaveLength(7)
    expect(week[3]).toEqual({ day: day(2), state: "open" })
  })
})
