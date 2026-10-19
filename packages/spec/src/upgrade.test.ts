import { describe, expect, it } from "vitest"

import { exampleFiles, loadExample } from "./test-helpers"
import { canUpgrade, upgradeLesson } from "./upgrade"
import { validateLesson } from "./validate"

/** An example lesson written the spec 0.2 way: loops of a concept and its practice. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function asV02(lesson: any) {
  const { bricks, ...rest } = lesson
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const loops: { concept: any; practice: any[] }[] = []
  for (const brick of bricks) {
    if (brick.type === "concept") {
      const { type: _type, ...concept } = brick
      loops.push({ concept, practice: [] })
    } else loops.at(-1)!.practice.push(brick)
  }
  return { ...rest, spec: "0.2", loops }
}

describe("upgradeLesson", () => {
  it.each(exampleFiles())("turns %s back into the same 0.5 lesson", (file) => {
    const lesson = loadExample(file)
    const upgraded = upgradeLesson(asV02(lesson))
    expect(upgraded).toEqual(lesson)
    expect(JSON.stringify(upgraded)).toBe(JSON.stringify(lesson))
    expect(validateLesson(upgraded).ok).toBe(true)
  })

  it.each(["0.3", "0.4"])(
    "brings a %s lesson to 0.5 by its version alone",
    (spec) => {
      const lesson = loadExample("button-hierarchy.json")
      const old = { ...lesson, spec }
      expect(canUpgrade(old)).toBe(true)
      const upgraded = upgradeLesson(old)
      expect(upgraded).toEqual(lesson)
      expect(JSON.stringify(upgraded)).toBe(JSON.stringify(lesson))
      expect(canUpgrade(lesson)).toBe(false)
    }
  )

  it("drops the term from concept bricks, in 0.2 and 0.3 files", () => {
    const lesson = loadExample("button-hierarchy.json")
    const term = { word: "Primary button", definition: "The main action." }
    const withTerm = {
      ...lesson,
      bricks: lesson.bricks.map((b: { type: string }) =>
        b.type === "concept" ? { ...b, term } : b
      ),
    }
    expect(canUpgrade(withTerm)).toBe(true)
    expect(upgradeLesson(withTerm)).toEqual(lesson)
    expect(upgradeLesson(asV02(withTerm))).toEqual(lesson)
    expect(validateLesson(upgradeLesson(withTerm)).ok).toBe(true)
  })

  it("leaves current and unknown files alone", () => {
    const lesson = loadExample("button-hierarchy.json")
    expect(canUpgrade(lesson)).toBe(false)
    expect(upgradeLesson(lesson)).toBe(lesson)
    expect(upgradeLesson("nope")).toBe("nope")
  })
})
