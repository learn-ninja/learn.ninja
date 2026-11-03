import type { Meta, StoryObj } from "@storybook/react-vite"

import { Bento } from "./bento"

const meta = {
  title: "Site/Bento",
  component: Bento,
  parameters: { layout: "fullscreen" },
  decorators: [
    (Story) => (
      <div className="dark min-h-screen bg-background py-10 text-foreground">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Bento>

export default meta
type Story = StoryObj<typeof meta>

/** The grid at the home page's column width: two halves over three thirds. */
export const Wide: Story = {}

/** Stacked, as a phone shows it: the kata as the phone player. */
export const Phone: Story = {
  globals: { viewport: { value: "mobile1", isRotated: false } },
}
