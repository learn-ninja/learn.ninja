import type { Meta, StoryObj } from "@storybook/react-vite"

import { HeroDemo } from "./hero-demo"

const meta = {
  title: "Site/Hero demo",
  component: HeroDemo,
  parameters: { layout: "centered" },
  decorators: [
    (Story) => (
      <div className="dark w-[720px] max-w-full bg-background p-6">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof HeroDemo>

export default meta
type Story = StoryObj<typeof meta>

/** The skill in a terminal, the page's default. */
export const Cli: Story = { args: { setup: "cli" } }

/** The MCP server in a chat window. */
export const Mcp: Story = { args: { setup: "mcp" } }
