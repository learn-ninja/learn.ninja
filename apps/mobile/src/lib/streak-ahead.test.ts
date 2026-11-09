import { describe, expect, it } from "vitest"

import { streakAhead } from "./streak-ahead"

describe("the streak ahead, with no more lessons", () => {
  it("spends the saved rest days, then ends the streak", () => {
    // Two learning days save a second rest day (one comes with the start).
    const ahead = streakAhead(["2026-11-07", "2026-11-08"], "2026-11-09", 5)
    expect(ahead.map((d) => [d.day, d.current, d.rest, d.stake])).toEqual([
      ["2026-11-09", 2, 2, "rest"],
      ["2026-11-10", 2, 1, "rest"],
      ["2026-11-11", 2, 0, "end"],
      ["2026-11-12", 0, 0, "none"],
      ["2026-11-13", 0, 0, "none"],
    ])
  })

  it("puts nothing at stake on a day that already has its lesson", () => {
    const [today, tomorrow] = streakAhead(["2026-11-09"], "2026-11-09", 2)
    expect(today).toMatchObject({ lit: true, current: 1, stake: "none" })
    // A first day saves one rest day: missing tomorrow spends it.
    expect(tomorrow).toMatchObject({ lit: false, current: 1, stake: "rest" })
  })

  it("has nothing at stake without a streak", () => {
    expect(
      streakAhead([], "2026-11-09", 3).every((d) => d.stake === "none")
    ).toBe(true)
    // A streak that ended long ago is no streak either.
    expect(streakAhead(["2026-10-01"], "2026-11-09", 1)[0]?.stake).toBe("none")
  })

  it("gives each day the week ending on it, as the streak screen shows it", () => {
    const [, tomorrow] = streakAhead(["2026-11-08", "2026-11-09"], "2026-11-09")
    expect(tomorrow?.week.map((d) => d.state).slice(-3)).toEqual([
      "lit",
      "lit",
      "open",
    ])
  })
})
