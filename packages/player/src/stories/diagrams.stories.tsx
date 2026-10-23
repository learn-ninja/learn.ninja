import type { Meta, StoryObj } from "@storybook/react-vite"

import { Visual } from "../visuals"
import { PlayerFrame } from "./fixtures"
import { diagramSamples, type DiagramSample } from "./visual-kit"

// Every kind of D2 drawing a lesson may use, drawn on the server into theme tokens like the web
// app does (prepare-examples.ts), in the lesson column's width. Each should read in light and dark.

function Sample({ sample, ui }: { sample: DiagramSample; ui: string }) {
  return (
    <PlayerFrame ui={ui}>
      <div className="mx-auto max-w-xl p-8">
        <Visual
          visual={{ kind: "diagram", d2: sample.d2, alt: sample.alt }}
          label={sample.name}
        />
      </div>
    </PlayerFrame>
  )
}

const meta = {
  title: "Player/Diagrams",
  parameters: { layout: "fullscreen" },
} satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

const byName = (name: string) => diagramSamples.find((s) => s.name === name)!

export const Flow: Story = {
  name: "Flow with icons",
  render: (_, { globals }) => (
    <Sample sample={byName("Flow with icons")} ui={globals.ui} />
  ),
}
export const Sequence: Story = {
  name: "Sequence diagram",
  render: (_, { globals }) => (
    <Sample sample={byName("Sequence diagram")} ui={globals.ui} />
  ),
}
export const Grid: Story = {
  render: (_, { globals }) => (
    <Sample sample={byName("Grid")} ui={globals.ui} />
  ),
}
export const Table: Story = {
  render: (_, { globals }) => (
    <Sample sample={byName("Table")} ui={globals.ui} />
  ),
}
