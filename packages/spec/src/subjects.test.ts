import { readFileSync } from "node:fs"

import { describe, expect, it } from "vitest"

import { LEVELS } from "./basics"
import { isSubject, SUBJECT_INFO, SUBJECTS } from "./subjects"
import {
  isTagLabel,
  labelForTag,
  normalizeLabel,
  normalizeLessonTags,
  normalizeTag,
  TAG_LABEL_PATTERN,
  TAG_LABELS,
  TAG_PATTERN,
  TAG_SYNONYMS,
} from "./tags"

describe("subjects", () => {
  it("are the plan's 16 plus data, each with a name and scope notes", () => {
    expect(SUBJECTS).toHaveLength(17)
    expect(new Set(SUBJECTS).size).toBe(17)
    for (const subject of SUBJECTS) {
      const info = SUBJECT_INFO[subject]
      expect(subject, "slugs are one lowercase word").toMatch(/^[a-z]+$/)
      expect(
        info.name.split(/\s+/).length,
        `${subject} name`
      ).toBeLessThanOrEqual(3)
      expect(info.covers).toMatch(/\S/)
      expect(info.notThis).toMatch(/\S/)
    }
    expect(isSubject("history")).toBe(true)
    expect(isSubject("coding")).toBe(false)
  })

  it("every subject a scope note points to exists", () => {
    for (const subject of SUBJECTS) {
      const info = SUBJECT_INFO[subject]
      for (const [, target] of `${info.covers} ${info.notThis}`.matchAll(
        /→ `([a-z]+)`/g
      ))
        expect(isSubject(target), `${subject} points to ${target}`).toBe(true)
    }
  })

  it("are listed in the format reference the agent reads, with the same scope notes", () => {
    const reference = readFileSync(
      new URL(
        "../../../skills/learn/reference/lesson-format.md",
        import.meta.url
      ),
      "utf8"
    )
    for (const subject of SUBJECTS) {
      const info = SUBJECT_INFO[subject]
      const row = `| \`${subject}\` | ${info.name} | ${info.covers} | ${info.notThis} |`
      expect(reference, `${subject} row in lesson-format.md`).toContain(row)
    }
  })
})

describe("tags", () => {
  it("match lowercase words joined by single hyphens, in any script", () => {
    for (const ok of [
      "git",
      "claude-code",
      "bronze-age",
      "a11y",
      "historia",
      "历史",
      "تاريخ",
      "हिन्दी",
    ])
      expect(TAG_PATTERN.test(ok), ok).toBe(true)
    for (const bad of [
      "Git",
      "claude code",
      "claude_code",
      "-git",
      "git-",
      "claude--code",
      "#git",
      "c++",
      "",
    ])
      expect(TAG_PATTERN.test(bad), bad).toBe(false)
  })

  it("labels are short, readable, in any script, and never start with #", () => {
    for (const ok of [
      "Git",
      "Claude Code",
      "C++",
      "C#",
      "A/B testing",
      "Node.js",
      ".NET",
      "Ohm's law",
      "Rule of 72",
      "Higher-order functions",
      "Tom & Jerry",
      "历史",
      "تاريخ",
    ])
      expect(TAG_LABEL_PATTERN.test(ok), ok).toBe(true)
    for (const bad of [
      "#git",
      "claude_code",
      "Buttons!",
      " Git",
      "Git ",
      "(x)",
      "",
    ])
      expect(TAG_LABEL_PATTERN.test(bad), bad).toBe(false)
  })

  it("derive one key from a label, whatever its spelling, then map synonyms", () => {
    expect(normalizeTag(" Claude Code ")).toBe("claude-code")
    expect(normalizeTag("claude_code")).toBe("claude-code")
    expect(normalizeTag("#git")).toBe("git")
    expect(normalizeTag("Git & GitHub")).toBe("git-github")
    expect(normalizeTag("JS")).toBe("javascript")
    expect(normalizeTag("UX")).toBe("user-experience")
    expect(normalizeTag("claudecode")).toBe("claude-code")
    expect(normalizeTag("compound-interest")).toBe("compound-interest")
    expect(normalizeTag("Compound interest")).toBe("compound-interest")
    // Names whose symbols mean something keep a key of their own.
    expect(normalizeTag("C++")).toBe("cpp")
    expect(normalizeTag("c++")).toBe("cpp")
    expect(normalizeTag("C#")).toBe("csharp")
    expect(normalizeTag("F#")).toBe("fsharp")
    expect(normalizeTag(".NET")).toBe("dotnet")
    // Apostrophes are dropped, not hyphenated.
    expect(normalizeTag("Ohm's law")).toBe("ohms-law")
    expect(normalizeTag("Ohm’s law")).toBe("ohms-law")
    expect(normalizeTag("Node.js")).toBe("nodejs")
    expect(normalizeTag("A/B testing")).toBe("a-b-testing")
  })

  it(
    "normalizes a label of many hyphens in linear time",
    { timeout: 1000 },
    () => {
      expect(normalizeTag("-".repeat(200_000))).toBe("")
      expect(normalizeTag("--Git--" + "-".repeat(200_000))).toBe("git")
    }
  )

  it("tidy a label without touching its casing", () => {
    expect(normalizeLabel("  Claude  Code ")).toBe("Claude Code")
    expect(normalizeLabel("#Git")).toBe("Git")
    expect(normalizeLabel("## Git")).toBe("Git")
    expect(normalizeLabel("JavaScript")).toBe("JavaScript")
    expect(isTagLabel("Git")).toBe(true)
    expect(isTagLabel("x")).toBe(false)
    expect(isTagLabel("x".repeat(31))).toBe(false)
  })

  it("write a key as a label: the known spelling, else sentence case", () => {
    expect(labelForTag("javascript")).toBe("JavaScript")
    expect(labelForTag("claude-code")).toBe("Claude Code")
    expect(labelForTag("a-b-testing")).toBe("A/B testing")
    expect(labelForTag("ios")).toBe("iOS")
    expect(labelForTag("compound-interest")).toBe("Compound interest")
    expect(labelForTag("startups")).toBe("Startups")
    expect(labelForTag("historia")).toBe("Historia")
  })

  it("keep the synonym table normalized and pointing at canonical keys", () => {
    for (const [from, to] of Object.entries(TAG_SYNONYMS)) {
      expect(from, from).toMatch(TAG_PATTERN)
      expect(to, to).toMatch(TAG_PATTERN)
      expect(from).not.toBe(to)
      expect(
        TAG_SYNONYMS[to],
        `${from} → ${to} → ${TAG_SYNONYMS[to]}`
      ).toBeUndefined()
      expect(SUBJECTS as readonly string[]).not.toContain(to)
      expect(LEVELS as readonly string[]).not.toContain(to)
    }
  })

  it("keep every known label a valid label whose key is its own entry", () => {
    for (const [key, label] of Object.entries(TAG_LABELS)) {
      expect(key, key).toMatch(TAG_PATTERN)
      expect(TAG_SYNONYMS[key], `${key} is a synonym, not a key`).toBeUndefined()
      expect(isTagLabel(label), label).toBe(true)
      expect(normalizeTag(label), `${label} → ${key}`).toBe(key)
    }
  })

  it("report what changed on a lesson's tags and leave the rest alone", () => {
    const { data, changes } = normalizeLessonTags({
      title: "x",
      tags: [" Git", "Claude Code", 3],
    })
    expect(data).toEqual({ title: "x", tags: ["Git", "Claude Code", 3] })
    expect(changes).toEqual([{ path: "tags[0]", from: " Git", to: "Git" }])
    const same = { title: "x", tags: ["Git"] }
    expect(normalizeLessonTags(same).data).toBe(same)
    expect(normalizeLessonTags("nope").data).toBe("nope")
    expect(normalizeLessonTags({ tags: "git" }).changes).toEqual([])
  })
})
