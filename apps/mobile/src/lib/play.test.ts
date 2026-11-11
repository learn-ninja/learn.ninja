import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"

import { describe, expect, it } from "vitest"

import {
  checkAnswer,
  initialAnswer,
  isReady,
  POOL,
  solution,
  type Answer,
} from "@workspace/player-core/check"
import { scoredQuestions, summarize } from "@workspace/player-core/flow"
import { hintOffered } from "@workspace/player-core/reducer"
import type { State } from "@workspace/player-core/state"
import { validateLesson, type Lesson, type QuestionKata } from "@workspace/spec"

import { reducer, start, type AppAction } from "./play"

// The app's lesson state through every kata of every bundled lesson: each kata type answered
// right, answered wrong and then right, and missed twice, with the fix round and the score that
// follow. The reducer is player-core's, shared with the web; this is the app's run of it.

function lesson(file: string): Lesson {
  const result = validateLesson(
    readFileSync(
      fileURLToPath(
        new URL(`../../../../examples/${file}`, import.meta.url).href
      ),
      "utf8"
    )
  )
  if (!result.ok) throw new Error(`${file} is invalid`)
  return result.lesson
}

const FILES = [
  "button-hierarchy.json",
  "spanish-greetings.json",
  "map-vs-foreach.json",
  "writing-a-prd.json",
  "compound-interest.json",
  "correlation-vs-causation.json",
  "bronze-age-collapse.json",
]
const lessons = FILES.map((f) => [f, lesson(f)] as const)

/** The ids a hotspot's visual offers to tap. */
function spotIds(kata: Extract<QuestionKata, { type: "hotspot" }>): string[] {
  const v = kata.visual
  if (v.kind === "html")
    return [...v.html.matchAll(/data-hotspot=["']([^"']+)["']/g)].map(
      (m) => m[1]!
    )
  if (v.kind === "code") return (v.hotspots ?? []).map((h) => h.id)
  if (v.kind === "chess")
    return "abcdefgh"
      .split("")
      .flatMap((f) => [1, 2, 3, 4, 5, 6, 7, 8].map((r) => `${f}${r}`))
  return ["FR", "DE", "IT", "ES", "TR", "EG", "GR"]
}

/** An answer the kata marks wrong. */
function wrongAnswer(kata: QuestionKata, answer: Answer): Answer {
  switch (kata.type) {
    case "choice": {
      const other = kata.options.find((o) => !kata.correct.includes(o.id))
      return {
        kind: "select",
        ids: other ? [other.id] : [kata.correct[0]!],
      }
    }
    case "compare":
      return {
        kind: "select",
        ids: [kata.options.find((o) => o.id !== kata.correct)!.id],
      }
    case "scenario":
      return {
        kind: "select",
        ids: [kata.options.find((o) => o.quality !== "best")!.id],
      }
    case "hotspot":
      return {
        kind: "select",
        ids: [spotIds(kata).find((id) => !kata.correct.includes(id))!],
      }
    case "sort": {
      // Every item in the wrong group: the first group's items go to the second, and so on.
      const zones: Record<string, string[]> = { [POOL]: [] }
      for (const g of kata.groups) zones[g.id] = []
      for (const item of kata.items) {
        const at = kata.groups.findIndex((g) => g.id === item.group)
        zones[kata.groups[(at + 1) % kata.groups.length]!.id]!.push(item.id)
      }
      return { kind: "zones", zones }
    }
    case "order":
      // The shuffled pool, which is never the right order.
      return {
        kind: "sequence",
        slots: answer.kind === "sequence" ? answer.pool : [],
        pool: [],
      }
    case "match":
      return {
        kind: "pairs",
        links: Object.fromEntries(
          kata.pairs.map((_, i) => [i, (i + 1) % kata.pairs.length])
        ),
      }
    case "blank":
      return {
        kind: "gaps",
        values: Object.fromEntries(
          kata.blanks.map((b) => [
            b.id,
            (b.choices ?? []).find((c) => !b.accept.includes(c)) ?? "wrong",
          ])
        ),
      }
    case "number":
      return answer
  }
}

/** A checked wrong answer really is wrong, and the solution really is right, for every kata. */
describe("the answers the walkthrough uses", () => {
  for (const [file, l] of lessons)
    it(`fit ${file}`, () => {
      const katas = [l.hook, ...l.katas, l.challenge].filter(
        (k): k is QuestionKata => k.type !== "concept"
      )
      for (const kata of katas) {
        const wrong = wrongAnswer(
          kata,
          initialAnswer(kata, () => 0.3)
        )
        expect(isReady(kata, wrong), `${kata.id} wrong answer is ready`).toBe(
          true
        )
        expect(checkAnswer(kata, wrong).correct, `${kata.id} wrong`).toBe(false)
        expect(checkAnswer(kata, solution(kata)).correct, `${kata.id}`).toBe(
          true
        )
      }
    })
})

type Play = "first" | "second" | "missed"

/**
 * Plays a lesson from the intro to the wrap-up, answering each scored kata as `how` says, the
 * hook right, and every fix-round retry right. Returns every state along the way.
 */
function play(l: Lesson, how: (kata: QuestionKata) => Play): State[] {
  const step = reducer(l)
  const states: State[] = [start(l)]
  let state = states[0]!
  const go = (action: AppAction) => {
    state = step(state, action)
    states.push(state)
  }
  const current = () => state.items[state.index]!
  let guard = 0
  while (current().kind !== "wrap") {
    if (++guard > 500) throw new Error("The lesson never ends.")
    const item = current()
    if (item.kind === "intro" || item.kind === "concept") {
      go({ type: "next" })
      continue
    }
    if (item.kind === "fix") {
      go({ type: "startFix" })
      continue
    }
    if (item.kind === "wrap") break
    const { kata, role } = item
    const q = state.question!
    expect(q.phase).toBe("answering")
    if (kata.type === "scenario" && !q.briefed) go({ type: "briefed" })
    const plan: Play = role === "hook" || role === "fix" ? "first" : how(kata)
    if (plan === "first") {
      go({ type: "answer", answer: solution(kata) })
      go({ type: "check" })
      expect(state.question!.phase).toBe(
        role === "hook" ? "revealed" : "feedback"
      )
      expect(state.question!.result?.correct).toBe(true)
    } else {
      go({ type: "answer", answer: wrongAnswer(kata, state.question!.answer) })
      go({ type: "check" })
      expect(state.question!.phase).toBe("feedback")
      expect(state.question!.result?.correct).toBe(false)
      go({ type: "retry" })
      expect(state.question!.phase).toBe("answering")
      expect(state.question!.attempts).toBe(1)
      if (kata.hint) expect(state.question!.hintOpen).toBe(true)
      if (plan === "second") {
        go({ type: "answer", answer: solution(kata) })
        go({ type: "check" })
        expect(state.question!.result?.correct).toBe(true)
      } else {
        go({
          type: "answer",
          answer: wrongAnswer(kata, state.question!.answer),
        })
        go({ type: "check" })
        expect(state.question!.phase).toBe("revealed")
        expect(state.question!.answer).toEqual(solution(kata))
        expect(state.mistakes.map((m) => m.id)).toContain(kata.id)
      }
    }
    go({ type: "next" })
  }
  return states
}

describe("every bundled lesson", () => {
  for (const [file, l] of lessons) {
    // Practice and the challenge; a guess before a concept isn't scored.
    const scored = scoredQuestions(l).length

    it(`${file}: right first time reaches the wrap-up with a full score, skipping the fix round`, () => {
      const states = play(l, () => "first")
      const end = states[states.length - 1]!
      expect(end.items[end.index]!.kind).toBe("wrap")
      expect(
        end.items.some((i) => i.kind === "question" && i.role === "fix")
      ).toBe(false)
      expect(states.some((s) => s.items[s.index]!.kind === "fix")).toBe(false)
      expect(summarize(l, end.results)).toEqual({
        first: scored,
        second: 0,
        missed: 0,
        total: scored,
      })
    })

    it(`${file}: one miss per kata, then right, scores every kata as a second try`, () => {
      const end = play(l, () => "second").at(-1)!
      expect(end.items[end.index]!.kind).toBe("wrap")
      expect(summarize(l, end.results)).toMatchObject({
        first: 0,
        second: scored,
        missed: 0,
      })
    })

    it(`${file}: two misses per kata reveal the answer and bring every kata back in the fix round`, () => {
      const states = play(l, () => "missed")
      const end = states[states.length - 1]!
      expect(end.items[end.index]!.kind).toBe("wrap")
      // The fix round screen showed, then every missed kata came back once and was fixed.
      expect(states.some((s) => s.items[s.index]!.kind === "fix")).toBe(true)
      const retries = end.items.filter(
        (i) => i.kind === "question" && i.role === "fix"
      )
      expect(retries.length).toBe(scored)
      expect(end.fixed.length).toBe(scored)
      expect(end.inFix).toBe(true)
      // The score counts the first pass: everything missed.
      expect(summarize(l, end.results)).toMatchObject({
        first: 0,
        second: 0,
        missed: scored,
      })
    })
  }
})

describe("the app's own actions", () => {
  const l = lessons[0]![1]
  const step = reducer(l)

  it("restarts the bound lesson, counting the run", () => {
    let state = start(l)
    state = step(state, { type: "next" })
    state = step(state, { type: "restart" })
    expect(state.index).toBe(0)
    expect(state.run).toBe(1)
    expect(state.question).toBeNull()
  })

  it("resumes a saved state as it is", () => {
    const saved = { ...start(l), index: 3, run: 2 }
    expect(step(start(l), { type: "resume", state: saved })).toBe(saved)
  })

  it("offers the hint while answering, and a miss opens it for the retry", () => {
    const l2 = lessons[5]![1]
    const step2 = reducer(l2)
    let state = start(l2)
    // To the first kata with a hint.
    const hinted = () => {
      const item = state.items[state.index]!
      return item.kind === "question" && item.role !== "hook" && item.kata.hint
        ? item
        : null
    }
    while (!hinted()) state = step2(state, { type: "next" })
    const item = hinted()!
    expect(hintOffered(item, state.question!)).toBe(true)
    state = step2(state, { type: "hint" })
    expect(state.question!.hintOpen).toBe(true)
    state = step2(state, { type: "hint" })
    expect(state.question!.hintOpen).toBe(false)
  })
})
