import type { Strings } from "@workspace/player-core/strings"

import type { ActivityCell, ActivityGridData } from "./feed"

// The activity grid's words and layout, pure for tests: the web draws it in
// apps/web/components/explore/activity-grid.tsx from lib/activity's buildGrid, which the server
// runs for the app too (the levels follow the GitHub rule there: equal-width bands up to the
// person's trimmed busiest day).

/** A cell's side and the gap between cells, in points (the web's size-2.5 legend and 3px gap). */
export const CELL = 10
export const GAP = 3
export const STEP = CELL + GAP

/** "Oct" in the language, for a month label over the column that starts with `day` (YYYY-MM-DD). */
export function monthLabel(day: string, lang: string): string {
  const [y, m] = day.split("-").map(Number) as [number, number]
  return new Intl.DateTimeFormat(lang, {
    month: "short",
    timeZone: "UTC",
  }).format(Date.UTC(y, m - 1, 1))
}

/** The month labels, in the language, each with the column it sits over. */
export function monthLabels(grid: ActivityGridData, lang: string) {
  return grid.months.flatMap((m) => {
    const first = grid.columns[m.column]?.find(Boolean)
    return first
      ? [{ column: m.column, label: monthLabel(first.day, lang) }]
      : []
  })
}

/** What one day says when it's tapped, and to screen readers: "2 lessons on 21 Oct". */
export function describeDay(cell: ActivityCell, lang: string, t: Strings) {
  const [y, m, d] = cell.day.split("-").map(Number) as [number, number, number]
  const date = new Intl.DateTimeFormat(lang, {
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  }).format(Date.UTC(y, m - 1, d))
  if (cell.rest) return t.profile.dayRest(date)
  if (cell.lessons === 0) return t.profile.dayNone(date)
  return t.profile.dayLessons(cell.lessons, date)
}

/** A column's x in the drawing: the newest week at the end, which is the left in right to left. */
export function columnX(column: number, columns: number, rtl: boolean) {
  return (rtl ? columns - 1 - column : column) * STEP
}
