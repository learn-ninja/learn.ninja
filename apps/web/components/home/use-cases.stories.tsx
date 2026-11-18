import type { Meta, StoryObj } from "@storybook/react-vite"

import { UseCases } from "./use-cases"

const meta = {
  title: "Site/Use cases",
  component: UseCases,
  parameters: { layout: "fullscreen" },
  decorators: [
    (Story) => (
      <div className="dark min-h-screen bg-background text-foreground">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof UseCases>

export default meta
type Story = StoryObj<typeof meta>

/** Two by two at the home page's column width. */
export const Wide: Story = {}

/** One column, as a phone shows it. */
export const Phone: Story = {
  globals: { viewport: { value: "mobile1", isRotated: false } },
}
