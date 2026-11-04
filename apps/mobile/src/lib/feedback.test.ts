import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"

import { describe, expect, it } from "vitest"

import { solution } from "@workspace/player-core/check"
import type { State } from "@workspace/player-core/state"
import { stringsFor } from "@workspace/player-core/strings"
import { createLinePicker } from "@workspace/player-core/voices"
import { validateLesson, type Lesson } from "@workspace/spec"

import { feedbackFor } from "./feedback"
import { reducer, start, type AppAction } from "./play"

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

const l = lesson("correlation-vs-causation.json")
const step = reducer(l)
const t = stringsFor("en")

/** The tray for a state, with a fresh line picker. */
const tray = (state: State, whyOpen = false) =>
  feedbackFor({
    item: state.items[state.index]!,
    state,
    t,
    lang: "en",
    pickLine: createLinePicker("test"),
    whyOpen,
  })

/** The state on the first kata of a type, past the intro. */
function at(type: string): State {
  let state = start(l)
  for (;;) {
    const item = state.items[state.index]!
    if (
      item.kind === "question" &&
      item.role !== "hook" &&
      item.kata.type === type
    )
      return state
    state = step(state, { type: "next" })
  }
}
const go = (state: State, ...actions: AppAction[]) =>
  actions.reduce((s, a) => step(s, a), state)
const kataOf = (state: State) => {
  const item = state.items[state.index]!
  if (item.kind !== "question") throw new Error("not a question")
  return item.kata
}

describe("the tray", () => {
  it("offers Start on the intro and Continue on a concept", () => {
    const intro = tray(start(l))
    expect(intro.primary).toMatchObject({ label: "Start lesson" })
    const concept = tray(go(start(l), { type: "next" }, { type: "next" }))
    expect(concept.primary).toMatchObject({ label: "Continue" })
    expect(concept.title).toBeNull()
  })

  it("keeps Check off until the answer is ready, and offers Hint while answering", () => {
    const state = at("choice")
    const f = tray(state)
    expect(f.primary).toMatchObject({ label: "Check", disabled: true })
    expect(f.hint).toEqual({ open: false })
    expect(f.hintNote).toBeNull()
    const hinted = go(state, { type: "hint" })
    expect(tray(hinted).hintNote).toBe(kataOf(state).hint)
    expect(tray(hinted).hint).toEqual({ open: true })
    const answered = go(state, {
      type: "answer",
      answer: solution(kataOf(state)),
    })
    expect(tray(answered).primary).toMatchObject({ disabled: false })
  })

  it("says how many sort items are left", () => {
    const state = at("sort")
    expect(tray(state).primary?.label).toMatch(/left to sort/)
  })

  it("praises a right answer in green, with Why? adding the explanation", () => {
    const state = at("choice")
    const kata = kataOf(state)
    const checked = go(
      state,
      { type: "answer", answer: solution(kata) },
      { type: "check" }
    )
    const f = tray(checked)
    expect(f.tone).toBe("good")
    expect(f.title).toBeTruthy()
    expect(f.message).toBeNull()
    expect(f.primary).toMatchObject({ label: "Continue", variant: "success" })
    expect(f.why).toEqual({ open: false, everyPath: false })
    const why = tray(checked, true)
    expect(why.message).toBe(kata.explanation)
    expect(why.noteTone).toBe("good")
  })

  it("nudges a miss in yellow with the hint, then Try again", () => {
    const state = at("choice")
    const kata = kataOf(state)
    if (kata.type !== "choice") throw new Error()
    const wrong = kata.options.find((o) => !kata.correct.includes(o.id))!.id
    const missed = go(
      state,
      { type: "answer", answer: { kind: "select", ids: [wrong] } },
      { type: "check" }
    )
    const f = tray(missed)
    expect(f.tone).toBe("warn")
    expect(f.message).toBe(kata.hint)
    expect(f.primary).toMatchObject({ label: "Try again", variant: "warning" })
    expect(f.why).toBeNull()
    // The retry shows the hint under the answers.
    expect(tray(go(missed, { type: "retry" })).hintNote).toBe(kata.hint)
  })

  it("reveals the answer in a neutral tray with the explanation", () => {
    const state = at("choice")
    const kata = kataOf(state)
    if (kata.type !== "choice") throw new Error()
    const wrong = {
      kind: "select" as const,
      ids: [kata.options.find((o) => !kata.correct.includes(o.id))!.id],
    }
    const revealed = go(
      state,
      { type: "answer", answer: wrong },
      { type: "check" },
      { type: "retry" },
      { type: "answer", answer: wrong },
      { type: "check" }
    )
    const f = tray(revealed)
    expect(f.tone).toBe("neutral")
    expect(f.message).toBe(kata.explanation)
    expect(f.noteTone).toBe("good")
    expect(f.primary).toMatchObject({ label: "Continue", variant: "default" })
  })

  it("tells a scenario's brief first, then rewinds a miss with its outcome", () => {
    const state = at("scenario")
    const kata = kataOf(state)
    if (kata.type !== "scenario") throw new Error()
    expect(tray(state).brief).toBe(true)
    expect(tray(state).primary?.action).toEqual({ type: "briefed" })
    const briefed = go(state, { type: "briefed" })
    expect(tray(briefed).brief).toBe(false)
    expect(tray(briefed).hint).toEqual(kata.hint ? { open: false } : null)
    const poor = kata.options.find((o) => o.quality === "poor")!
    const missed = go(
      briefed,
      { type: "answer", answer: { kind: "select", ids: [poor.id] } },
      { type: "check" }
    )
    const f = tray(missed)
    expect(f.primary).toMatchObject({ label: "Rewind", variant: "warning" })
    // This scenario has a chat: the outcome is the reply in it, so the note stays empty.
    expect(f.message).toBeNull()
    const best = kata.options.find((o) => o.quality === "best")!
    const right = go(
      missed,
      { type: "retry" },
      { type: "answer", answer: { kind: "select", ids: [best.id] } },
      { type: "check" }
    )
    expect(tray(right).why).toEqual({ open: false, everyPath: true })
  })

  it("colors the hook's guess but moves on either way", () => {
    const hook = go(start(l), { type: "next" })
    const kata = kataOf(hook)
    if (kata.type !== "choice") throw new Error()
    const wrong = kata.options.find((o) => !kata.correct.includes(o.id))!.id
    const missed = go(
      hook,
      { type: "answer", answer: { kind: "select", ids: [wrong] } },
      { type: "check" }
    )
    const f = tray(missed)
    expect(f.tone).toBe("warn")
    expect(f.primary).toMatchObject({ label: "Continue", variant: "warning" })
    expect(f.why).toBeNull()
  })

  it("offers Start on the fix round and leaves the wrap-up's actions to it", () => {
    const fix: State = { ...start(l), index: start(l).items.length - 2 }
    expect(tray(fix).primary?.action).toEqual({ type: "startFix" })
    const wrap: State = { ...start(l), index: start(l).items.length - 1 }
    expect(tray(wrap).primary).toBeNull()
  })
})
