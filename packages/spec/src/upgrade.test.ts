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
  it.each(exampleFiles())("turns %s back into the same 0.7 lesson", (file) => {
    const lesson = loadExample(file)
    const upgraded = upgradeLesson(asV02(lesson))
    expect(upgraded).toEqual(lesson)
    expect(JSON.stringify(upgraded)).toBe(JSON.stringify(lesson))
    expect(validateLesson(upgraded).ok).toBe(true)
  })

  it.each(["0.3", "0.4", "0.5", "0.6"])(
    "brings a %s lesson to 0.7 by its version alone",
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

  it("maps a 0.5 lesson's topic to a subject and keeps the label as a tag", () => {
    const {
      subject: _subject,
      tags: _tags,
      ...rest
    } = loadExample("button-hierarchy.json")
    const old = { ...rest, spec: "0.5", topic: "UI design" }
    expect(canUpgrade(old)).toBe(true)
    const upgraded = upgradeLesson(old) as Record<string, unknown>
    expect(upgraded.spec).toBe("0.7")
    expect(upgraded.subject).toBe("design")
    // "ui-design" is a synonym of "user-interface"
    expect(upgraded.tags).toEqual(["user-interface"])
    expect("topic" in upgraded).toBe(false)
    // The field order of a hand-written file: subject and tags right after estimatedMinutes.
    expect(Object.keys(upgraded).slice(0, 10)).toEqual([
      "spec",
      "title",
      "summary",
      "objective",
      "language",
      "level",
      "estimatedMinutes",
      "subject",
      "tags",
      "hook",
    ])
    const result = validateLesson(upgraded)
    expect(result.ok).toBe(true)
  })

  it.each([
    ["Startups", "business", ["startups"]],
    ["Git & Claude Code", "tools", ["git-claude-code"]],
    ["Claude Code", "tools", ["claude-code"]],
    ["Personal finance", "money", ["personal-finance"]],
    ["JavaScript", "programming", ["javascript"]],
    // The label is the subject itself, so it isn't worth a tag.
    ["History", "history", undefined],
    // Unknown labels land in life, with the label kept.
    ["Beekeeping", "life", ["beekeeping"]],
  ])("maps the topic %j to %s with tags %j", (topic, subject, tags) => {
    const {
      subject: _subject,
      tags: _tags,
      ...rest
    } = loadExample("button-hierarchy.json")
    const upgraded = upgradeLesson({ ...rest, spec: "0.5", topic }) as Record<
      string,
      unknown
    >
    expect(upgraded.subject).toBe(subject)
    expect(upgraded.tags).toEqual(tags)
    expect(validateLesson(upgraded).ok).toBe(true)
  })

  it("drops a label that only repeats a language the lesson sets", () => {
    const {
      subject: _subject,
      tags: _tags,
      ...rest
    } = loadExample("spanish-greetings.json")
    const upgraded = upgradeLesson({
      ...rest,
      spec: "0.5",
      topic: "Spanish",
    }) as Record<string, unknown>
    expect(upgraded.subject).toBe("languages")
    expect(upgraded.tags).toBeUndefined()
    expect(validateLesson(upgraded).ok).toBe(true)
  })

  it("gives a 0.5 lesson without a topic the widest subject", () => {
    const {
      subject: _subject,
      tags: _tags,
      ...rest
    } = loadExample("button-hierarchy.json")
    const upgraded = upgradeLesson({ ...rest, spec: "0.5" }) as Record<
      string,
      unknown
    >
    expect(upgraded.subject).toBe("life")
    expect(upgraded.tags).toBeUndefined()
    expect(validateLesson(upgraded).ok).toBe(true)
  })

  it("keeps a subject an older file already has, and adds the topic as a tag", () => {
    const lesson = loadExample("button-hierarchy.json")
    const upgraded = upgradeLesson({
      ...lesson,
      spec: "0.5",
      topic: "Call to action",
    }) as Record<string, unknown>
    expect(upgraded.subject).toBe("design")
    expect(upgraded.tags).toEqual([...lesson.tags, "call-to-action"])
    // A label already among the tags isn't added twice.
    expect(
      (
        upgradeLesson({ ...lesson, spec: "0.5", topic: "Buttons" }) as Record<
          string,
          unknown
        >
      ).tags
    ).toEqual(lesson.tags)
  })

  it("moves a 0.6 math lesson to data when its tags say so, and leaves other math alone", () => {
    const lesson = loadExample("correlation-vs-causation.json")
    expect(lesson.subject).toBe("data")
    const asMath = { ...lesson, spec: "0.6", subject: "math" }
    expect(canUpgrade(asMath)).toBe(true)
    expect(upgradeLesson(asMath)).toEqual(lesson)
    const algebra = { ...asMath, tags: ["algebra", "equations"] }
    expect(upgradeLesson(algebra)).toEqual({ ...algebra, spec: "0.7" })
    // The same split applies to older files, whose topic lands in math first.
    const { subject: _s, tags: _t, ...rest } = lesson
    expect(
      (
        upgradeLesson({ ...rest, spec: "0.5", topic: "Statistics" }) as Record<
          string,
          unknown
        >
      ).subject
    ).toBe("data")
    expect(
      (
        upgradeLesson({ ...rest, spec: "0.5", topic: "Algebra" }) as Record<
          string,
          unknown
        >
      ).subject
    ).toBe("life")
  })

  it("leaves current and unknown files alone", () => {
    const lesson = loadExample("button-hierarchy.json")
    expect(canUpgrade(lesson)).toBe(false)
    expect(upgradeLesson(lesson)).toBe(lesson)
    expect(upgradeLesson("nope")).toBe("nope")
  })
})
