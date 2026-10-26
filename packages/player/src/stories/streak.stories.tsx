import type { Meta, StoryObj } from "@storybook/react-vite"

import { Lantern, StreakWeek, type LanternLook } from "../streak"
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
