import type { Meta, StoryObj } from "@storybook/react-vite"

import { everyVisual, type ChartVisual } from "@workspace/spec"

import { Visual } from "../visuals"
import { lessons, PlayerFrame } from "./fixtures"

// Every chart type, as drawn on the server from the example lessons: a scatter from correlation vs
// causation and a function chart from compound interest. Charts are plain SVG in theme tokens, so
// switch the toolbar's theme to check both.

const charts = Object.values(lessons).flatMap((lesson) =>
  everyVisual(lesson).flatMap(({ visual, path }) =>
    visual.kind === "chart" ? [{ chart: visual, path }] : []
  )
)
const chartOf = (type: ChartVisual["type"]) =>
  charts.find((c) => c.chart.type === type)!.chart

const meta = {
  title: "Player/Charts",
  component: Visual,
  argTypes: { visual: { control: false } },
  decorators: [
    (Story) => (
      <PlayerFrame>
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

/** Every chart in the example lessons, with where it comes from. */
export const AllCharts: Story = {
  args: { visual: chartOf("scatter") },
  render: () => (
    <div className="flex flex-col gap-8">
      {charts.map(({ chart, path }) => (
        <figure key={path} className="flex flex-col gap-2">
          <Visual visual={chart} plain={false} />
          <figcaption className="text-sm text-muted-foreground">
            {chart.type}: {path}
          </figcaption>
        </figure>
      ))}
    </div>
  ),
}
