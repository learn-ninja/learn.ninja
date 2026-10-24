import type { Meta, StoryObj } from "@storybook/react-vite"

import type { ChessVisual, Lesson } from "@workspace/spec"

import { BrickDemo } from "../brick-demo"
import { Visual } from "../visuals"
import { lessons, PlayerFrame, prepared } from "./fixtures"

// Chess positions drawn from their FEN in the browser: the board keeps one look in both themes,
// and the marks and arrows take the accent. Switch the toolbar's theme and language to check both.

/** After 1. e4 e5 2. Nf3 Nc6 3. Bc4: the Italian Game, the bishop aiming at f7. */
const italian: ChessVisual = {
  kind: "chess",
  fen: "r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 3 3",
  alt: "The Italian Game: White's bishop on c4 aims at Black's weakest square, f7.",
  highlight: ["f7"],
  arrows: [{ from: "c4", to: "f7" }],
}

/** A knight fork: Nc7+ attacks the king on e8 and the rook on a8 at once. */
const fork: ChessVisual = {
  kind: "chess",
  fen: "r3k3/8/8/3N4/8/8/8/4K3 w - - 0 1",
  alt: "The white knight jumps to c7, attacking the black king on e8 and the rook on a8 at once.",
  highlight: ["e8", "a8"],
  arrows: [
    { from: "d5", to: "c7" },
    { from: "c7", to: "e8" },
    { from: "c7", to: "a8" },
  ],
}

const meta = {
  title: "Player/Chess",
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

export const Opening: Story = { args: { visual: italian } }

/** A route: an arrow may start where an earlier arrow brought the piece. */
export const Fork: Story = { args: { visual: fork } }

/** Seen from Black: rank 8 at the bottom and the files running h to a. */
export const Flipped: Story = { args: { visual: { ...italian, flip: true } } }

/** The boards in a lesson: a concept, and a question whose options are positions. */
const chessLesson: Lesson = {
  ...lessons.buttons,
  language: "en",
  bricks: [
    {
      id: "c1",
      type: "concept",
      title: "The fork",
      body: "A **fork** is one piece attacking two at once. Your opponent can only save one of them.",
      visual: fork,
    },
    {
      id: "p1",
      type: "choice",
      prompt: "Which move forks the king and the rook?",
      options: [
        {
          id: "a",
          visual: {
            kind: "chess",
            fen: "r3k3/2N5/8/8/8/8/8/4K3 b - - 0 1",
            alt: "The knight on c7, next to the king on e8 and the rook on a8.",
            highlight: ["c7"],
          },
        },
        {
          id: "b",
          visual: {
            kind: "chess",
            fen: "r3k3/8/5N2/8/8/8/8/4K3 b - - 0 1",
            alt: "The knight on f6, checking the king on e8.",
            highlight: ["f6"],
          },
          feedback:
            "Nf6+ checks the king, but the rook on a8 is out of the knight's reach.",
        },
        {
          id: "c",
          visual: {
            kind: "chess",
            fen: "r3k3/8/1N6/8/8/8/8/4K3 b - - 0 1",
            alt: "The knight on b6, attacking the rook on a8.",
            highlight: ["b6"],
          },
          feedback: "Nb6 attacks the rook on a8 only; the king isn't in check.",
        },
      ],
      correct: ["a"],
      multiple: false,
      explanation:
        "From c7 a knight reaches both e8 and a8, so Nc7+ wins the rook once the king moves.",
    },
    ...lessons.buttons.bricks.slice(2),
  ],
} as Lesson

export const InAConcept: Story = {
  args: { visual: fork },
  render: () => (
    <BrickDemo lesson={chessLesson} brickId="c1" prepared={prepared} />
  ),
}

export const AsOptions: Story = {
  args: { visual: fork },
  render: () => (
    <BrickDemo lesson={chessLesson} brickId="p1" prepared={prepared} />
  ),
}
