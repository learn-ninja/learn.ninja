import { readFileSync } from "node:fs"

import { describe, expect, it } from "vitest"

import type { Lesson, QuestionKata } from "@workspace/spec"

import { solution } from "./check"
import { buildSequence, scoredQuestions, summarize } from "./flow"
import { reducer, start, visualShown, type Action } from "./reducer"
import type { State } from "./state"

const example = (): Lesson =>
  JSON.parse(
    readFileSync(
      new URL("../../../examples/compound-interest.json", import.meta.url),
      "utf8"
    )
  )

const go = (state: State, ...actions: Action[]) => actions.reduce(reducer, state)

describe("a guess before a concept", () => {
  // The first practice kata again, as a guess right before the second concept.
  const lesson = example()
  const guess = { ...lesson.katas[1]!, id: "g1", guess: true } as QuestionKata
  lesson.katas.splice(3, 0, guess)

  it("plays as the hook does, and isn't scored", () => {
    const item = buildSequence(lesson).find(
      (i) => i.kind === "question" && i.kata.id === "g1"
    )
    expect(item).toMatchObject({ role: "hook" })
    expect(scoredQuestions(lesson).map((k) => k.id)).not.toContain("g1")
    expect(summarize(lesson, {}).total).toBe(scoredQuestions(example()).length)
  })

  it("takes one try and moves on, right or wrong", () => {
    let state = start(lesson)
    while (
      !(
        state.items[state.index]?.kind === "question" &&
        (state.items[state.index] as { kata: QuestionKata }).kata.id === "g1"
      )
    )
      state = go(state, { type: "next" })
    if (guess.type !== "choice") throw new Error()
    const wrong = guess.options.find((o) => !guess.correct.includes(o.id))!.id
    const checked = go(
      state,
      { type: "answer", answer: { kind: "select", ids: [wrong] } },
      { type: "check" }
    )
    expect(checked.question?.phase).toBe("revealed")
    expect(checked.results).toEqual({})
    expect(checked.mistakes).toEqual([])
  })
})

describe("a reveal", () => {
  const lesson = example()
  const kata = {
    ...lesson.katas[1]!,
    visual: { kind: "math", tex: "a" },
    reveal: { kind: "math", tex: "b" },
  } as QuestionKata
  lesson.katas[1] = kata
  const at = (l: Lesson) => {
    let state = start(l)
    while (
      !(
        state.items[state.index]?.kind === "question" &&
        (state.items[state.index] as { kata: QuestionKata }).kata.id === kata.id
      )
    )
      state = go(state, { type: "next" })
    return state
  }

  it("takes the visual's place once the answer is right", () => {
    const state = at(lesson)
    expect(visualShown(kata, state.question!, "practice")).toBe(kata.visual)
    const right = go(
      state,
      { type: "answer", answer: solution(kata) },
      { type: "check" }
    )
    expect(visualShown(kata, right.question!, "practice")).toBe(kata.reveal)
  })

  it("waits through a miss, and shows once the answer is revealed", () => {
    if (kata.type !== "choice") throw new Error()
    const wrong = kata.options.find((o) => !kata.correct.includes(o.id))!.id
    const miss: Action[] = [
      { type: "answer", answer: { kind: "select", ids: [wrong] } },
      { type: "check" },
    ]
    const once = go(at(lesson), ...miss)
    expect(visualShown(kata, once.question!, "practice")).toBe(kata.visual)
    const twice = go(once, { type: "retry" }, ...miss)
    expect(twice.question?.phase).toBe("revealed")
    expect(visualShown(kata, twice.question!, "practice")).toBe(kata.reveal)
  })

  it("shows on a guess as soon as it's checked", () => {
    const hook = { ...lesson.hook, reveal: { kind: "math", tex: "c" } } as QuestionKata
    const state = go(start({ ...lesson, hook } as Lesson), { type: "next" })
    if (hook.type !== "choice") throw new Error()
    const wrong = hook.options.find((o) => !hook.correct.includes(o.id))!.id
    const checked = go(
      state,
      { type: "answer", answer: { kind: "select", ids: [wrong] } },
      { type: "check" }
    )
    expect(visualShown(hook, checked.question!, "hook")).toBe(hook.reveal)
  })
})
