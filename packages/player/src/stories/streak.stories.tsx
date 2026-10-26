import type { Meta, StoryObj } from "@storybook/react-vite"

import { Lantern, RestDays, StreakWeek, type LanternLook } from "../streak"
import { PlayerFrame } from "./fixtures"

// The streak's lantern: small in the header and the week row, big on the streak screen. Lit, a
// small one turns yellow; the big one fills with candlelight and throws a halo.

const LOOKS: LanternLook[] = ["lit", "rest", "unlit", "ahead"]

const meta = {
  title: "Player/Streak",
  component: Lantern,
  argTypes: { look: { control: "inline-radio", options: LOOKS } },
  args: { look: "lit" },
  render: (args, { globals }) => (
    <PlayerFrame ui={globals.ui}>
      <div className="grid min-h-screen place-items-center">
        <Lantern {...args} big strokeWidth={1.25} className="size-28" />
      </div>
    </PlayerFrame>
  ),
} satisfies Meta<typeof Lantern>

export default meta
type Story = StoryObj<typeof meta>

/** The big lantern, as the streak screen shows it: switch `look` to watch it light. */
export const Big: Story = {}

const week = "lllrllo".split("").map((c, i) => ({
  day: `2026-10-${20 + i}`,
  state: ({ l: "lit", r: "rest", m: "missed", o: "open" } as const)[
    c as "l" | "r" | "m" | "o"
  ],
}))

/** Every look at the header's size, the week's size, and big. */
export const Looks: Story = {
  render: (_, { globals }) => (
    <PlayerFrame ui={globals.ui}>
      <div className="flex min-h-screen flex-col items-center justify-center gap-10 p-8">
        {(["size-4", "size-5", "size-12", "size-28"] as const).map((size) => (
          <div key={size} className="flex items-end gap-8">
            {LOOKS.map((look) => (
              <Lantern
                key={look}
                look={look}
                big={size === "size-28"}
                className={size}
                strokeWidth={
                  size === "size-28" ? 1.25 : size === "size-12" ? 1.5 : 2
                }
              />
            ))}
          </div>
        ))}
      </div>
    </PlayerFrame>
  ),
}

/** This week's row, as the header's popover and the streak screen show it. */
export const Week: Story = {
  render: (_, { globals }) => (
    <PlayerFrame ui={globals.ui}>
      <div className="grid min-h-screen place-items-center">
        <div className="w-64 rounded-xl bg-card p-4 shadow-xs ring-1 ring-foreground/10">
          <StreakWeek days={week} />
        </div>
      </div>
    </PlayerFrame>
  ),
}

/** Every state of the rest days, in the order a learner meets them. */
const REST_STATES = [
  { name: "No streak", rest: 0, toward: 0 },
  { name: "Day 1: starts with one", rest: 1, toward: 1 },
  { name: "Day 2: both saved", rest: 2, toward: 0, recharged: true },
  { name: "One spent", rest: 1, toward: 0 },
  { name: "One spent, day 1 back", rest: 1, toward: 1 },
  { name: "Both spent, day 1 back", rest: 0, toward: 1 },
]

/** The rest days under the week, in every state; press the info button for the rule. */
export const RestDayStates: Story = {
  name: "Rest days",
  render: (_, { globals }) => (
    <PlayerFrame ui={globals.ui}>
      <div className="grid min-h-screen grid-cols-[repeat(auto-fill,minmax(16rem,1fr))] content-center gap-4 p-8">
        {REST_STATES.map((s) => (
          <div key={s.name} className="flex flex-col gap-2">
            <p className="text-xs text-muted-foreground">{s.name}</p>
            <div className="rounded-xl bg-card p-3 text-sm shadow-xs ring-1 ring-foreground/10">
              <RestDays
                streak={{
                  rest: s.rest,
                  toward: s.toward,
                  recharged: s.recharged ?? false,
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </PlayerFrame>
  ),
}
