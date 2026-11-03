import type { Meta, StoryObj } from "@storybook/react-vite"

import type { LessonSummary } from "@/lib/explore/queries"

import { LessonCards } from "./lesson-cards"

const TITLES: [string, string, number, LessonSummary["level"], string][] = [
  [
    "Offside in football, explained",
    "See exactly when a player is offside, and why most 'obvious' offsides aren't.",
    4,
    "beginner",
    "gene",
  ],
  [
    "git push: send your commits to GitHub",
    "See what git push sends, what it leaves behind, how to read the command, and what to do when it's rejected.",
    12,
    "beginner",
    "cmicpace",
  ],
  [
    "Atomic Habits: build habits that stick",
    "Learn why tiny habits add up and how James Clear's Four Laws make good ones easy to start and keep.",
    8,
    "beginner",
    "gene",
  ],
  [
    "How a website keeps you logged in",
    "You know what a server and a database are. See how a session cookie proves who you are after you log in.",
    6,
    "intermediate",
    "cmicpace",
  ],
  [
    "Why the sky is blue",
    "See how air turns white sunlight into a blue sky by day and an orange one at sunset.",
    4,
    "beginner",
    "cmicpace",
  ],
  [
    "Auto layout in Figma: the basics",
    "Stop nudging layers by hand. Build frames that space and resize themselves.",
    5,
    "beginner",
    "gene",
  ],
  [
    "The most famous chess openings",
    "Recognise the Italian Game, Ruy Lopez, Sicilian and Queen's Gambit from their first moves.",
    5,
    "beginner",
    "cmicpace",
  ],
  [
    "Coffee: why it works, when to drink it",
    "Learn how caffeine keeps you alert, when to stop drinking it, and how much is too much.",
    5,
    "beginner",
    "gene",
  ],
  [
    "Lost in the middle: why long prompts fail",
    "See why AI models miss details buried in long prompts, and how to lay out a prompt so your key instructions get followed.",
    8,
    "beginner",
    "gene",
  ],
  [
    "Less is more: design by subtraction",
    "See why removing things often makes a design better, and learn a quick test for what to cut.",
    7,
    "beginner",
    "gene",
  ],
]

const lessons: LessonSummary[] = TITLES.map(
  ([title, summary, minutes, level, handle], i) => ({
    id: `k3x9a2m${i}`,
    slug: title.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
    title,
    summary,
    subject: "programming",
    tags: [],
    level,
    minutes,
    language: "en",
    author: { id: handle, handle, name: handle, image: null },
    views: 10,
    likes: 2,
    origin: null,
    visibility: "public",
    hidden: false,
    createdAt: Date.now() - i * 864e5,
    expiresAt: null,
  })
)

const meta = {
  title: "Site/Made this week",
  component: LessonCards,
  parameters: { layout: "fullscreen" },
  args: { lessons },
  decorators: [
    (Story) => (
      <div className="dark min-h-screen bg-background py-10">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof LessonCards>

export default meta
type Story = StoryObj<typeof meta>

/** Two staggered rows of lesson cards, wider than the window and fading at its edges. */
export const Field: Story = {}

/** On a phone the rows drift slowly, opposite ways, and loop; hold one to stop it. */
export const Phone: Story = {
  globals: { viewport: { value: "mobile1", isRotated: false } },
}

/** A tablet drifts too; the static field starts at lg. */
export const Tablet: Story = {
  globals: { viewport: { value: "tablet", isRotated: false } },
}
