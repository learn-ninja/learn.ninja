import { matchesBlank, type QuestionKata } from "@workspace/spec"

import {
  initialAnswer,
  shuffle,
  type Answer,
  type CheckResult,
} from "./check"
import type { Item, Outcome } from "./flow"

// The player's state, shared by the web and native players: where the learner is in the lesson
// and how the current question stands. The reducer that moves it lives with each player.

export type Phase = "answering" | "feedback" | "revealed"

export interface QuestionState {
  answer: Answer
  attempts: number
  /** The hint shows when the learner tries again after a miss. */
  hintOpen: boolean
  /** The explanation is open under the answer: after "Why?", or once the answer is revealed. */
  whyOpen: boolean
  result: CheckResult | null
  phase: Phase
  /** Display order for options and match columns, fixed for the life of the question. */
  optionOrder: string[]
  rightOrder: number[]
  bank: string[]
  /** A scenario opens with the ninja's brief: false until he's told it (true for other katas). */
  briefed: boolean
  /** How many times the brief has been replayed, so each telling starts fresh. */
  briefs: number
  /** Scenario options already picked, missed and rewound: they can't be picked again. */
  tried: string[]
}

export interface State {
  items: Item[]
  index: number
  results: Record<string, Outcome>
  mistakes: QuestionKata[]
  /** Ids of the fix round's questions answered right. */
  fixed: string[]
  inFix: boolean
  fixQueued: boolean
  question: QuestionState | null
  /** How many times the lesson has been restarted; seeds the feedback lines so a replay hears them in a new order. */
  run: number
}

/** `random` is for a fixed order, e.g. a demo rendered on the server that must match on the client. */
export function freshQuestion(
  item: Item | undefined,
  random: () => number = Math.random
): QuestionState | null {
  if (!item || item.kind !== "question") return null
  const kata = item.kata
  const optionIds =
    "options" in kata ? (kata.options as { id: string }[]).map((o) => o.id) : []
  return {
    answer: initialAnswer(kata, random),
    attempts: 0,
    hintOpen: false,
    whyOpen: false,
    result: null,
    phase: "answering",
    optionOrder:
      kata.type === "compare" ? optionIds : shuffle(optionIds, random),
    rightOrder:
      kata.type === "match"
        ? shuffle(
            kata.pairs.map((_, i) => i),
            random
          )
        : [],
    bank: kata.type === "blank" ? shuffle(wordBank(kata), random) : [],
    briefed: kata.type !== "scenario",
    briefs: 0,
    tried: [],
  }
}

/**
 * The word chips for a blank kata: every choice once, except a word that more than one gap accepts,
 * which gets a chip per such gap (otherwise the second gap could never be filled).
 */
export function wordBank(kata: Extract<QuestionKata, { type: "blank" }>) {
  const words = [...new Set(kata.blanks.flatMap((b) => b.choices ?? []))]
  return words.flatMap((word) => {
    const needed = kata.blanks.filter((b) =>
      b.accept.some((a) =>
        matchesBlank(a, word, { ...b, caseSensitive: kata.caseSensitive })
      )
    ).length
    return Array<string>(Math.max(1, needed)).fill(word)
  })
}
