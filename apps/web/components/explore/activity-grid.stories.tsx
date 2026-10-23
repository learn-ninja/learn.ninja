import type { Meta, StoryObj } from "@storybook/react-vite"

import { addDays, buildGrid, type Day } from "@/lib/activity/activity"

import { ActivityGrid } from "./activity-grid"

// The profile's year of learning: empty, a few days, a daily habit, and a record day that
// re-shades the rest. Today is fixed so the stories don't drift.

const TODAY: Day = "2026-10-23"

/** A deterministic set of days: `days` back from today, each given `lessons(i)` lessons. */
function days(
  count: number,
  lessons: (i: number) => number
): { day: Day; lessons: number }[] {
  return Array.from({ length: count }, (_, i) => ({
    day: addDays(TODAY, -i),
    lessons: lessons(i),
  })).filter((d) => d.lessons > 0)
}

let seed = 7
const random = () => {
  seed = (seed * 16807) % 2147483647
  return seed / 2147483647
}

function Activity({ rows }: { rows: { day: Day; lessons: number }[] }) {
  const grid = buildGrid(rows, TODAY)
  return (
    <section className="mx-auto max-w-2xl px-4">
      <ActivityGrid grid={grid} />
    </section>
  )
}

const meta = {
  title: "Explore/Activity grid",
  component: Activity,
  parameters: { layout: "padded" },
} satisfies Meta<typeof Activity>

export default meta
type Story = StoryObj<typeof meta>

/** A new account: the empty grid still shows, like GitHub's. */
export const Empty: Story = { args: { rows: [] } }

/** The first week: three lessons on three days, one of them today. */
export const FirstWeek: Story = {
  args: {
    rows: [
      { day: TODAY, lessons: 1 },
      { day: addDays(TODAY, -1), lessons: 2 },
      { day: addDays(TODAY, -2), lessons: 1 },
    ],
  },
}

/** Most days of the year, one to four lessons, with gaps: every shade in use. */
export const DailyHabit: Story = {
  args: {
    rows: days(365, () => {
      const r = random()
      return r < 0.3 ? 0 : r < 0.6 ? 1 : r < 0.85 ? 2 : r < 0.95 ? 3 : 4
    }),
  },
}

/** One ten-lesson day: the cap jumps, and the usual two-lesson days drop to the lightest green. */
export const RecordDay: Story = {
  args: {
    rows: [
      ...days(60, (i) => (i % 3 === 0 ? 0 : 2)),
      { day: addDays(TODAY, -10), lessons: 10 },
    ],
  },
}

/** A streak that ended yesterday still counts as current; one that ended earlier doesn't. */
export const StreakAtRisk: Story = {
  args: {
    rows: days(12, (i) => (i === 0 ? 0 : 1)),
  },
}
