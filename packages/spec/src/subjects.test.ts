import { readFileSync } from "node:fs"

import { describe, expect, it } from "vitest"

import { LEVELS } from "./schema"
import { isSubject, SUBJECT_INFO, SUBJECTS } from "./subjects"
import {
  normalizeLessonTags,
  normalizeTag,
  TAG_PATTERN,
  TAG_SYNONYMS,
} from "./tags"

describe("subjects", () => {
  it("are the 16 from the plan, each with a name, scope notes, and a hue of its own", () => {
    expect(SUBJECTS).toHaveLength(16)
    expect(new Set(SUBJECTS).size).toBe(16)
    for (const subject of SUBJECTS) {
      const info = SUBJECT_INFO[subject]
      expect(subject, "slugs are one lowercase word").toMatch(/^[a-z]+$/)
      expect(
        info.name.split(/\s+/).length,
        `${subject} name`
      ).toBeLessThanOrEqual(3)
      expect(info.covers).toMatch(/\S/)
      expect(info.notThis).toMatch(/\S/)
      expect(info.hue).toBeGreaterThanOrEqual(0)
      expect(info.hue).toBeLessThan(360)
    }
    const hues = SUBJECTS.map((s) => SUBJECT_INFO[s].hue)
    expect(new Set(hues).size).toBe(SUBJECTS.length)
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

  it("normalize spelling, then map synonyms", () => {
    expect(normalizeTag(" Claude Code ")).toBe("claude-code")
    expect(normalizeTag("claude_code")).toBe("claude-code")
    expect(normalizeTag("#git")).toBe("git")
    expect(normalizeTag("Git & GitHub")).toBe("git-github")
    expect(normalizeTag("JS")).toBe("javascript")
    expect(normalizeTag("UX")).toBe("user-experience")
    expect(normalizeTag("claudecode")).toBe("claude-code")
    expect(normalizeTag("compound-interest")).toBe("compound-interest")
  })

  it("keep the synonym table normalized and pointing at canonical tags", () => {
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

  it("report what changed on a lesson's tags and leave the rest alone", () => {
    const { data, changes } = normalizeLessonTags({
      title: "x",
      tags: ["Git", "claude-code", 3],
    })
    expect(data).toEqual({ title: "x", tags: ["git", "claude-code", 3] })
    expect(changes).toEqual([{ path: "tags[0]", from: "Git", to: "git" }])
    const same = { title: "x", tags: ["git"] }
    expect(normalizeLessonTags(same).data).toBe(same)
    expect(normalizeLessonTags("nope").data).toBe("nope")
    expect(normalizeLessonTags({ tags: "git" }).changes).toEqual([])
  })
})
