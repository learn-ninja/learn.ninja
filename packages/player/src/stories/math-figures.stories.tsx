import type { Meta, StoryObj } from "@storybook/react-vite"

import type { Lesson, Visual as VisualSpec } from "@workspace/spec"

import { BrickDemo } from "../brick-demo"
import { Visual } from "../visuals"
import { lessons, PlayerFrame, prepared } from "./fixtures"
import { chartSamples } from "./visual-kit"

// The small math figures a lesson draws from a few numbers: number lines, fractions, clocks, and
// function charts with marked points (a coordinate plane when there are no curves). All in theme
// tokens, so switch the toolbar's theme to check both.

const meta = {
  title: "Player/Math figures",
  component: Visual,
  argTypes: { visual: { control: false } },
  decorators: [
    (Story, { globals }) => (
      <PlayerFrame ui={globals.ui}>
        <div className="mx-auto max-w-2xl p-8">
          <Story />
        </div>
      </PlayerFrame>
    ),
  ],
} satisfies Meta<typeof Visual>

export default meta
type Story = StoryObj<typeof meta>

const figure = (visual: VisualSpec) => ({ args: { visual } })

/** Counting on: 3 + 4 as a hop of 4 from 3. */
export const Addition: Story = figure({
  kind: "numberline",
  alt: "A hop of 4 from 3 lands on 7.",
  min: 0,
  max: 10,
  jumps: [{ from: 3, to: 7, label: "+4" }],
  points: [{ value: 7, label: "7" }],
})

/** Counting on one at a time, then back. */
export const Hops: Story = figure({
  kind: "numberline",
  alt: "Three hops of 1 from 2 to 5, then a hop back of 2 to 3.",
  min: 0,
  max: 6,
  jumps: [
    { from: 2, to: 3, label: "+1" },
    { from: 3, to: 4, label: "+1" },
    { from: 4, to: 5, label: "+1" },
    { from: 5, to: 3, label: "−2" },
  ],
})

/** An inequality: x > −2, an open dot and a ray. */
export const Inequality: Story = figure({
  kind: "numberline",
  alt: "x is greater than −2: an open dot at −2 and the line shaded to the right.",
  min: -5,
  max: 5,
  ranges: [{ from: -2, fromOpen: true }],
})

/** An interval: −1 ≤ x < 3. */
export const Interval: Story = figure({
  kind: "numberline",
  alt: "x from −1, included, up to 3, left out.",
  min: -4,
  max: 4,
  ranges: [{ from: -1, to: 3, toOpen: true }],
})

/** Fractions on the line from 0 to 2, by quarters, numbered as fractions. */
export const Quarters: Story = figure({
  kind: "numberline",
  alt: "The line from 0 to 2 in quarters, with A at 3/4 and B at 5/4.",
  min: 0,
  max: 2,
  step: 0.25,
  fractions: true,
  points: [
    { value: 0.75, label: "A" },
    { value: 1.25, label: "B" },
  ],
})

/** A fraction wall: one half is two quarters is four eighths. */
export const FractionWall: Story = figure({
  kind: "fraction",
  alt: "Three bars of the same length: one half, two quarters, and four eighths shaded, all the same length.",
  fractions: [
    { parts: 2, shaded: 1 },
    { parts: 4, shaded: 2 },
    { parts: 8, shaded: 4 },
  ],
})

export const FractionCircles: Story = figure({
  kind: "fraction",
  shape: "circle",
  alt: "Two circles: three quarters shaded, and two thirds shaded.",
  fractions: [
    { parts: 4, shaded: 3 },
    { parts: 3, shaded: 2 },
  ],
})

export const Clock: Story = figure({
  kind: "clock",
  alt: "A clock showing a quarter to four.",
  time: "3:45",
})

/** For reading the time from the hands alone. */
export const ClockWithoutNumbers: Story = figure({
  kind: "clock",
  alt: "A clock with no numbers, showing ten past ten.",
  time: "10:10",
  numbers: false,
})

/** A curve with its roots and vertex marked. */
export const ChartPoints: Story = figure(chartSamples[0]!.chart)

/** Points only: a coordinate plane, with equal units on both axes. */
export const CoordinatePlane: Story = figure(chartSamples[1]!.chart)

/** Clocks as the options of a question, drawn smaller on the cards. */
const clockLesson: Lesson = {
  ...lessons.buttons,
  bricks: [
    {
      id: "p1",
      type: "choice",
      prompt: "Which clock shows a quarter to four?",
      options: [
        {
          id: "a",
          visual: { kind: "clock", alt: "A clock at 3:45.", time: "3:45" },
        },
        {
          id: "b",
          visual: { kind: "clock", alt: "A clock at 4:15.", time: "4:15" },
          feedback: "That's a quarter past four: the minute hand is on the 3.",
        },
        {
          id: "c",
          visual: { kind: "clock", alt: "A clock at 9:20.", time: "9:20" },
          feedback:
            "The hands are swapped: the short hand shows the hour, near the 4.",
        },
      ],
      correct: ["a"],
      multiple: false,
      explanation:
        "A quarter to four is 3:45: the minute hand on the 9, and the hour hand most of the way to the 4.",
    },
    ...lessons.buttons.bricks.slice(1),
  ],
} as Lesson

export const ClocksAsOptions: Story = {
  args: { visual: { kind: "clock", time: "3:45" } },
  render: () => (
    <BrickDemo lesson={clockLesson} brickId="p1" prepared={prepared} />
  ),
}
