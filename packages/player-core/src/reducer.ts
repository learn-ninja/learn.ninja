import type { Lesson, QuestionKata, Visual } from "@workspace/spec"

import {
  checkAnswer,
  retryAnswer,
  solution,
  type Answer,
  type CheckResult,
} from "./check"
import { buildSequence, outcomeFor, type Item, type Role } from "./flow"
import { seeded } from "./random"
import { freshQuestion, type QuestionState, type State } from "./state"
import type { Strings } from "./strings"
import type { Moment } from "./voices"

// How a lesson moves: the reducer both players run (the web's lesson-player.tsx and the app's
// play.ts), with the pieces of judgement that go with it: what a correct answer earns, whether a
// hint is offered, when the explanation shows, and what a generic miss says.

/** A lesson from its intro; a demo (`startAt`) opens on one kata, shuffled the same way everywhere. */
export function start(lesson: Lesson, startAt?: string, run = 0): State {
  const items = buildSequence(lesson)
  const at = startAt
    ? items.findIndex((i) => "kata" in i && i.kata.id === startAt)
    : -1
  const index = at < 0 ? 0 : at
  return {
    items,
    index,
    results: {},
    mistakes: [],
    fixed: [],
    inFix: false,
    fixQueued: false,
    guesses: {},
    question: at < 0 ? null : freshQuestion(items[index], seeded(startAt!)),
    run,
  }
}

/**
 * What a correct answer earns beyond praise: the lesson's last question, three first-try answers in
 * a row, or a comeback (a retry that landed, a fix-round question, or the question after a miss
 * that was revealed).
 * The hook is a guess, so it earns nothing.
 */
export function earnedMoment(
  state: State,
  item: Extract<Item, { kind: "question" }>
): Moment | null {
  const s = state.question
  if (!s || item.role === "hook") return null
  const later = state.items
    .slice(state.index + 1)
    .some((i) => i.kind === "question")
  if (!later && state.mistakes.length === 0) return "last"
  if (s.attempts > 0 || item.role === "fix") return "comeback"
  // Scored questions so far, in play order, ending with this one.
  const outcomes = state.items
    .slice(0, state.index + 1)
    .flatMap((i) =>
      i.kind === "question" && i.role !== "hook"
        ? [state.results[i.kata.id]]
        : []
    )
  let streak = 0
  for (let i = outcomes.length - 1; i >= 0; i--) {
    if (outcomes[i] !== "first") break
    streak++
  }
  if (streak > 0 && streak % 3 === 0) return "streak"
  // A second-try success already had its comeback; only a real miss earns one on the next question.
  const previous = outcomes[outcomes.length - 2]
  if (previous === "missed") return "comeback"
  return null
}

/**
 * Whether the Hint button (and H) is offered: while answering a question with a hint, before
 * checking. Not on the hook, the warm-up guess, and not during a scenario's brief.
 */
export function hintOffered(
  item: Extract<Item, { kind: "question" }>,
  s: QuestionState
): boolean {
  return (
    item.role !== "hook" &&
    Boolean(item.kata.hint) &&
    s.phase === "answering" &&
    s.briefed
  )
}

/** The explanation opens after "Why?", and by itself once a missed answer is revealed (not for the hook's guess). */
export function explanationShown(s: QuestionState, role: Role): boolean {
  return s.whyOpen || (s.phase === "revealed" && role !== "hook")
}

/**
 * The visual above the answers: the kata's own, or its `reveal` once the answer is in (answered
 * right, shown after two misses, or, for a guess, as soon as it's checked). A hotspot's visual is
 * what the learner taps and a scenario's plays the outcome, so neither is swapped. A reveal with no
 * visual to replace (in lessons published before the checker refused one) never shows: appearing
 * from nothing after Check, it pushed the answers down.
 */
export function visualShown(
  kata: QuestionKata,
  s: QuestionState,
  role: Role
): Visual | undefined {
  if (
    !kata.visual ||
    !kata.reveal ||
    kata.type === "hotspot" ||
    kata.type === "scenario"
  )
    return kata.visual
  const answered =
    s.phase === "revealed" ||
    (role !== "hook" && s.phase === "feedback" && s.result?.correct === true)
  return answered ? kata.reveal : kata.visual
}

/** The player's own line for a miss with no lesson-written feedback. */
export function missMessage(r: CheckResult, t: Strings): string {
  switch (r.missKey) {
    case "sort":
      return t.miss.sort(r.count ?? 0)
    case "match":
      return t.miss.match(r.count ?? 0)
    case "missOne":
    case "hotspot":
    case "hotspotLine":
    case "order":
    case "blank":
      return t.miss[r.missKey]
    default:
      return ""
  }
}

export type Action =
  | { type: "next" }
  | { type: "restart"; lesson: Lesson }
  /** Progress saved on the device or in the browser, loaded after mounting. */
  | { type: "resume"; state: State }
  | { type: "answer"; answer: Answer }
  | { type: "why" }
  /** Hint while answering: toggles the hint under the answers. It's free, so the score doesn't change. */
  | { type: "hint" }
  | { type: "briefed" }
  | { type: "rebrief" }
  | { type: "check" }
  /** A wrong pair in a match: it isn't kept, but the kata no longer counts as right first time. */
  | { type: "slip" }
  | { type: "retry" }
  | { type: "startFix" }

export function reducer(state: State, action: Action): State {
  const item = state.items[state.index]
  switch (action.type) {
    case "restart":
      return start(action.lesson, undefined, state.run + 1)
    case "resume":
      return action.state
    case "next": {
      if (state.index >= state.items.length - 1) return state
      let index = state.index + 1
      if (
        state.items[index]?.kind === "fix" &&
        state.mistakes.length === 0 &&
        !state.fixQueued
      )
        index++
      const nextItem = state.items[index]
      return {
        ...state,
        index,
        inFix: state.inFix || nextItem?.kind === "fix",
        question: freshQuestion(nextItem),
      }
    }
    case "startFix": {
      const retries: Item[] = state.mistakes.map((kata: QuestionKata) => ({
        kind: "question",
        kata,
        role: "fix",
      }))
      const items = [
        ...state.items.slice(0, state.index + 1),
        ...retries,
        ...state.items.slice(state.index + 1),
      ]
      const index = state.index + 1
      return {
        ...state,
        items,
        index,
        mistakes: [],
        fixQueued: true,
        question: freshQuestion(items[index]),
      }
    }
    case "answer":
      // A change to the answer clears the marks kept from the last check.
      return state.question
        ? {
            ...state,
            question: {
              ...state.question,
              answer: action.answer,
              result: null,
            },
          }
        : state
    case "why":
      return state.question
        ? { ...state, question: { ...state.question, whyOpen: true } }
        : state
    case "hint":
      return state.question?.phase === "answering" &&
        item?.kind === "question" &&
        hintOffered(item, state.question)
        ? {
            ...state,
            question: {
              ...state.question,
              hintOpen: !state.question.hintOpen,
            },
          }
        : state
    case "briefed":
      return state.question
        ? { ...state, question: { ...state.question, briefed: true } }
        : state
    case "rebrief":
      // Only while answering: the brief comes back, then the same question.
      return state.question?.phase === "answering"
        ? {
            ...state,
            question: {
              ...state.question,
              briefed: false,
              briefs: state.question.briefs + 1,
            },
          }
        : state
    case "retry": {
      // The last check's marks stay until the answer changes, so the learner can see what to fix.
      if (!state.question || item?.kind !== "question") return state
      const s = state.question
      // A scenario rewinds to the decision: its marks clear and the missed pick is crossed out.
      const rewind = item.kata.type === "scenario"
      return {
        ...state,
        question: {
          ...s,
          phase: "answering",
          answer: retryAnswer(item.kata, s.answer),
          // A miss opens the hint under the answers for the second try (Hint toggles it any time).
          hintOpen: Boolean(item.kata.hint),
          ...(rewind
            ? {
                result: null,
                tried: [
                  ...s.tried,
                  ...(s.answer.kind === "select" ? s.answer.ids : []),
                ],
              }
            : null),
        },
      }
    }
    case "slip":
      return state.question?.phase === "answering" &&
        state.question.attempts === 0
        ? { ...state, question: { ...state.question, attempts: 1 } }
        : state
    case "check": {
      if (!state.question || item?.kind !== "question") return state
      const { kata, role } = item
      const s = state.question
      const result = checkAnswer(kata, s.answer)
      if (role === "hook")
        return {
          ...state,
          guesses:
            s.answer.kind === "select"
              ? { ...state.guesses, [kata.id]: s.answer.ids }
              : state.guesses,
          question: { ...s, result, phase: "revealed" },
        }
      if (result.correct) {
        const results =
          role === "fix" || kata.id in state.results
            ? state.results
            : {
                ...state.results,
                [kata.id]: outcomeFor(s.attempts),
              }
        return {
          ...state,
          results,
          fixed: role === "fix" ? [...state.fixed, kata.id] : state.fixed,
          question: { ...s, result, phase: "feedback" },
        }
      }
      const attempts = s.attempts + 1
      if (attempts < 2)
        return {
          ...state,
          question: { ...s, attempts, result, phase: "feedback" },
        }
      const results =
        role === "fix"
          ? state.results
          : { ...state.results, [kata.id]: "missed" as const }
      const mistakes =
        role === "fix" ? state.mistakes : [...state.mistakes, kata]
      return {
        ...state,
        results,
        mistakes,
        question: {
          ...s,
          attempts,
          result,
          phase: "revealed",
          answer: solution(kata),
        },
      }
    }
  }
}
