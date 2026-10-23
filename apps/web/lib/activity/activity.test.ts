import { describe, expect, it } from "vitest"

import {
  activityLevels,
  addDays,
  buildGrid,
  dayDiff,
  describeDay,
  GRID_WEEKS,
  isTimeZone,
  localDay,
  streaks,
  weekdayOf,
} from "./activity"

describe("days", () => {
  it("buckets a moment into the learner's calendar day", () => {
    const late = new Date("2026-10-23T06:30:00Z")
    expect(localDay(late, "America/Los_Angeles")).toBe("2026-10-22")
    expect(localDay(late, "Asia/Tokyo")).toBe("2026-10-23")
    expect(localDay(late, "UTC")).toBe("2026-10-23")
  })

  it("keeps day arithmetic on the calendar across months, years, and DST", () => {
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01")
    expect(addDays("2026-01-01", -1)).toBe("2025-12-31")
    expect(addDays("2026-03-07", 2)).toBe("2026-03-09")
    expect(dayDiff("2026-03-07", "2026-03-09")).toBe(2)
    expect(dayDiff("2026-10-23", "2025-10-23")).toBe(-365)
    expect(weekdayOf("2026-10-23")).toBe(5) // Friday
    expect(weekdayOf("2026-10-25")).toBe(0) // Sunday
  })

  it("accepts real time zones only", () => {
    expect(isTimeZone("Europe/Rome")).toBe(true)
    expect(isTimeZone("Mars/Olympus")).toBe(false)
    expect(isTimeZone("")).toBe(false)
    expect(isTimeZone(null)).toBe(false)
  })
})

describe("levels", () => {
  const levels = (counts: number[]) => {
    const { levelOf } = activityLevels(counts)
    return counts.map(levelOf)
  }

  it("shades nothing when nothing was finished", () => {
    expect(activityLevels([0, 0]).cap).toBe(0)
    expect(levels([0, 0])).toEqual([0, 0])
  })

  it("makes the person's busiest day the darkest shade", () => {
    expect(levels([1, 1, 0])).toEqual([4, 4, 0])
    expect(levels([1, 2, 3, 4])).toEqual([1, 2, 3, 4])
    expect(levels([1, 2, 3, 5, 6, 7, 8, 10])).toEqual([1, 1, 2, 2, 3, 3, 4, 4])
  })

  it("re-shades older days when a new record lands", () => {
    expect(levels([4, 4, 4])).toEqual([4, 4, 4])
    expect(levels([4, 4, 4, 10])).toEqual([2, 2, 2, 4])
  })

  it("trims the top 1% of active days before setting the cap", () => {
    const counts = [...Array(120).fill(2), 3, 50]
    const { cap, levelOf } = activityLevels(counts)
    expect(cap).toBe(3)
    expect(levelOf(50)).toBe(4)
    expect(levelOf(2)).toBe(3)
    // Under 100 active days nothing is trimmed.
    expect(activityLevels([...Array(50).fill(2), 50]).cap).toBe(50)
  })
})

describe("streaks", () => {
  it("counts the run ending today, or yesterday", () => {
    const days = ["2026-10-19", "2026-10-20", "2026-10-21", "2026-10-22"]
    expect(streaks(days, "2026-10-22")).toEqual({ current: 4, longest: 4 })
    expect(streaks(days, "2026-10-23")).toEqual({ current: 4, longest: 4 })
    expect(streaks(days, "2026-10-24")).toEqual({ current: 0, longest: 4 })
  })

  it("keeps the longest run separately, in any order with duplicates", () => {
    const days = ["2026-10-23", "2026-05-03", "2026-05-01", "2026-05-02", "2026-05-02"]
    expect(streaks(days, "2026-10-23")).toEqual({ current: 1, longest: 3 })
    expect(streaks([], "2026-10-23")).toEqual({ current: 0, longest: 0 })
  })
})

describe("grid", () => {
  const today = "2026-10-23" // a Friday
  const rows = [
    { day: "2026-10-23", lessons: 2 },
    { day: "2026-10-22", lessons: 1 },
    { day: "2026-10-21", lessons: 4 },
    { day: "2025-10-18", lessons: 9 }, // the day before the window
    { day: "2025-10-19", lessons: 1 },
  ]
  const grid = buildGrid(rows, today)

  it("lays out 53 Sunday-first weeks ending today", () => {
    expect(grid.columns).toHaveLength(GRID_WEEKS)
    expect(grid.columns[0]![0]!.day).toBe("2025-10-19")
    const last = grid.columns.at(-1)!
    expect(last[5]!.day).toBe(today)
    expect(last[6]).toBeNull()
    expect(grid.columns.flat().filter(Boolean)).toHaveLength(370)
  })

  it("always covers today with 53 columns, whatever weekday it is", () => {
    for (const t of ["2026-10-18", "2026-10-24", "2026-02-28", "2024-02-29"]) {
      const g = buildGrid([], t)
      expect(g.columns).toHaveLength(GRID_WEEKS)
      expect(weekdayOf(g.columns[0]![0]!.day)).toBe(0)
      expect(g.columns.flat().filter(Boolean).at(-1)!.day).toBe(t)
    }
  })

  it("counts and shades only the displayed year, but streaks see every day", () => {
    expect(grid.total).toBe(8)
    expect(grid.cap).toBe(4)
    expect(grid.columns.at(-1)![3]).toEqual({ day: "2026-10-21", lessons: 4, level: 4 })
    expect(grid.columns.at(-1)![4]!.level).toBe(1)
    expect(grid.streak).toEqual({ current: 3, longest: 3 })
    expect(buildGrid([{ day: "2025-10-18", lessons: 9 }, { day: "2025-10-17", lessons: 9 }], today).streak)
      .toEqual({ current: 0, longest: 2 })
  })

  it("labels the first column of each month, dropping a first label that has no room", () => {
    // The window opens on 2025-10-19: November starts two columns in, too close for "Oct".
    expect(grid.months[0]).toEqual({ label: "Nov", column: 2 })
    expect(grid.months.at(-1)).toEqual({ label: "Oct", column: 50 })
    expect(grid.months).toHaveLength(12)
    // Opening on 2025-11-02 leaves a month of room, so November's label stays in column 0.
    const g = buildGrid([], "2026-11-06")
    expect(g.months[0]).toEqual({ label: "Nov", column: 0 })
    expect(g.months[1]).toEqual({ label: "Dec", column: 5 })
  })

  it("describes a day for the tooltip", () => {
    expect(describeDay({ day: "2026-10-21", lessons: 2, level: 1 })).toBe("2 lessons on October 21st")
    expect(describeDay({ day: "2026-10-01", lessons: 1, level: 1 })).toBe("1 lesson on October 1st")
    expect(describeDay({ day: "2026-11-12", lessons: 0, level: 0 })).toBe("No lessons on November 12th")
    expect(describeDay({ day: "2026-11-23", lessons: 3, level: 1 })).toBe("3 lessons on November 23rd")
  })
})
