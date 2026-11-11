import type { Meta, StoryObj } from "@storybook/react-vite"
import * as React from "react"

import type { Kata, QuestionKata } from "@workspace/spec"

import {
  checkAnswer,
  initialAnswer,
  shuffle,
  solution,
  solutionMarks,
  type Answer,
  type Mark,
} from "@workspace/player-core/check"
import {
  BlankKata,
  ConceptKata,
  Explanation,
  explanationAnchor,
  HotspotKata,
  MatchKata,
  OptionsKata,
} from "../katas"
import { RichText } from "../rich-text"
import { OrderKata } from "../order"
import { SortKata } from "../sort"
import { scenarioTurns } from "../chat"
import { Visual } from "../visuals"
import { lessons, PlayerFrame } from "./fixtures"

// Every kata, and every question kata in every state. Use the "state" control to switch between
// idle (interactive), wrong (after a first miss), correct, why (correct with the explanation open),
// and revealed (after a second miss: the last pick, the answer, and the explanation). A question
// with a `reveal` swaps its visual for it once the answer is in (correct, why, revealed), and a
// stepped concept has a "steps" control for how much of its body is showing.

type Mode = "idle" | "wrong" | "correct" | "why" | "revealed"

interface HarnessProps {
  kata: Kata
  /** The wrong answer to show in the "wrong" state. Concept katas have nothing to answer. */
  wrong?: Answer
  /** Where the "idle" state starts, for a kata shown partway through. */
  start?: Answer
  /** A stepped concept: how many steps of its body are showing (each Continue shows one more). */
  steps?: number
  mode: Mode
}

/** A seeded shuffle, so idle stories look the same on every load. */
function seeded(seed = 7) {
  let s = seed
  return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646
}

function Harness({ kata, wrong, start, steps, mode }: HarnessProps) {
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-5 px-4 py-8">
      {kata.type === "concept" ? (
        // Keyed by the step, so the newest one fades in as it does in the player.
        <ConceptKata key={steps} kata={kata} steps={steps} />
      ) : (
        <Question kata={kata} wrong={wrong!} start={start} mode={mode} />
      )}
    </div>
  )
}

function Question({
  kata,
  wrong,
  start: from,
  mode,
}: {
  kata: QuestionKata
  wrong: Answer
  start?: Answer
  mode: Mode
}) {
  const start = (): Answer =>
    mode === "idle"
      ? (from ?? initialAnswer(kata, seeded()))
      : mode === "wrong"
        ? wrong
        : solution(kata)
  const [answer, setAnswer] = React.useState<Answer>(start)
  // As in the player: where marks name options, a revealed answer keeps the last pick's mark.
  const keepsPick = ["choice", "compare", "scenario", "hotspot"].includes(
    kata.type
  )
  const marks: Record<string, Mark> =
    mode === "idle"
      ? {}
      : mode === "wrong"
        ? checkAnswer(kata, wrong).marks
        : mode === "correct" || mode === "why"
          ? checkAnswer(kata, solution(kata)).marks
          : keepsPick
            ? { ...solutionMarks(kata), ...checkAnswer(kata, wrong).marks }
            : solutionMarks(kata)
  const explanation =
    mode === "why" || mode === "revealed" ? kata.explanation : null
  const props = { kata, answer, setAnswer, marks, locked: mode !== "idle" }
  const optionIds =
    "options" in kata ? (kata.options as { id: string }[]).map((o) => o.id) : []
  // A chat scenario shows the pick's outcome as a reply in the chat, not under the row.
  const chatty = kata.type === "scenario" && kata.visual?.kind === "chat"
  const showOutcomes =
    kata.type === "scenario" &&
    mode !== "idle" &&
    answer.kind === "select" &&
    !chatty
      ? answer.ids
      : []
  const phase =
    mode === "idle" ? "answering" : mode === "revealed" ? "revealed" : "feedback"
  // As in the player (visualShown): the reveal takes the visual's place once the answer is in.
  const answered = mode === "correct" || mode === "why" || mode === "revealed"
  const shown =
    answered &&
    kata.visual &&
    kata.reveal &&
    kata.type !== "hotspot" &&
    kata.type !== "scenario"
      ? kata.reveal
      : kata.visual

  return (
    <>
      <h2 className="text-lg font-semibold">
        <RichText text={kata.prompt} />
      </h2>
      {kata.type === "scenario" ? (
        <div className="rounded-e-2xl border-s-[3px] border-primary bg-muted px-4 py-3">
          <RichText text={kata.situation} />
        </div>
      ) : null}
      {shown && kata.type !== "hotspot" ? (
        <Visual
          key={shown === kata.reveal ? "reveal" : "visual"}
          visual={shown}
          turns={scenarioTurns(kata, answer, phase)}
        />
      ) : null}
      {kata.type === "choice" ||
      kata.type === "compare" ||
      kata.type === "scenario" ? (
        <OptionsKata
          {...props}
          order={
            kata.type === "compare" ? optionIds : shuffle(optionIds, seeded())
          }
          showOutcomes={showOutcomes}
          explanation={explanation}
        />
      ) : kata.type === "hotspot" ? (
        <HotspotKata {...props} />
      ) : kata.type === "sort" ? (
        <SortKata {...props} />
      ) : kata.type === "order" ? (
        <OrderKata {...props} />
      ) : kata.type === "match" ? (
        <MatchKata
          {...props}
          rightOrder={shuffle(
            kata.pairs.map((_, i) => i),
            seeded()
          )}
        />
      ) : kata.type === "blank" ? (
        <BlankKata
          {...props}
          bank={shuffle(
            [...new Set(kata.blanks.flatMap((b) => b.choices ?? []))],
            seeded()
          )}
        />
      ) : null}
      {explanation && !explanationAnchor(kata, marks) ? (
        <Explanation text={explanation} />
      ) : null}
    </>
  )
}

const meta = {
  title: "Player/Katas",
  component: Harness,
  argTypes: {
    mode: {
      name: "state",
      control: "inline-radio",
      options: ["idle", "wrong", "correct", "why", "revealed"],
    },
    kata: { control: false },
    wrong: { control: false },
    start: { control: false },
    steps: { table: { disable: true } },
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
/** A lesson's nth concept kata. */
const concept = (l: typeof buttons, n: number) =>
  l.katas.filter((b) => b.type === "concept")[n]!
/** The i-th question kata after a lesson's nth concept kata. */
const practice = (l: typeof buttons, n: number, i: number) =>
  l.katas[l.katas.indexOf(concept(l, n)) + 1 + i]!

/** Concept katas have no answer, so the state control does nothing for them. */
const noState = { mode: { table: { disable: true } } } as const

export const Concept: Story = {
  name: "Concept, visual",
  args: { kata: concept(buttons, 0) },
  argTypes: noState,
}
export const ConceptDiagram: Story = {
  name: "Concept, diagram",
  args: { kata: concept(bronze, 2) },
  argTypes: noState,
}
export const ConceptFormula: Story = {
  name: "Concept, formula",
  args: { kata: concept(compound, 0) },
  argTypes: noState,
}
/** A body with paragraphs and both kinds of list, under a chess visual. */
export const ConceptList: Story = {
  name: "Concept, list",
  args: {
    kata: {
      id: "c1",
      type: "concept",
      title: "Openings are named first moves",
      body: "Famous openings are named sequences, White then Black. No letter means a pawn.\n- **Italian Game**: e4 e5, Nf3 Nc6, Bc4\n- **Ruy Lopez**: e4 e5, Nf3 Nc6, Bb5\n- **Sicilian Defense**: e4 c5\nEach one aims to:\n1. Claim the centre\n2. Bring a piece out",
      visual: {
        kind: "chess",
        fen: "r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R",
        alt: "The Italian Game: White's bishop on c4 aims at f7.",
        highlight: ["f7"],
        arrows: [{ from: "c4", to: "f7" }],
      },
    },
  },
  argTypes: noState,
}

/**
 * A stepped concept: the body arrives one step per Continue, a step for each paragraph and each
 * list item. Move "steps" from 1 to 5 to see it build; the title and visual are there from the start.
 */
export const ConceptStepped: Story = {
  name: "Concept, stepped",
  args: { kata: concept(compound, 0), steps: 3 },
  argTypes: {
    ...noState,
    steps: {
      table: { disable: false },
      control: { type: "range", min: 1, max: 5, step: 1 },
    },
  },
}

/**
 * A question with a reveal: nothing above the answers while answering, then, once the answer is in
 * (correct, why, or revealed), a chart with the tempting answer and the true one both marked.
 */
export const MultipleChoiceReveal: Story = {
  name: "Multiple Choice, reveal",
  args: {
    kata: compound.hook,
    wrong: { kind: "select", ids: ["a"] },
    mode: "correct",
  },
}

export const MultipleChoice: Story = {
  args: {
    kata: practice(buttons, 0, 0),
    wrong: { kind: "select", ids: ["b"] },
  },
}
export const MultipleChoiceWithCode: Story = {
  args: {
    kata: practice(coding, 0, 1),
    wrong: { kind: "select", ids: ["b"] },
  },
}
export const MultipleChoiceVisual: Story = {
  name: "Multiple Choice, visual",
  args: {
    kata: practice(compound, 1, 2),
    wrong: { kind: "select", ids: ["b"] },
  },
}
export const MultiSelect: Story = {
  args: {
    kata: practice(prd, 0, 1),
    wrong: { kind: "select", ids: ["a", "c"] },
  },
}
export const MultiSelectVisual: Story = {
  name: "Multi Select, visual",
  args: {
    kata: practice(buttons, 1, 2),
    wrong: { kind: "select", ids: ["a", "b"] },
  },
}
export const CompareVisual: Story = {
  name: "Compare (A vs B), visual",
  args: { kata: buttons.hook, wrong: { kind: "select", ids: ["a"] } },
}
export const CompareText: Story = {
  name: "Compare (A vs B), text",
  args: {
    kata: practice(compound, 1, 1),
    wrong: { kind: "select", ids: ["b"] },
  },
}
export const HotspotHtml: Story = {
  name: "Hotspot, HTML",
  args: {
    kata: practice(buttons, 0, 1),
    wrong: { kind: "select", ids: ["create"] },
  },
}
/** Stacked rows close together, whose tiles have to stay out of each other's way. */
export const HotspotList: Story = {
  name: "Hotspot, file list",
  args: {
    kata: {
      id: "rebuild",
      type: "hotspot",
      prompt:
        "A teammate deleted `node_modules`. Tap the file npm reads to rebuild it.",
      visual: {
        kind: "html",
        html: "<div class='card max-w-sm mx-auto'><header><h2>my-site</h2></header><section><ul class='flex flex-col gap-2 text-sm'><li data-hotspot='readme' class='p-2'>README.md</li><li data-hotspot='index' class='p-2'>index.js</li><li data-hotspot='package' class='p-2'>package.json</li></ul></section></div>",
      },
      correct: ["package"],
      multiple: false,
      explanation:
        "`package.json` lists the project's dependencies, so `npm install` can rebuild `node_modules` from it.",
    },
    wrong: { kind: "select", ids: ["index"] },
  },
}
export const HotspotCode: Story = {
  name: "Hotspot, code lines",
  args: {
    kata: practice(coding, 1, 1),
    wrong: { kind: "select", ids: ["l1"] },
  },
}
export const HotspotChess: Story = {
  name: "Hotspot, chess board",
  args: {
    kata: {
      id: "fork",
      type: "hotspot",
      prompt: "Where can the knight fork the king and the rook?",
      visual: {
        kind: "chess",
        fen: "r3k3/8/8/3N4/8/8/8/4K3 w - - 0 1",
        alt: "White's knight on d5, with Black's king on e8 and rook on a8.",
        highlight: ["d5"],
      },
      correct: ["c7"],
      multiple: false,
      explanation:
        "From c7 the knight attacks both e8 and a8, so the king must move and the rook falls.",
    },
    wrong: { kind: "select", ids: ["f6"] },
  },
}
export const HotspotMap: Story = {
  name: "Hotspot, map",
  args: {
    kata: {
      id: "hittites",
      type: "hotspot",
      prompt: "Tap the country where the Hittite capital, Hattusa, stood.",
      visual: {
        kind: "map",
        region: "eastern-mediterranean",
        alt: "A map of the eastern Mediterranean, from Greece to the Euphrates and the Nile delta.",
      },
      correct: ["TR"],
      multiple: false,
      explanation:
        "Hattusa stood in central Anatolia, today's Türkiye, east of Ankara. From there the Hittites ruled down into Syria.",
    },
    wrong: { kind: "select", ids: ["SY"] },
  },
}
export const Sort: Story = {
  name: "Sort, three groups",
  args: {
    kata: practice(buttons, 1, 0),
    wrong: {
      kind: "zones",
      zones: { pool: [], pri: ["a"], sec: ["c"], ter: ["b", "d", "e"] },
    },
  },
}
export const SortTwoGroups: Story = {
  name: "Sort, two groups",
  args: {
    kata: practice(coding, 1, 0),
    wrong: {
      kind: "zones",
      zones: { pool: [], map: ["a", "b"], each: ["c", "d"] },
    },
  },
}
/**
 * On a phone there's no room for lanes, so sort deals the items one at a time: the next item sits on
 * a deck with a count above it, and each group is a bin to tap; sorted items wait in their bin as chips.
 */
export const SortPhone: Story = {
  name: "Sort, phone, two groups",
  args: SortTwoGroups.args,
  globals: { viewport: { value: "mobile2", isRotated: false } },
}
/** Partway through, with one bin holding an item and the others still empty. */
export const SortPhoneThree: Story = {
  name: "Sort, phone, three groups",
  args: {
    ...Sort.args,
    start: {
      kind: "zones",
      zones: { pool: ["b", "c", "d", "e"], pri: ["a"], sec: [], ter: [] },
    },
  },
  globals: { viewport: { value: "mobile2", isRotated: false } },
}
export const OrderVisual: Story = {
  name: "Order, visual items",
  args: {
    kata: practice(buttons, 1, 1),
    wrong: { kind: "sequence", slots: ["c", "a", "b"], pool: [] },
  },
}
export const OrderText: Story = {
  name: "Order, dialogue",
  args: {
    kata: spanish.challenge,
    wrong: { kind: "sequence", slots: ["b", "a", "c", "d"], pool: [] },
  },
}
export const Match: Story = {
  args: {
    kata: practice(spanish, 0, 0),
    wrong: { kind: "pairs", links: { 0: 1, 1: 0, 2: 2, 3: 3 } },
  },
}
export const BlankText: Story = {
  name: "Blank, word chips",
  args: {
    kata: practice(spanish, 1, 0),
    wrong: { kind: "gaps", values: { c: "Dónde", g: "gracias" } },
  },
}
export const BlankCode: Story = {
  name: "Blank, code",
  args: {
    kata: practice(coding, 0, 0),
    wrong: { kind: "gaps", values: { m: "forEach" } },
  },
}
export const Scenario: Story = {
  args: { kata: buttons.challenge, wrong: { kind: "select", ids: ["b"] } },
}
export const ScenarioChat: Story = {
  name: "Scenario, chat",
  args: {
    kata: lessons.correlation.challenge,
    wrong: { kind: "select", ids: ["b"] },
  },
}
