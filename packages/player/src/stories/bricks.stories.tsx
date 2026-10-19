import type { Meta, StoryObj } from "@storybook/react-vite"
import * as React from "react"

import type { Brick, QuestionBrick } from "@workspace/spec"

import {
  checkAnswer,
  initialAnswer,
  shuffle,
  solution,
  solutionMarks,
  type Answer,
  type Mark,
} from "../check"
import {
  BlankBrick,
  ConceptBrick,
  Explanation,
  explanationAnchor,
  HotspotBrick,
  MatchBrick,
  OptionsBrick,
} from "../bricks"
import { RichText } from "../rich-text"
import { OrderBrick } from "../order"
import { SortBrick } from "../sort"
import { Visual } from "../visuals"
import { lessons, PlayerFrame } from "./fixtures"

// Every brick, and every question brick in every state. Use the "state" control to switch between
// idle (interactive), wrong (after a first miss), correct, why (correct with the explanation open),
// and revealed (after a second miss: the last pick, the answer, and the explanation).

type Mode = "idle" | "wrong" | "correct" | "why" | "revealed"

interface HarnessProps {
  brick: Brick
  /** The wrong answer to show in the "wrong" state. Concept bricks have nothing to answer. */
  wrong?: Answer
  mode: Mode
}

/** A seeded shuffle, so idle stories look the same on every load. */
function seeded(seed = 7) {
  let s = seed
  return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646
}

function Harness({ brick, wrong, mode }: HarnessProps) {
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-5 px-4 py-8">
      {brick.type === "concept" ? (
        <ConceptBrick brick={brick} />
      ) : (
        <Question brick={brick} wrong={wrong!} mode={mode} />
      )}
    </div>
  )
}

function Question({
  brick,
  wrong,
  mode,
}: {
  brick: QuestionBrick
  wrong: Answer
  mode: Mode
}) {
  const start = (): Answer =>
    mode === "idle"
      ? initialAnswer(brick, seeded())
      : mode === "wrong"
        ? wrong
        : solution(brick)
  const [answer, setAnswer] = React.useState<Answer>(start)
  // As in the player: where marks name options, a revealed answer keeps the last pick's mark.
  const keepsPick = ["choice", "compare", "scenario", "hotspot"].includes(
    brick.type
  )
  const marks: Record<string, Mark> =
    mode === "idle"
      ? {}
      : mode === "wrong"
        ? checkAnswer(brick, wrong).marks
        : mode === "correct" || mode === "why"
          ? checkAnswer(brick, solution(brick)).marks
          : keepsPick
            ? { ...solutionMarks(brick), ...checkAnswer(brick, wrong).marks }
            : solutionMarks(brick)
  const explanation =
    mode === "why" || mode === "revealed" ? brick.explanation : null
  const props = { brick, answer, setAnswer, marks, locked: mode !== "idle" }
  const optionIds =
    "options" in brick
      ? (brick.options as { id: string }[]).map((o) => o.id)
      : []
  const showOutcomes =
    brick.type === "scenario" && mode !== "idle" && answer.kind === "select"
      ? answer.ids
      : []

  return (
    <>
      <h2 className="text-2xl font-bold tracking-tight text-balance">
        <RichText text={brick.prompt} />
      </h2>
      {brick.type === "scenario" ? (
        <div className="rounded-e-2xl border-s-[3px] border-primary bg-muted px-4 py-3">
          <RichText text={brick.situation} />
        </div>
      ) : null}
      {brick.visual && brick.type !== "hotspot" ? (
        <Visual visual={brick.visual} />
      ) : null}
      {brick.type === "choice" ||
      brick.type === "compare" ||
      brick.type === "scenario" ? (
        <OptionsBrick
          {...props}
          order={
            brick.type === "compare" ? optionIds : shuffle(optionIds, seeded())
          }
          showOutcomes={showOutcomes}
          explanation={explanation}
        />
      ) : brick.type === "hotspot" ? (
        <HotspotBrick {...props} />
      ) : brick.type === "sort" ? (
        <SortBrick {...props} />
      ) : brick.type === "order" ? (
        <OrderBrick {...props} />
      ) : brick.type === "match" ? (
        <MatchBrick
          {...props}
          rightOrder={shuffle(
            brick.pairs.map((_, i) => i),
            seeded()
          )}
        />
      ) : brick.type === "blank" ? (
        <BlankBrick
          {...props}
          bank={shuffle(
            [...new Set(brick.blanks.flatMap((b) => b.choices ?? []))],
            seeded()
          )}
        />
      ) : null}
      {explanation && !explanationAnchor(brick, marks) ? (
        <Explanation text={explanation} />
      ) : null}
    </>
  )
}

const meta = {
  title: "Player/Bricks",
  component: Harness,
  argTypes: {
    mode: {
      name: "state",
      control: "inline-radio",
      options: ["idle", "wrong", "correct", "why", "revealed"],
    },
    brick: { control: false },
    wrong: { control: false },
  },
  args: { mode: "idle" },
  render: (args, { globals }) => (
    <PlayerFrame ui={globals.ui}>
      <Harness key={`${args.mode}-${globals.ui}`} {...args} />
    </PlayerFrame>
  ),
} satisfies Meta<typeof Harness>

export default meta
type Story = StoryObj<typeof meta>

const { buttons, prd, compound, spanish, coding, bronze } = lessons
/** A lesson's nth concept brick. */
const concept = (l: typeof buttons, n: number) =>
  l.bricks.filter((b) => b.type === "concept")[n]!
/** The i-th question brick after a lesson's nth concept brick. */
const practice = (l: typeof buttons, n: number, i: number) =>
  l.bricks[l.bricks.indexOf(concept(l, n)) + 1 + i]!

/** Concept bricks have no answer, so the state control does nothing for them. */
const noState = { mode: { table: { disable: true } } } as const

export const Concept: Story = {
  name: "Concept, visual",
  args: { brick: concept(buttons, 0) },
  argTypes: noState,
}
export const ConceptDiagram: Story = {
  name: "Concept, diagram",
  args: { brick: concept(bronze, 2) },
  argTypes: noState,
}
export const ConceptFormula: Story = {
  name: "Concept, formula",
  args: { brick: concept(compound, 0) },
  argTypes: noState,
}

export const MultipleChoice: Story = {
  args: {
    brick: practice(buttons, 0, 0),
    wrong: { kind: "select", ids: ["b"] },
  },
}
export const MultipleChoiceWithCode: Story = {
  args: {
    brick: practice(coding, 0, 1),
    wrong: { kind: "select", ids: ["b"] },
  },
}
export const MultipleChoiceVisual: Story = {
  name: "Multiple Choice, visual",
  args: {
    brick: practice(compound, 1, 2),
    wrong: { kind: "select", ids: ["b"] },
  },
}
export const MultiSelect: Story = {
  args: {
    brick: practice(prd, 0, 1),
    wrong: { kind: "select", ids: ["a", "c"] },
  },
}
export const MultiSelectVisual: Story = {
  name: "Multi Select, visual",
  args: {
    brick: practice(buttons, 1, 2),
    wrong: { kind: "select", ids: ["a", "b"] },
  },
}
export const CompareVisual: Story = {
  name: "Compare (A vs B), visual",
  args: { brick: buttons.hook, wrong: { kind: "select", ids: ["a"] } },
}
export const CompareText: Story = {
  name: "Compare (A vs B), text",
  args: {
    brick: practice(compound, 1, 1),
    wrong: { kind: "select", ids: ["b"] },
  },
}
export const HotspotHtml: Story = {
  name: "Hotspot, HTML",
  args: {
    brick: practice(buttons, 0, 1),
    wrong: { kind: "select", ids: ["create"] },
  },
}
export const HotspotCode: Story = {
  name: "Hotspot, code lines",
  args: {
    brick: practice(coding, 1, 1),
    wrong: { kind: "select", ids: ["l1"] },
  },
}
export const Sort: Story = {
  name: "Sort, three groups",
  args: {
    brick: practice(buttons, 1, 0),
    wrong: {
      kind: "zones",
      zones: { pool: [], pri: ["a"], sec: ["c"], ter: ["b", "d", "e"] },
    },
  },
}
export const SortTwoGroups: Story = {
  name: "Sort, two groups",
  args: {
    brick: practice(coding, 1, 0),
    wrong: {
      kind: "zones",
      zones: { pool: [], map: ["a", "b"], each: ["c", "d"] },
    },
  },
}
export const OrderVisual: Story = {
  name: "Order, visual items",
  args: {
    brick: practice(buttons, 1, 1),
    wrong: { kind: "sequence", slots: ["c", "a", "b"], pool: [] },
  },
}
export const OrderText: Story = {
  name: "Order, dialogue",
  args: {
    brick: spanish.challenge,
    wrong: { kind: "sequence", slots: ["b", "a", "c", "d"], pool: [] },
  },
}
export const Match: Story = {
  args: {
    brick: practice(spanish, 0, 0),
    wrong: { kind: "pairs", links: { 0: 1, 1: 0, 2: 2, 3: 3 } },
  },
}
export const BlankText: Story = {
  name: "Blank, word chips",
  args: {
    brick: practice(spanish, 1, 0),
    wrong: { kind: "gaps", values: { c: "Dónde", g: "gracias" } },
  },
}
export const BlankCode: Story = {
  name: "Blank, code",
  args: {
    brick: practice(coding, 0, 0),
    wrong: { kind: "gaps", values: { m: "forEach" } },
  },
}
export const Scenario: Story = {
  args: { brick: buttons.challenge, wrong: { kind: "select", ids: ["b"] } },
}
