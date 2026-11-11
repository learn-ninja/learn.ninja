import { View } from "react-native"

import { scenarioTurns } from "@workspace/player-core/chat"
import {
  solutionMarks,
  type Answer,
  type Mark,
} from "@workspace/player-core/check"
import type { Item } from "@workspace/player-core/flow"
import { visualShown } from "@workspace/player-core/reducer"
import type { QuestionState } from "@workspace/player-core/state"
import type { Strings } from "@workspace/player-core/strings"
import type { QuestionKata } from "@workspace/spec"

import { Eyebrow, Note } from "@/components/controls"
import { BlankKata } from "@/components/katas/blank"
import { HotspotKata } from "@/components/katas/hotspot"
import { MatchKata } from "@/components/katas/match"
import { OptionsKata } from "@/components/katas/options"
import { OrderKata } from "@/components/katas/order"
import { SortKata } from "@/components/katas/sort"
import { RichText } from "@/components/rich-text"
import { Visual } from "@/components/visuals/visual"
import type { Feedback } from "@/lib/feedback"
import type { AppAction } from "@/lib/play"
import { fontSize } from "../../tokens"

// One question kata's screen, as the web's QuestionScreen draws it in the player
// (packages/player/src/lesson-player.tsx): the eyebrow (the warm-up label, how to answer), a
// scenario's situation, the prompt, the kata's visual, the answer area, and the hint while
// answering. The feedback itself is in the tray (shell.tsx).

const PROMPT_SIZE = fontSize.lg[0]
const BODY_SIZE = fontSize.base[0]

/** Instructions above the prompt, only where the interaction isn't obvious (a single pick needs none). */
function helperFor(kata: QuestionKata, t: Strings): string {
  switch (kata.type) {
    case "choice":
      return kata.multiple ? t.helper.choiceMany : ""
    case "compare":
    case "scenario":
    case "number":
      return ""
    case "hotspot":
      return kata.multiple ? t.helper.choiceMany : ""
    default:
      return t.helper[kata.type]
  }
}

export function QuestionScreen({
  item,
  question: s,
  dispatch,
  feedback,
  whyOpen,
  t,
}: {
  item: Extract<Item, { kind: "question" }>
  question: QuestionState
  dispatch: (action: AppAction) => void
  feedback: Feedback
  /** Why? is open after a right answer: on a scenario, every path shows its outcome. */
  whyOpen: boolean
  t: Strings
}) {
  const { kata, role } = item
  // A scenario opens with its brief: the situation on its own, before the question.
  if (feedback.brief && kata.type === "scenario")
    return (
      <View className="gap-6">
        <Eyebrow text={t.scenario} />
        <RichText
          text={kata.situation}
          size={BODY_SIZE}
          className="text-lesson-base"
        />
      </View>
    )
  const locked = s.phase !== "answering"
  // The kata's visual, or its reveal once the answer is in.
  const shown = visualShown(kata, s, role)
  const paths =
    whyOpen &&
    kata.type === "scenario" &&
    s.phase === "feedback" &&
    Boolean(s.result?.correct)
  // After a second miss, show the solution. Where the marks name options (not positions in the
  // learner's answer), the last pick keeps its mark beside the right one.
  const keepsPick =
    role === "hook" ||
    kata.type === "choice" ||
    kata.type === "compare" ||
    kata.type === "scenario" ||
    kata.type === "hotspot"
  const marks: Record<string, Mark> =
    paths && kata.type === "scenario"
      ? // Every path: each option in its own color, best, okay or poor.
        Object.fromEntries(
          kata.options.map((o) => [
            o.id,
            o.quality === "best"
              ? "correct"
              : o.quality === "okay"
                ? "partial"
                : "wrong",
          ])
        )
      : s.phase !== "revealed"
        ? (s.result?.marks ?? {})
        : keepsPick
          ? { ...solutionMarks(kata), ...s.result?.marks }
          : solutionMarks(kata)
  const props = {
    kata,
    answer: s.answer,
    setAnswer: (answer: Answer) => dispatch({ type: "answer", answer }),
    marks,
    locked,
    t,
  }
  const helper = helperFor(kata, t)
  const eyebrow = [
    role === "hook" ? t.warmUp : "",
    helper && !kata.prompt.includes(helper) ? helper : "",
  ]
    .filter(Boolean)
    .join(" · ")
  // A pick's outcome is in the note under the answers, so rows show outcomes only for Every path.
  const showOutcomes =
    kata.type === "scenario" && paths ? kata.options.map((o) => o.id) : []

  return (
    <View className="gap-6">
      {eyebrow ? <Eyebrow text={eyebrow} className="-mb-3" /> : null}
      {kata.type === "scenario" ? (
        // The situation, kept in view while choosing.
        <View className="rounded-xl border border-border bg-card px-4 py-3 shadow-xs">
          <RichText
            text={kata.situation}
            size={fontSize.sm[0]}
            className="text-lesson-sm text-muted-foreground"
          />
        </View>
      ) : null}
      <RichText
        text={kata.prompt}
        size={PROMPT_SIZE}
        className="text-lesson-lg font-semibold"
      />
      {shown && kata.type !== "hotspot" ? (
        <Visual
          key={shown === kata.reveal ? "reveal" : "visual"}
          visual={shown}
          turns={scenarioTurns(kata, s.answer, s.phase)}
        />
      ) : null}
      {kata.type === "choice" ||
      kata.type === "compare" ||
      kata.type === "scenario" ? (
        <OptionsKata
          {...props}
          order={s.optionOrder}
          showOutcomes={showOutcomes}
          tried={s.tried}
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
          rightOrder={s.rightOrder}
          onSlip={() => dispatch({ type: "slip" })}
          onDone={() => dispatch({ type: "check" })}
        />
      ) : kata.type === "blank" ? (
        <BlankKata {...props} bank={s.bank} />
      ) : null}
      {feedback.hintNote ? (
        // The hint the learner asked for, or a miss opened for the retry: a step closer than the gap.
        <Note tone="neutral" text={feedback.hintNote} className="-mt-2" />
      ) : null}
    </View>
  )
}
