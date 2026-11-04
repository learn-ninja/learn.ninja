import { readFileSync } from "node:fs"

import { describe, expect, it } from "vitest"

import type { Lesson, QuestionKata } from "@workspace/spec"

import { chipsInGaps } from "./katas"
import { buildSequence, type Item, type Outcome } from "@workspace/player-core/flow"
import {
  earnedMoment,
  freshQuestion,
  reducer,
  wordBank,
  type State,
} from "./lesson-player"

// The player's state: what a fresh question starts with and how answering moves it along.

const blank: Extract<QuestionKata, { type: "blank" }> = {
  id: "b",
  type: "blank",
  prompt: "Declare both.",
  explanation: "Both are constants.",
  template: "[[a]] x = 1; [[b]] y = 2;",
  format: "code",
  blanks: [
    { id: "a", accept: ["const"], choices: ["const", "let"] },
    { id: "b", accept: ["const"], choices: ["const", "var"] },
  ],
}

const sort: Extract<QuestionKata, { type: "sort" }> = {
  id: "s",
  type: "sort",
  prompt: "Sort them.",
  explanation: "Fruit is sweet.",
  groups: [
    { id: "fruit", label: "Fruit" },
    { id: "veg", label: "Vegetables" },
  ],
  items: [
    { id: "apple", text: "Apple", group: "fruit" },
    { id: "pear", text: "Pear", group: "fruit" },
    { id: "kale", text: "Kale", group: "veg" },
    { id: "leek", text: "Leek", group: "veg" },
  ],
}

function stateFor(kata: QuestionKata): State {
  const item: Item = { kind: "question", kata, role: "practice" }
  return {
    items: [item],
    index: 0,
    results: {},
    mistakes: [],
    fixed: [],
    inFix: false,
    fixQueued: false,
    run: 0,
    question: freshQuestion(item, () => 0.5),
  }
}

describe("word bank", () => {
  it("gives a word one chip per gap that accepts it", () => {
    expect([...wordBank(blank)].sort()).toEqual([
      "const",
      "const",
      "let",
      "var",
    ])
  })

  it("lists a decoy once even when several gaps offer it", () => {
    const shared = {
      ...blank,
      blanks: blank.blanks.map((b) => ({ ...b, choices: ["const", "let"] })),
    }
    expect([...wordBank(shared)].sort()).toEqual(["const", "const", "let"])
  })
})

describe("retry", () => {
  it("keeps the marks until the answer changes", () => {
    let state = stateFor(sort)
    state = reducer(state, {
      type: "answer",
      answer: {
        kind: "zones",
        zones: { pool: [], fruit: ["apple", "kale"], veg: ["pear", "leek"] },
      },
    })
    state = reducer(state, { type: "check" })
    expect(state.question?.phase).toBe("feedback")
    state = reducer(state, { type: "retry" })
    expect(state.question?.phase).toBe("answering")
    expect(state.question?.result?.marks).toMatchObject({
      apple: "correct",
      kale: "wrong",
      pear: "wrong",
      leek: "correct",
    })
    state = reducer(state, {
      type: "answer",
      answer: {
        kind: "zones",
        zones: { pool: [], fruit: ["apple", "pear"], veg: ["kale", "leek"] },
      },
    })
    expect(state.question?.result).toBeNull()
  })

  it("scores a match with a wrong pair along the way as a second try", () => {
    const match: Extract<QuestionKata, { type: "match" }> = {
      id: "m",
      type: "match",
      prompt: "Match them.",
      explanation: "Each word with its meaning.",
      pairs: [
        { left: "Hola", right: "Hello" },
        { left: "Adiós", right: "Goodbye" },
      ],
    }
    const pairs = {
      type: "answer",
      answer: { kind: "pairs", links: { 0: 0, 1: 1 } },
    } as const
    const clean = reducer(reducer(stateFor(match), pairs), { type: "check" })
    expect(clean.results).toEqual({ m: "first" })

    let state = reducer(stateFor(match), { type: "slip" })
    state = reducer(state, { type: "slip" })
    expect(state.question?.attempts).toBe(1)
    state = reducer(reducer(state, pairs), { type: "check" })
    expect(state.question?.phase).toBe("feedback")
    expect(state.results).toEqual({ m: "second" })
  })
})

const lesson = JSON.parse(
  readFileSync(
    new URL("../../../examples/compound-interest.json", import.meta.url),
    "utf8"
  )
) as Lesson

describe("restart", () => {
  it("counts the run, so a replay seeds its feedback lines afresh", () => {
    let state = stateFor(sort)
    expect(state.run).toBe(0)
    state = reducer(state, { type: "restart", lesson })
    expect(state.run).toBe(1)
    expect(state.index).toBe(0)
    state = reducer(state, { type: "restart", lesson })
    expect(state.run).toBe(2)
  })
})

describe("earned moments", () => {
  // The lesson's questions in play order: the hook, then the scored ones.
  const items = buildSequence(lesson)
  const questions = items.flatMap((i, index) =>
    i.kind === "question" ? [{ index, item: i }] : []
  )
  const scored = questions.filter((q) => q.item.role !== "hook")

  /** The state right after the nth scored question was answered correctly, given the earlier outcomes. */
  function answered(
    n: number,
    outcomes: Outcome[],
    attempts = 0,
    mistakes: QuestionKata[] = []
  ): State {
    const { index, item } = scored[n]!
    const results: Record<string, Outcome> = {}
    scored.slice(0, n).forEach((q, i) => {
      results[q.item.kata.id] = outcomes[i]!
    })
    results[item.kata.id] = attempts > 0 ? "second" : "first"
    const question = freshQuestion(item, () => 0.5)!
    return {
      items,
      index,
      results,
      mistakes,
      fixed: [],
      inFix: false,
      fixQueued: false,
      run: 0,
      question: { ...question, attempts, phase: "feedback" },
    }
  }
  const at = (state: State) =>
    earnedMoment(
      state,
      state.items[state.index] as Extract<Item, { kind: "question" }>
    )

  it("earns nothing for the hook or an ordinary first answer", () => {
    const hook = questions[0]!
    const state = { ...answered(0, []), index: hook.index }
    expect(earnedMoment(state, hook.item)).toBeNull()
    expect(at(answered(0, []))).toBeNull()
    expect(at(answered(1, ["first"]))).toBeNull()
  })

  it("earns a streak on the third first-try answer in a row", () => {
    expect(at(answered(2, ["first", "first"]))).toBe("streak")
    expect(at(answered(2, ["missed", "first"]))).toBeNull()
    expect(at(answered(3, ["first", "first", "first"]))).toBeNull()
  })

  it("earns a comeback after a retry or after a miss", () => {
    expect(at(answered(1, ["first"], 1))).toBe("comeback")
    expect(at(answered(1, ["missed"]))).toBe("comeback")
    // The retry already earned its comeback; the next question starts fresh.
    expect(at(answered(1, ["second"]))).toBeNull()
  })

  it("earns the last line on the final question, unless a fix round is coming", () => {
    const final = scored.length - 1
    expect(at(answered(final, Array(final).fill("first")))).toBe("last")
    // With a mistake to fix, more questions follow, so this isn't the last (and four in a row is no streak).
    const mistake = scored[0]!.item.kata
    expect(
      at(
        answered(
          final,
          ["missed", ...Array<Outcome>(final - 1).fill("first")],
          0,
          [mistake]
        )
      )
    ).toBeNull()
  })
})

const scenario: Extract<QuestionKata, { type: "scenario" }> = {
  id: "sc",
  type: "scenario",
  prompt: "What do you do?",
  situation: "A VP asks for a feature two days before the review.",
  explanation: "Non-goals protect scope.",
  hint: "What are non-goals for?",
  options: [
    {
      id: "a",
      quality: "best",
      text: "Make it a non-goal",
      outcome: "Scope holds.",
    },
    {
      id: "b",
      quality: "okay",
      text: "Add it and flag the risk",
      outcome: "Scope grows.",
    },
    {
      id: "c",
      quality: "poor",
      text: "Quietly add it",
      outcome: "Estimates break.",
    },
  ],
}

describe("scenario story mode", () => {
  it("opens a scenario with the brief, and other katas without", () => {
    expect(stateFor(scenario).question?.briefed).toBe(false)
    expect(stateFor(sort).question?.briefed).toBe(true)
  })

  it("ends the brief, and replays it only while answering", () => {
    const told = reducer(stateFor(scenario), { type: "briefed" })
    expect(told.question?.briefed).toBe(true)
    const again = reducer(told, { type: "rebrief" })
    expect(again.question).toMatchObject({ briefed: false, briefs: 1 })
    const picked = reducer(told, {
      type: "answer",
      answer: { kind: "select", ids: ["b"] },
    })
    const checked = reducer(picked, { type: "check" })
    expect(reducer(checked, { type: "rebrief" }).question?.briefed).toBe(true)
  })

  it("rewinds a miss: the marks clear and the pick is crossed out", () => {
    let state = reducer(stateFor(scenario), { type: "briefed" })
    state = reducer(state, {
      type: "answer",
      answer: { kind: "select", ids: ["b"] },
    })
    state = reducer(state, { type: "check" })
    expect(state.question?.result?.partial).toBe(true)
    state = reducer(state, { type: "retry" })
    expect(state.question).toMatchObject({
      phase: "answering",
      result: null,
      tried: ["b"],
      answer: { kind: "select", ids: [] },
    })
  })
})

describe("blank word chips", () => {
  it("gives each placed word its own bank chip, a repeated word in gap order", () => {
    expect(
      chipsInGaps(["a", "b", "c"], { a: "const", b: "const", c: "" }, [
        "let",
        "const",
        "const",
        "var",
      ])
    ).toEqual({ a: 1, b: 2 })
  })
})
