import type { Meta, StoryObj } from "@storybook/react-vite"

import { everyVisual, type ChartVisual } from "@workspace/spec"

import { Visual } from "../visuals"
import { lessons, PlayerFrame } from "./fixtures"
import { chartSamples } from "./visual-kit"

// Every chart type, drawn on the server from example lessons and hand-written chartSamples
// (prepared by stories:prepare). Charts are plain SVG in theme tokens, so switch the toolbar's
// theme to check both.

const charts = Object.values(lessons).flatMap((lesson) =>
  everyVisual(lesson).flatMap(({ visual, path }) =>
    visual.kind === "chart" ? [{ chart: visual, path }] : []
  )
)
const chartOf = (type: ChartVisual["type"]) =>
  charts.find((c) => c.chart.type === type)!.chart
const sample = (name: string) =>
  chartSamples.find((s) => s.name === name)!.chart
// Charts on option and item cards are drawn at the compact size.
const onCard = (path: string) => /\.(options|items)\[/.test(path)
const everyChart = [
  ...charts,
  ...chartSamples.map(({ name, chart }) => ({
    chart,
    path: `sample: ${name}`,
  })),
]

const meta = {
  title: "Player/Charts",
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

/** Two curves sampled from expressions ("1000 * 1.07^x" and "1000 + 70x"), named at their ends. */
export const Function: Story = {
  args: { visual: chartOf("function") },
}

export const Scatter: Story = {
  args: { visual: chartOf("scatter") },
}

/** Monthly shop sales: category labels stay in calendar order, with a zero baseline. */
export const Bar: Story = {
  args: { visual: sample("Monthly sales") },
}

/** Three cities' illustrative monthly temperatures, with each series named at its end. */
export const Line: Story = {
  args: { visual: sample("City temperatures") },
}

/** Every chart in the example lessons and the hand-written samples, with where it comes from. */
export const AllCharts: Story = {
  args: { visual: chartOf("scatter") },
  render: () => (
    <div className="flex flex-col gap-8">
      {everyChart.map(({ chart, path }) => (
        <figure key={path} className="flex flex-col gap-2">
          <Visual visual={chart} plain={onCard(path)} />
          <figcaption className="text-sm text-muted-foreground">
            {chart.type}: {path}
          </figcaption>
        </figure>
      ))}
    </div>
  ),
}
