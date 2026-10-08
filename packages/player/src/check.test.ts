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
  partAt,
  progressAt,
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
  it("accepts an alternative order", () => {
    const brick = {
      ...p(buttons, 1, 1),
      alsoAccept: [["b", "a", "c"]],
    } as QuestionBrick
    expect(
      checkAnswer(brick, { kind: "sequence", ids: ["b", "a", "c"] }).correct
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
      p2: "hint",
      p3: "second",
      ch: "first",
    })
    expect(s).toEqual({ first: 2, hint: 1, second: 1, missed: 2, total: 6 })
  })
  it("records hints and second tries", () => {
    expect([
      outcomeFor(0, false),
      outcomeFor(0, true),
      outcomeFor(1, false),
    ]).toEqual(["first", "hint", "second"])
  })
  it("reports progress from 0 at the intro to 100 at the fix slot", () => {
    const items = buildSequence(buttons)
    expect(progressAt(items, 0, false)).toBe(0)
    expect(
      progressAt(
        items,
        items.findIndex((i) => i.kind === "fix"),
        false
      )
    ).toBe(100)
  })
  it("splits progress into one part per concept plus the challenge", () => {
    const items = buildSequence(prd)
    const at = (kind: string, n = 0) =>
      items.findIndex(
        (i, k) =>
          (i.kind === kind || (i.kind === "question" && i.role === kind)) &&
          items.slice(0, k).filter((j) => j.kind === kind).length === n
      )
    expect(partAt(items, 0, false)).toEqual({
      count: 4,
      current: 0,
      fraction: 0,
      done: false,
    })
    // The warm-up starts part 1; the first concept comes next in the same part.
    expect(partAt(items, at("hook"), false).current).toBe(0)
    const concept2 = at("concept", 1)
    expect(partAt(items, concept2, false)).toMatchObject({
      current: 1,
      fraction: 0,
    })
    expect(partAt(items, concept2 + 1, false).fraction).toBeCloseTo(1 / 3)
    expect(partAt(items, at("challenge"), false)).toMatchObject({
      current: 3,
      fraction: 0,
      done: false,
    })
    expect(partAt(items, at("wrap"), false).done).toBe(true)
  })
})
