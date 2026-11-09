import { describe, expect, it } from "vitest"

import { stringsFor } from "@workspace/player-core/strings"

import { atHour, planReminders, REMINDER_HOUR } from "./reminder-plan"

const t = stringsFor("en")
const en = t

describe("the evening streak reminders", () => {
  it("goes out each evening the streak is at stake, until it would end", () => {
    // Two learning days: two rest days saved, so tonight and tomorrow spend one, then it ends.
    const plan = planReminders(
      ["2026-11-07", "2026-11-08"],
      "2026-11-09",
      new Date(2026, 10, 9, 9),
      t
    )
    expect(plan.map((r) => [r.at.getDate(), r.kind])).toEqual([
      [9, "rest"],
      [10, "rest"],
      [11, "end"],
    ])
    expect(plan.every((r) => r.at.getHours() === REMINDER_HOUR)).toBe(true)
    expect(plan[2]).toMatchObject({
      title: en.reminders.endTitle,
      body: en.reminders.endBody,
    })
  })

  it("sends none tonight once today's lesson is done", () => {
    const plan = planReminders(
      ["2026-11-08", "2026-11-09"],
      "2026-11-09",
      new Date(2026, 10, 9, 9),
      t
    )
    expect(plan[0]?.at.getDate()).toBe(10)
  })

  it("skips tonight's once the evening has passed", () => {
    const plan = planReminders(
      ["2026-11-08"],
      "2026-11-09",
      new Date(2026, 10, 9, 21),
      t
    )
    expect(plan.every((r) => r.at > new Date(2026, 10, 9, 21))).toBe(true)
  })

  it("sends nothing without a streak", () => {
    expect(planReminders([], "2026-11-09", new Date(2026, 10, 9), t)).toEqual(
      []
    )
  })

  it("reads a day on the device's own clock", () => {
    const at = atHour("2026-03-29", 19)
    expect([
      at.getFullYear(),
      at.getMonth(),
      at.getDate(),
      at.getHours(),
    ]).toEqual([2026, 2, 29, 19])
  })
})
