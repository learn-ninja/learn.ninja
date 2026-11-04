import { describe, expect, it } from "vitest"

import { exampleFiles, loadExample } from "./test-helpers"
import { canUpgrade, splitTopic, upgradeLesson } from "./upgrade"
import { validateLesson } from "./validate"

/** An example lesson written the spec 0.2 way: loops of a concept and its practice. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function asV02(lesson: any) {
  const { katas, ...rest } = lesson
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const loops: { concept: any; practice: any[] }[] = []
  for (const kata of katas) {
    if (kata.type === "concept") {
      const { type: _type, ...concept } = kata
      loops.push({ concept, practice: [] })
    } else loops.at(-1)!.practice.push(kata)
  }
  return { ...rest, spec: "0.2", loops }
}

describe("upgradeLesson", () => {
  it.each(exampleFiles())("turns %s back into the same 0.9 lesson", (file) => {
    const lesson = loadExample(file)
    const upgraded = upgradeLesson(asV02(lesson))
    expect(upgraded).toEqual(lesson)
    expect(JSON.stringify(upgraded)).toBe(JSON.stringify(lesson))
    expect(validateLesson(upgraded).ok).toBe(true)
  })

  it.each(["0.3", "0.4", "0.5", "0.6", "0.7", "0.8"])(
    "brings a %s lesson to 0.9 by its version alone",
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

  it("renames a 0.8 lesson's bricks to katas, in the same place", () => {
    const lesson = loadExample("button-hierarchy.json")
    const old = Object.fromEntries(
      Object.entries({ ...lesson, spec: "0.8" }).map(([key, value]) => [
        key === "katas" ? "bricks" : key,
        value,
      ])
    )
    expect(canUpgrade(old)).toBe(true)
    const upgraded = upgradeLesson(old)
    expect(upgraded).toEqual(lesson)
    expect(JSON.stringify(upgraded)).toBe(JSON.stringify(lesson))
    expect(validateLesson(upgraded).ok).toBe(true)
  })

  it("drops the term from concept katas, in 0.2 and 0.3 files", () => {
    const lesson = loadExample("button-hierarchy.json")
    const term = { word: "Primary button", definition: "The main action." }
    const withTerm = {
      ...lesson,
      katas: lesson.katas.map((b: { type: string }) =>
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
    expect(upgraded.spec).toBe("0.9")
    expect(upgraded.subject).toBe("design")
    // The label is kept as written; its key, "ui-design", is a synonym of "user-interface".
    expect(upgraded.tags).toEqual(["UI design"])
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

  /** Only the tags are missing: what an old file with a redundant or absent label comes to. */
  function expectOnlyTagsMissing(upgraded: unknown) {
    const result = validateLesson(upgraded)
    expect(result.ok).toBe(false)
    expect(result.issues).toEqual([
      {
        kind: "structure",
        path: "tags",
        message: expect.stringMatching(/expected array|>=1/),
      },
    ])
  }

  it.each([
    // The three lessons live when 0.6 shipped, as they were labelled.
    ["Startups", "business", ["Startups"]],
    ["Git & Claude Code", "tools", ["Git", "Claude Code"]],
    ["Claude Code", "tools", ["Claude Code"]],
    ["Personal finance", "money", ["Personal finance"]],
    ["JavaScript", "programming", ["JavaScript"]],
    // Compound labels split on &, commas, "and", and a spaced slash, each part kept as written
    // (a lowercase word is in slug form, so it gets sentence case like any slug tag).
    ["Git, GitHub and CI/CD", "life", ["Git", "GitHub", "CI/CD"]],
    ["Typography / color", "life", ["Typography", "Color"]],
    // The label is the subject itself, so it isn't worth a tag.
    ["History", "history", undefined],
    // Unknown labels land in life, with the label kept.
    ["Beekeeping", "life", ["Beekeeping"]],
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
    expect(upgraded.spec).toBe("0.9")
    expect(upgraded.subject).toBe(subject)
    expect(upgraded.tags).toEqual(tags)
    // Tags are required from 0.8, so a lesson left without them has that one thing to fix.
    if (tags) expect(validateLesson(upgraded).ok).toBe(true)
    else expectOnlyTagsMissing(upgraded)
    // Upgrading again changes nothing.
    expect(canUpgrade(upgraded)).toBe(false)
    expect(upgradeLesson(upgraded)).toBe(upgraded)
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
    expectOnlyTagsMissing(upgraded)
  })

  it("splits a topic on &, commas, and, and a spaced slash", () => {
    expect(splitTopic("Git & Claude Code")).toEqual(["Git", "Claude Code"])
    expect(splitTopic("Git&GitHub")).toEqual(["Git", "GitHub"])
    expect(splitTopic("Git,  GitHub\tand CI/CD")).toEqual([
      "Git",
      "GitHub",
      "CI/CD",
    ])
    expect(splitTopic("Typography  /  color")).toEqual(["Typography", "color"])
    expect(splitTopic("Rock AND roll")).toEqual(["Rock", "roll"])
    expect(splitTopic("CI/CD")).toEqual(["CI/CD"])
    expect(splitTopic("Sandbox")).toEqual(["Sandbox"])
  })

  it("splits a topic of many spaces in linear time", { timeout: 1000 }, () => {
    expect(splitTopic(" ".repeat(200_000))).toEqual([])
    expect(splitTopic("a" + " ".repeat(200_000) + "b")).toEqual(["a b"])
  })

  it("ignores an over-long topic instead of splitting it into tags", () => {
    const {
      subject: _subject,
      tags: _tags,
      ...rest
    } = loadExample("button-hierarchy.json")
    const topic = "Git & " + " ".repeat(500) + "Beekeeping"
    const upgraded = upgradeLesson({ ...rest, spec: "0.5", topic }) as Record<
      string,
      unknown
    >
    expect(upgraded.subject).toBe("life")
    expect(upgraded.tags).toBeUndefined()
    expect("topic" in upgraded).toBe(false)
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
    expectOnlyTagsMissing(upgraded)
  })

  it("keeps a subject an older file already has, and adds the topic as a tag", () => {
    const lesson = loadExample("button-hierarchy.json")
    const upgraded = upgradeLesson({
      ...lesson,
      spec: "0.5",
      topic: "Call to action",
    }) as Record<string, unknown>
    expect(upgraded.subject).toBe("design")
    expect(upgraded.tags).toEqual([...lesson.tags, "Call to action"])
    // A label already among the tags (by key, whatever its casing) isn't added twice.
    expect(
      (
        upgradeLesson({ ...lesson, spec: "0.5", topic: "buttons" }) as Record<
          string,
          unknown
        >
      ).tags
    ).toEqual(lesson.tags)
  })

  it("turns the slug tags of a 0.6 or 0.7 lesson into labels", () => {
    const lesson = loadExample("map-vs-foreach.json")
    const slugs = {
      ...lesson,
      spec: "0.7",
      tags: ["javascript", "arrays", "higher-order-functions"],
    }
    // A slug's hyphens are word breaks, so the one inside "higher-order" can't come back.
    const labels = {
      ...lesson,
      tags: ["JavaScript", "Arrays", "Higher order functions"],
    }
    expect(upgradeLesson(slugs)).toEqual(labels)
    expect(JSON.stringify(upgradeLesson(slugs))).toBe(JSON.stringify(labels))
    expect(validateLesson(labels).ok).toBe(true)
    const known = upgradeLesson({
      ...slugs,
      spec: "0.6",
      tags: ["claude-code", "a-b-testing", "cpp", "vs-code", "remote-work"],
    }) as Record<string, unknown>
    expect(known.tags).toEqual([
      "Claude Code",
      "A/B testing",
      "C++",
      "VS Code",
      "Remote work",
    ])
    expect(validateLesson(known).ok).toBe(true)
    // The live lesson tagged `claude-code` under 0.7 shows "Claude Code" once upgraded.
    const live = upgradeLesson({
      ...slugs,
      subject: "tools",
      tags: ["claude-code"],
    }) as Record<string, unknown>
    expect(live.tags).toEqual(["Claude Code"])
    expect(upgradeLesson(live)).toBe(live)
  })

  it("moves a 0.6 math lesson to data when its tags say so, and leaves other math alone", () => {
    const lesson = loadExample("correlation-vs-causation.json")
    expect(lesson.subject).toBe("data")
    const asMath = { ...lesson, spec: "0.6", subject: "math" }
    expect(canUpgrade(asMath)).toBe(true)
    expect(upgradeLesson(asMath)).toEqual(lesson)
    const algebra = { ...asMath, tags: ["algebra", "equations"] }
    expect(upgradeLesson(algebra)).toEqual({
      ...algebra,
      spec: "0.9",
      tags: ["Algebra", "Equations"],
    })
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
