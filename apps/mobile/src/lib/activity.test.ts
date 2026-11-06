import { describe, expect, it } from "vitest"

import { stringsFor } from "@workspace/player-core/strings"

import { columnX, describeDay, monthLabel, monthLabels, STEP } from "./activity"

const t = stringsFor("en")

describe("the activity grid", () => {
  it("names months and days in the language", () => {
    expect(monthLabel("2026-10-04", "en")).toBe("Oct")
    expect(monthLabel("2026-10-04", "de")).toBe("Okt")
    const cell = {
      day: "2026-10-21",
      lessons: 2,
      level: 2 as const,
      rest: false,
    }
    expect(describeDay(cell, "en", t)).toBe("2 lessons on October 21")
    expect(describeDay({ ...cell, lessons: 0, rest: true }, "en", t)).toBe(
      "Rest day on October 21"
    )
    expect(describeDay({ ...cell, lessons: 0 }, "en", t)).toBe(
      "No lessons on October 21"
    )
  })

  it("labels the columns the server picked, from each column's first day", () => {
    const day = (d: string) => ({
      day: d,
      lessons: 0,
      level: 0 as const,
      rest: false,
    })
    const grid = {
      total: 0,
      columns: [[day("2026-09-27")], [day("2026-10-04")]],
      months: [{ label: "Oct", column: 1 }],
      streak: { current: 0, longest: 0 },
    }
    expect(monthLabels(grid, "fr")).toEqual([{ column: 1, label: "oct." }])
  })

  it("puts the newest week at the end, on the left in right to left", () => {
    expect(columnX(0, 53, false)).toBe(0)
    expect(columnX(52, 53, false)).toBe(52 * STEP)
    expect(columnX(52, 53, true)).toBe(0)
  })
})
