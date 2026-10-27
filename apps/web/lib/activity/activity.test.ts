import { describe, expect, it } from "vitest"

import {
  activityLevels,
  addDays,
  buildGrid,
  dayDiff,
  dayStreak,
  streakAfterFinish,
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

/** `n` days in a row from `from`. */
const run = (from: string, n: number) =>
  Array.from({ length: n }, (_, i) => addDays(from, i))

describe("streaks", () => {
  it("counts the run while today is open, and saved rest days cover missed days", () => {
    // The rest day a streak starts with and the one the second day saves.
    const days = run("2026-10-19", 2)
    expect(streaks(days, "2026-10-20")).toEqual({ current: 2, longest: 2 })
    expect(streaks(days, "2026-10-21")).toEqual({ current: 2, longest: 2 })
    expect(streaks(days, "2026-10-22")).toEqual({ current: 2, longest: 2 })
    expect(streaks(days, "2026-10-23")).toEqual({ current: 2, longest: 2 })
    // The third missed day has nothing left to spend.
    expect(streaks(days, "2026-10-24")).toEqual({ current: 0, longest: 2 })
  })

  it("keeps a first day through one missed day, with the rest day it starts with", () => {
    const days = ["2026-10-19"]
    expect(streaks(days, "2026-10-21")).toEqual({ current: 1, longest: 1 })
    expect(streaks(days, "2026-10-22")).toEqual({ current: 0, longest: 1 })
  })

  it("keeps the run through a rest day without adding to it", () => {
    const days = [...run("2026-10-19", 3), "2026-10-23"]
    expect(streaks(days, "2026-10-23")).toEqual({ current: 4, longest: 4 })
  })

  it("saves two rest days at most", () => {
    // Nine learning days earn more, but only two are kept: two missed days pass, a third ends it.
    const days = run("2026-10-01", 9)
    expect(streaks([...days, "2026-10-12"], "2026-10-12").current).toBe(10)
    expect(streaks([...days, "2026-10-13"], "2026-10-13").current).toBe(1)
  })

  it("starts a broken run with one rest day, not the ones it had", () => {
    // Three days save both, and three missed days spend them and break the run. The new one starts
    // with one: a missed day passes, the second ends it.
    const days = [...run("2026-10-01", 3), "2026-10-07"]
    expect(streaks(days, "2026-10-09").current).toBe(1)
    expect(streaks(days, "2026-10-10").current).toBe(0)
  })

  it("keeps the longest run separately, in any order with duplicates", () => {
    const days = [
      "2026-10-23",
      "2026-05-03",
      "2026-05-01",
      "2026-05-02",
      "2026-05-02",
    ]
    expect(streaks(days, "2026-10-23")).toEqual({ current: 1, longest: 3 })
    expect(streaks([], "2026-10-23")).toEqual({ current: 0, longest: 0 })
  })

  it("gives the header the last seven days and the rest days saved", () => {
    const days = [...run("2026-10-19", 3), "2026-10-23", "2026-10-24"]
    expect(dayStreak(days, "2026-10-25")).toEqual({
      current: 5,
      longest: 5,
      rest: 2,
      toward: 0,
      recharged: false,
      days: [
        { day: "2026-10-19", state: "lit" },
        { day: "2026-10-20", state: "lit" },
        { day: "2026-10-21", state: "lit" },
        { day: "2026-10-22", state: "rest" },
        { day: "2026-10-23", state: "lit" },
        { day: "2026-10-24", state: "lit" },
        { day: "2026-10-25", state: "open" },
      ],
    })
    // Before the first lesson, days are missed; with none at all, today is open.
    expect(dayStreak([], "2026-10-25").days.at(-1)).toEqual({
      day: "2026-10-25",
      state: "open",
    })
    expect(dayStreak([], "2026-10-25").days[0]!.state).toBe("missed")
  })
})

describe("rest days", () => {
  const rest = (days: string[], today: string) => {
    const { rest, toward, recharged } = dayStreak(days, today)
    return { rest, toward, recharged }
  }

  it("starts a streak with one, counts learning days toward the next, and says when today recharged one", () => {
    const days = run("2026-10-19", 2)
    expect(rest(days.slice(0, 1), "2026-10-19")).toEqual({
      rest: 1,
      toward: 1,
      recharged: false,
    })
    expect(rest(days, "2026-10-20")).toEqual({
      rest: 2,
      toward: 0,
      recharged: true,
    })
    // By tomorrow, it's an ordinary saved day.
    expect(rest(days, "2026-10-21")).toEqual({
      rest: 2,
      toward: 0,
      recharged: false,
    })
  })

  it("pauses the count while both are saved, so spending one starts from empty", () => {
    // Two days fill both (one to start, one saved); seven more count for nothing.
    const days = run("2026-10-01", 9)
    expect(rest(days, "2026-10-09")).toEqual({
      rest: 2,
      toward: 0,
      recharged: false,
    })
    expect(rest(days.slice(0, 2), "2026-10-02")).toMatchObject({
      rest: 2,
      recharged: true,
    })
    // A day off spends one, and the next learning day is the first toward it.
    expect(rest(days, "2026-10-11")).toMatchObject({ rest: 1, toward: 0 })
    expect(rest([...days, "2026-10-11"], "2026-10-11")).toMatchObject({
      rest: 1,
      toward: 1,
    })
  })

  it("keeps the count through a rest day it spends", () => {
    // The first day counts one toward the next, a day off spends the one it started with, and the
    // next learning day recharges it: two learning days, not in a row.
    const days = ["2026-10-01"]
    expect(rest(days, "2026-10-02")).toEqual({
      rest: 1,
      toward: 1,
      recharged: false,
    })
    expect(rest(days, "2026-10-03")).toMatchObject({ rest: 0, toward: 1 })
    expect(rest([...days, "2026-10-03"], "2026-10-03")).toEqual({
      rest: 1,
      toward: 0,
      recharged: true,
    })
  })
})

describe("streak after finishing", () => {
  it("lights today when it has no lesson yet, and is null once it has one", () => {
    const days = run("2026-10-19", 3)
    const after = streakAfterFinish(days, "2026-10-22")!
    expect(after.current).toBe(4)
    expect(after.days.at(-1)).toEqual({ day: "2026-10-22", state: "lit" })
    expect(streakAfterFinish([...days, "2026-10-22"], "2026-10-22")).toBeNull()
  })

  it("starts again at 1 after a break, keeping the longest", () => {
    const after = streakAfterFinish(run("2026-10-01", 5), "2026-10-20")!
    // A new streak, with the rest day every new one starts with.
    expect(after).toMatchObject({ current: 1, longest: 5, rest: 1 })
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
    expect(grid.columns.at(-1)![3]).toEqual({
      day: "2026-10-21",
      lessons: 4,
      level: 4,
      rest: false,
    })
    expect(grid.columns.at(-1)![4]!.level).toBe(1)
    expect(grid.streak).toEqual({ current: 3, longest: 3 })
    expect(
      buildGrid(
        [
          { day: "2025-10-18", lessons: 9 },
          { day: "2025-10-17", lessons: 9 },
        ],
        today
      ).streak
    ).toEqual({ current: 0, longest: 2 })
  })

  it("marks the days a saved rest day kept in the streak, and no others", () => {
    // Wednesday had no lesson: the rest day the streak started with covered it.
    const g = buildGrid(
      [
        { day: "2026-10-20", lessons: 1 },
        { day: "2026-10-22", lessons: 1 },
      ],
      today
    )
    const last = g.columns.at(-1)!
    expect(last[3]).toEqual({
      day: "2026-10-21",
      lessons: 0,
      level: 0,
      rest: true,
    })
    expect(last[2]!.rest).toBe(false) // the day before the first lesson
    expect(last[4]!.rest).toBe(false) // a learning day
    expect(last[5]!.rest).toBe(false) // today, still open
    expect(g.streak).toEqual({ current: 2, longest: 2 })
    // One day's rest covers the next day; the day after ends the streak, and nothing after that
    // is a rest day.
    const broken = buildGrid([{ day: "2026-10-01", lessons: 1 }], today)
    const rests = broken.columns.flat().filter((c) => c?.rest)
    expect(rests.map((c) => c!.day)).toEqual(["2026-10-02"])
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
    const cell = (day: string, lessons: number, rest = false) => ({
      day,
      lessons,
      level: (lessons ? 1 : 0) as 0 | 1,
      rest,
    })
    expect(describeDay(cell("2026-10-21", 2))).toBe("2 lessons on October 21st")
    expect(describeDay(cell("2026-10-01", 1))).toBe("1 lesson on October 1st")
    expect(describeDay(cell("2026-11-12", 0))).toBe(
      "No lessons on November 12th"
    )
    expect(describeDay(cell("2026-11-23", 3))).toBe(
      "3 lessons on November 23rd"
    )
    expect(describeDay(cell("2026-10-25", 0, true))).toBe(
      "Rest day on October 25th"
    )
  })
})
