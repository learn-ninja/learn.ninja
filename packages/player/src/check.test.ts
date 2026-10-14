import { readFileSync } from "node:fs"

import { describe, expect, it } from "vitest"

import {
  validateLesson,
  type Lesson,
  type QuestionBrick,
} from "@workspace/spec"

import {
  checkAnswer,
  initialAnswer,
  isReady,
  POOL,
  retryAnswer,
  solution,
  type Answer,
} from "./check"
import {
  buildSequence,
  outcomeFor,
  type Item,
  progressAt,
  questionAt,
  summarize,
} from "./flow"

function lesson(file: string): Lesson {
  const result = validateLesson(
    readFileSync(new URL(`../../../examples/${file}`, import.meta.url), "utf8")
  )
  if (!result.ok) throw new Error(`${file} is invalid`)
  return result.lesson
}

const buttons = lesson("button-hierarchy.json")
const spanish = lesson("spanish-greetings.json")
const coding = lesson("map-vs-foreach.json")
const prd = lesson("writing-a-prd.json")
const allLessons = [
  buttons,
  spanish,
  coding,
  prd,
  lesson("compound-interest.json"),
  lesson("correlation-vs-causation.json"),
  lesson("bronze-age-collapse.json"),
]
const allQuestions = allLessons.flatMap((l) => [
  l.hook,
  ...l.bricks.filter((b): b is QuestionBrick => b.type !== "concept"),
  l.challenge,
])

/** The i-th question brick after a lesson's nth concept brick. */
const p = (l: Lesson, concept: number, i: number) => {
  const at = l.bricks.filter((b) => b.type === "concept")[concept]!
  return l.bricks[l.bricks.indexOf(at) + 1 + i] as QuestionBrick
}

describe("every question in every example", () => {
  it.each(
    allQuestions.map((s) => [s.id + ":" + s.type, s] as [string, QuestionBrick])
  )("%s: its solution checks as correct", (_, brick) => {
    expect(isReady(brick, solution(brick))).toBe(true)
    expect(checkAnswer(brick, solution(brick)).correct).toBe(true)
  })

  it.each(
    allQuestions.map((s) => [s.id + ":" + s.type, s] as [string, QuestionBrick])
  )("%s: the starting answer isn't already correct", (_, brick) => {
    const start = initialAnswer(brick, () => 0.42)
    expect(isReady(brick, start) && checkAnswer(brick, start).correct).toBe(
      false
    )
  })
})

describe("choice", () => {
  const brick = p(buttons, 0, 0)
  it("uses the option's own feedback for a wrong pick", () => {
    const r = checkAnswer(brick, { kind: "select", ids: ["b"] })
    expect(r).toMatchObject({
      correct: false,
      feedback: expect.stringMatching(/pulls people away/),
      marks: { b: "wrong" },
    })
  })
  it("says one is missing when a multi-select is incomplete", () => {
    const r = checkAnswer(p(prd, 0, 1), { kind: "select", ids: ["a"] })
    expect(r).toMatchObject({ correct: false, missKey: "missOne" })
  })
  it("clears the selection on retry", () => {
    expect(retryAnswer(brick, { kind: "select", ids: ["b"] })).toEqual({
      kind: "select",
      ids: [],
    })
  })
})

describe("scenario", () => {
  it("treats an okay choice as close, with its outcome as feedback", () => {
    const r = checkAnswer(buttons.challenge, { kind: "select", ids: ["b"] })
    expect(r).toMatchObject({
      correct: false,
      partial: true,
      feedback: expect.stringMatching(/looks just as safe/),
      marks: { b: "partial" },
    })
  })
})

describe("sort", () => {
  const brick = p(buttons, 1, 0)
  it("isn't ready until the pool is empty", () => {
    expect(isReady(brick, initialAnswer(brick))).toBe(false)
  })
  it("counts items in the wrong group", () => {
    const answer: Answer = {
      kind: "zones",
      zones: { [POOL]: [], pri: ["a", "b"], sec: ["c"], ter: ["d", "e"] },
    }
    expect(checkAnswer(brick, answer)).toMatchObject({
      correct: false,
      missKey: "sort",
      count: 1,
      marks: { b: "wrong", a: "correct" },
    })
  })
  it("keeps the arrangement on retry", () => {
    const answer: Answer = {
      kind: "zones",
      zones: { [POOL]: [], pri: ["a", "b"], sec: ["c"], ter: ["d", "e"] },
    }
    expect(retryAnswer(brick, answer)).toBe(answer)
  })
})

describe("order", () => {
  it("empties only the wrong slots on a retry", () => {
    const brick = p(buttons, 1, 1)
    const target = solution(brick)
    if (target.kind !== "sequence") throw new Error("not an order brick")
    const [a, b, c] = target.slots as string[]
    expect(
      retryAnswer(brick, { kind: "sequence", slots: [a!, c!, b!], pool: [] })
    ).toEqual({ kind: "sequence", slots: [a, null, null], pool: [c, b] })
  })

  it("accepts an alternative order", () => {
    const brick = {
      ...p(buttons, 1, 1),
      alsoAccept: [["b", "a", "c"]],
    } as QuestionBrick
    expect(
      checkAnswer(brick, { kind: "sequence", slots: ["b", "a", "c"], pool: [] })
        .correct
    ).toBe(true)
  })
})

describe("match", () => {
  const brick = p(spanish, 0, 0)
  it("counts mismatched pairs and marks both sides", () => {
    const r = checkAnswer(brick, {
      kind: "pairs",
      links: { 0: 1, 1: 0, 2: 2, 3: 3 },
    })
    expect(r).toMatchObject({
      correct: false,
      missKey: "match",
      count: 2,
      marks: { L0: "wrong", R1: "wrong", L2: "correct" },
    })
  })
})

describe("blank", () => {
  const brick = p(spanish, 1, 0)
  it("uses a decoy's mistake feedback", () => {
    const r = checkAnswer(brick, {
      kind: "gaps",
      values: { c: "Dónde", g: "gracias" },
    })
    expect(r).toMatchObject({
      correct: false,
      feedback: expect.stringMatching(/where are you/),
      marks: { c: "wrong", g: "correct" },
    })
  })
  it("respects caseSensitive for code", () => {
    expect(
      checkAnswer(p(coding, 0, 0), { kind: "gaps", values: { m: "Map" } })
        .correct
    ).toBe(false)
  })
  it("empties only the wrong gaps on retry", () => {
    expect(
      retryAnswer(brick, { kind: "gaps", values: { c: "Qué", g: "gracias" } })
    ).toEqual({ kind: "gaps", values: { c: "", g: "gracias" } })
  })
})

describe("hotspot", () => {
  it("uses the code-line message for code visuals", () => {
    expect(
      checkAnswer(p(coding, 1, 1), { kind: "select", ids: ["l1"] })
    ).toMatchObject({ correct: false, missKey: "hotspotLine" })
  })
})

describe("flow", () => {
  it("plays intro, hook, each concept and its practice, challenge, fix slot, wrap-up", () => {
    const kinds = buildSequence(buttons).map((i) =>
      i.kind === "question"
        ? `${i.role}:${i.brick.id}`
        : i.kind === "concept"
          ? `concept:${i.brick.id}`
          : i.kind
    )
    expect(kinds).toEqual([
      "intro",
      "hook:hook",
      "concept:c1",
      "practice:p1",
      "practice:p2",
      "concept:c2",
      "practice:p3",
      "practice:p4",
      "practice:p5",
      "challenge:ch",
      "fix",
      "wrap",
    ])
  })
  it("scores practice and challenge, not the hook", () => {
    const s = summarize(buttons, {
      p1: "first",
      p2: "first",
      p3: "second",
      ch: "first",
    })
    expect(s).toEqual({ first: 3, second: 1, missed: 2, total: 6 })
  })
  it("records first and second tries", () => {
    expect([outcomeFor(0), outcomeFor(1)]).toEqual(["first", "second"])
  })
  it("reports progress from 0 at the intro to 100 at the fix slot", () => {
    const items = buildSequence(buttons)
    expect(progressAt(items, 0, {}, [])).toBe(0)
    expect(
      progressAt(
        items,
        items.findIndex((i) => i.kind === "fix"),
        {},
        []
      )
    ).toBe(100)
  })
  it("holds back a missed question's progress until the fix round gets it right", () => {
    const items = buildSequence(buttons)
    const fixAt = items.findIndex((i) => i.kind === "fix")
    const step = 100 / (fixAt - 1)
    const [a, b] = items.filter(
      (i): i is Extract<Item, { kind: "question" }> =>
        i.kind === "question" && i.role !== "hook"
    )
    const results = {
      [a!.brick.id]: "missed" as const,
      [b!.brick.id]: "missed" as const,
    }
    expect(progressAt(items, fixAt, results, [])).toBe(
      Math.round(100 - 2 * step)
    )
    const withRetries: Item[] = [
      ...items.slice(0, fixAt + 1),
      { ...a!, role: "fix" },
      { ...b!, role: "fix" },
      ...items.slice(fixAt + 1),
    ]
    // On the second retry: the first one counts only if it was answered right.
    expect(progressAt(withRetries, fixAt + 2, results, [])).toBe(
      Math.round(100 - 2 * step)
    )
    expect(progressAt(withRetries, fixAt + 2, results, [a!.brick.id])).toBe(
      Math.round(100 - step)
    )
    expect(progressAt(withRetries, fixAt + 3, results, [])).toBe(100)
  })
  it("counts questions, warm-up and challenge included, and the next one on a concept", () => {
    const items = buildSequence(prd)
    const questions = items.filter((i) => i.kind === "question").length
    const hook = items.findIndex((i) => i.kind === "question")
    expect(questionAt(items, hook, false)).toEqual({
      current: 1,
      total: questions,
      fixing: false,
    })
    // A concept shows the number of the question after it.
    const concept = items.findIndex((i) => i.kind === "concept")
    const next = items.findIndex((i, k) => k > concept && i.kind === "question")
    expect(questionAt(items, concept, false).current).toBe(
      questionAt(items, next, false).current
    )
    const challenge = items.findIndex(
      (i) => i.kind === "question" && i.role === "challenge"
    )
    expect(questionAt(items, challenge, false).current).toBe(questions)
    expect(
      questionAt(
        items,
        items.findIndex((i) => i.kind === "wrap"),
        false
      ).current
    ).toBe(questions)
  })
  it("counts the retries in the fix round", () => {
    const items = buildSequence(prd)
    const fix = items.findIndex((i) => i.kind === "fix")
    const misses = items.filter(
      (i) => i.kind === "question" && i.role === "practice"
    )
    const withRetries = [
      ...items.slice(0, fix + 1),
      ...misses.slice(0, 2).map((i) => ({ ...i, role: "fix" as const })),
      ...items.slice(fix + 1),
    ]
    expect(questionAt(withRetries, fix + 2, true)).toEqual({
      current: 2,
      total: 2,
      fixing: true,
    })
  })
})
