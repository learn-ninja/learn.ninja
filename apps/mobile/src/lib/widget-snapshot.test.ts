import { describe, expect, it } from "vitest"

import { stringsFor } from "@workspace/player-core/strings"

import { widgetSnapshot } from "./widget-snapshot"

const t = stringsFor("en")

describe("the widget's snapshot", () => {
  it("writes a week of days ahead, with the streak each one starts with", () => {
    const snap = widgetSnapshot(
      ["2026-11-08", "2026-11-09"],
      "2026-11-09",
      null,
      t
    )
    expect(snap.days).toHaveLength(8)
    expect(snap.days[0]).toMatchObject({
      day: "2026-11-09",
      current: 2,
      lit: true,
      label: "day streak",
    })
    expect(snap.days[0]?.week.slice(-2)).toEqual(["lit", "lit"])
    // Tomorrow, with no lesson yet: still two, today's lantern lit and tomorrow's open.
    expect(snap.days[1]).toMatchObject({ current: 2, lit: false })
    expect(snap.days[1]?.week.slice(-2)).toEqual(["lit", "open"])
  })

  it("says there's no streak once it has ended", () => {
    const snap = widgetSnapshot(["2026-11-01"], "2026-11-09", null, t)
    expect(snap.days[0]).toMatchObject({
      current: 0,
      label: t.profile.noStreak,
    })
  })

  it("opens the lesson last left unfinished by the app's own link", () => {
    const snap = widgetSnapshot(
      [],
      "2026-11-09",
      { href: "/l/compound-interest", title: "How compound interest works" },
      t
    )
    expect(snap.last).toEqual({
      title: "How compound interest works",
      url: "learnninja://l/compound-interest",
    })
    expect(snap.strings.continue).toBe(t.continue)
  })
})
