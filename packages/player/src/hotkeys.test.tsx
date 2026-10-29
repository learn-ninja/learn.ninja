// @vitest-environment happy-dom
import * as React from "react"
import { act, cleanup, fireEvent, render } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import buttonHierarchy from "../../../examples/button-hierarchy.json"
import spanishGreetings from "../../../examples/spanish-greetings.json"
import { validateLesson, type Lesson } from "@workspace/spec"

import { LessonPlayer } from "./lesson-player"
import { stringsFor } from "./strings"

// The player's keys, played in a browser-like page: Enter runs the main action from wherever focus
// is, never undoes work in a kata, and the number keys pick in every kata that has things to pick.

const t = stringsFor("en")

function load(raw: unknown): Lesson {
  const result = validateLesson(raw)
  if (!result.ok) throw new Error("An example lesson is invalid.")
  return result.lesson
}
const buttons = load(buttonHierarchy)
const spanish = load(spanishGreetings)

beforeEach(() => {
  // A desktop with reduced motion: screens change at once, and the tray has its notch.
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
  // The player saves preferences (the tray, sound) per browser; start each test fresh.
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

/** Let the language load and the effects settle. */
async function settle() {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 50))
  })
}

async function play(lesson: Lesson, startAt?: string) {
  render(<LessonPlayer lesson={lesson} startAt={startAt} />)
  await settle()
}

/** A key press as the browser sends it, at whatever has focus. */
async function key(name: string, code = name) {
  const el = document.activeElement ?? document.body
  fireEvent.keyDown(el, { key: name, code })
  fireEvent.keyUp(el, { key: name, code })
  await settle()
}

function focus(el: Element | null | undefined) {
  if (!el) throw new Error("Nothing to focus.")
  act(() => (el as HTMLElement).focus())
  expect(document.activeElement).toBe(el)
}

const byLabel = (start: string) =>
  [...document.querySelectorAll("button")].find((b) =>
    (b.getAttribute("aria-label") ?? b.textContent ?? "").startsWith(start)
  )
const byText = (text: string) =>
  [...document.querySelectorAll("button")].find(
    (b) => b.textContent?.trim() === text
  )
const feedback = () => document.querySelector("[data-feedback-toast]")

describe("Enter from the player's chrome", () => {
  it.each([
    "Sound",
    "Text size",
    "Ninja",
    "Hide buttons",
    "Lesson menu",
    "Keyboard shortcuts",
  ])("runs the main action after %s was clicked", async (name) => {
    await play(buttons)
    expect(byText(t.start)).toBeDefined()
    const control = byLabel(name)!
    const label = control.getAttribute("aria-label")
    focus(control)
    await key("Enter")
    // The lesson started (Start lesson is gone) and the control was left as it was.
    expect(byText(t.start)).toBeUndefined()
    expect(byLabel(name)?.getAttribute("aria-label")).toBe(label)
    expect(document.querySelector("[role=menu], [role=dialog]")).toBeNull()
  })

  it("still lets Enter press the main button itself", async () => {
    await play(buttons)
    focus(byText(t.start))
    await key("Enter")
    expect(byText(t.start)).toBeUndefined()
  })
})

describe("Enter in the order kata", () => {
  const pool = () =>
    [
      ...document.querySelectorAll(
        `[role=group][aria-label="${t.pool}"] button`
      ),
    ] as HTMLButtonElement[]
  const placed = () =>
    [...document.querySelectorAll("ol button")] as HTMLButtonElement[]

  it("places a waiting item, then checks instead of taking one back", async () => {
    await play(spanish, "ch")
    const count = pool().length
    focus(pool()[0])
    for (let i = 0; i < count; i++) {
      // Enter on a waiting item places it, and focus moves on to the next one waiting.
      await key("Enter")
      expect(placed()).toHaveLength(i + 1)
    }
    expect(pool()).toHaveLength(0)
    // Focus is on a placed item now: Enter checks the answer, and every item stays in its slot.
    expect(placed()).toContain(document.activeElement)
    expect(feedback()).toBeNull()
    await key("Enter")
    expect(feedback()).not.toBeNull()
    expect(placed()).toHaveLength(count)
  })

  it("doesn't send a placed item back while the answer isn't ready", async () => {
    await play(spanish, "ch")
    focus(pool()[0])
    await key("Enter")
    focus(placed()[0])
    await key("Enter")
    expect(placed()).toHaveLength(1)
    expect(feedback()).toBeNull()
  })

  it("places the Nth waiting item with a number key", async () => {
    await play(spanish, "ch")
    const second = pool()[1]!.textContent
    await key("2")
    expect(placed().map((b) => b.textContent)).toEqual([second])
    const count = pool().length
    for (let i = 0; i < count; i++) await key("1")
    expect(pool()).toHaveLength(0)
  })
})

describe("Enter in the sort kata", () => {
  it("checks the answer from a focused row once everything is sorted", async () => {
    await play(buttons, "p3")
    const rows = [...document.querySelectorAll("[role=radiogroup]")]
    expect(rows.length).toBeGreaterThan(0)
    for (const row of rows) {
      focus(row.querySelector("[role=radio]"))
      await key("1")
    }
    // Focus stays on a row (a radio): Enter checks rather than going to the radio.
    expect(document.activeElement?.getAttribute("role")).toBe("radio")
    expect(feedback()).toBeNull()
    await key("Enter")
    expect(feedback()).not.toBeNull()
  })
})

describe("Enter in the blank kata", () => {
  const gaps = () =>
    [
      ...document.querySelectorAll("[data-enter=main][data-slot=selectable]"),
    ] as HTMLButtonElement[]

  it("checks instead of taking a word out of a filled gap", async () => {
    await play(spanish, "p3")
    await key("1")
    expect(gaps()).toHaveLength(1)
    const word = gaps()[0]!.getAttribute("aria-label")
    // One gap still empty: Check isn't ready, and Enter on the filled gap leaves its word there.
    focus(gaps()[0])
    await key("Enter")
    expect(gaps()[0]?.getAttribute("aria-label")).toBe(word)
    expect(feedback()).toBeNull()
    // Both filled: Enter on a filled gap checks the answer, and the words stay.
    await key("2")
    expect(gaps()).toHaveLength(2)
    focus(gaps()[0])
    await key("Enter")
    expect(feedback()).not.toBeNull()
    expect(gaps()[0]?.getAttribute("aria-label")).toBe(word)
  })
})

describe("Number keys in the match kata", () => {
  it("pick down the left column, then the right", async () => {
    const kata = spanish.katas.find((k) => k.type === "match")!
    if (kata.type !== "match") throw new Error("No match kata.")
    await play(spanish, kata.id)
    const tiles = () =>
      [
        ...document.querySelectorAll("main [data-slot=selectable]"),
      ] as HTMLButtonElement[]
    const n = kata.pairs.length
    await key("1")
    expect(tiles()[0]!.getAttribute("aria-pressed")).toBe("true")
    // The first left item's own match, wherever it was shuffled to on the right.
    const right = tiles().slice(n)
    const at = right.findIndex(
      (b) => b.textContent?.trim() === kata.pairs[0]!.right
    )
    await key(String(at + 1))
    // Matched: both tiles leave play.
    expect(tiles()[0]!.disabled).toBe(true)
    expect(tiles()[n + at]!.disabled).toBe(true)
  })
})

describe("Focus after feedback with the buttons hidden", () => {
  it("moves to the lesson instead of the page", async () => {
    await play(buttons, "p1")
    await key("d", "KeyD")
    expect(byLabel("Show buttons")).toBeDefined()
    // A wrong pick (Continue shopping), checked with Enter.
    await key("2")
    await key("Enter")
    expect(feedback()).not.toBeNull()
    expect(document.activeElement?.tagName).toBe("MAIN")
  })
})
