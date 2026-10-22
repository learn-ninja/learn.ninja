import type { Meta, StoryObj } from "@storybook/react-vite"

import { Visual } from "../visuals"
import { PlayerFrame } from "./fixtures"
import { visualKit, visualKitDiagram } from "./visual-kit"

// Every component of the built-in UI kit, each in its own sandboxed visual, as lessons show them.
// Overlays (dialogs, toasts, open menus, tooltips) should appear whole, sized to their content.

const meta = {
  title: "Player/Visual kit",
  parameters: { layout: "fullscreen" },
} satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

export const AllComponents: Story = {
  render: (_, { globals }) => (
    <PlayerFrame ui={globals.ui}>
      <div className="grid gap-6 p-8 sm:grid-cols-2">
        {visualKit.map((sample) => (
          <figure key={sample.name} className="flex flex-col gap-2">
            <figcaption className="text-sm font-medium text-muted-foreground">
              {sample.name}
            </figcaption>
            <Visual
              visual={{ kind: "html", html: sample.html }}
              label={sample.name}
            />
          </figure>
        ))}
        <figure className="flex flex-col gap-2">
          <figcaption className="text-sm font-medium text-muted-foreground">
            Diagram with icons
          </figcaption>
          <Visual
            visual={{
              kind: "diagram",
              d2: visualKitDiagram,
              alt: "A repo, a branch, and a pull request, each with its icon.",
            }}
            label="Diagram with icons"
          />
        </figure>
      </div>
    </PlayerFrame>
  ),
}
