// @vitest-environment happy-dom
import * as React from "react"
import { act, cleanup, render } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import buttonHierarchy from "../../../examples/button-hierarchy.json"
import { validateLesson, type Lesson } from "@workspace/spec"

import { buildSequence } from "@workspace/player-core/flow"
import { LessonPlayer, type State } from "./lesson-player"
import { saveProgress } from "./progress"

// What the player tells the page as the learner goes: how far they've got, for an In progress list.

const result = validateLesson(buttonHierarchy)
if (!result.ok) throw new Error("An example lesson is invalid.")
const lesson: Lesson = result.lesson

beforeEach(() => {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: query.includes("prefers-reduced-motion"),
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  }))
  const saved = new Map<string, string>()
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => saved.get(k) ?? null,
    setItem: (k: string, v: string) => void saved.set(k, String(v)),
    removeItem: (k: string) => void saved.delete(k),
    clear: () => saved.clear(),
    key: (i: number) => [...saved.keys()][i] ?? null,
    get length() {
      return saved.size
    },
  })
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

async function settle() {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 50))
  })
}

/** A run saved at the screen `kind` (the first of it), as a reload would find it. */
function savedAt(kind: "concept" | "fix" | "wrap") {
  const items = buildSequence(lesson)
  const state: State = {
    items,
    index: items.findIndex((i) => i.kind === kind),
    results: {},
    mistakes: [],
    fixed: [],
    inFix: kind === "fix",
    fixQueued: false,
    guesses: {},
    question: null,
    run: 0,
  }
  saveProgress(localStorage, "l/x", lesson, state)
}

describe("progress sent to the page", () => {
  it("says how far a resumed learner has got", async () => {
    savedAt("concept")
    const onProgress = vi.fn()
    render(
      <LessonPlayer lesson={lesson} progressKey="l/x" onProgress={onProgress} />
    )
    await settle()
    expect(onProgress).toHaveBeenCalledTimes(1)
    const [{ done, total }] = onProgress.mock.calls[0]!
    expect(done).toBeGreaterThan(0)
    expect(done).toBeLessThan(total)
  })

  it("says nothing on the fix screen, which is past every kata", async () => {
    savedAt("fix")
    const onProgress = vi.fn()
    render(
      <LessonPlayer lesson={lesson} progressKey="l/x" onProgress={onProgress} />
    )
    await settle()
    expect(onProgress).not.toHaveBeenCalled()
  })
})
