import { spawnSync } from "node:child_process"
import { readdirSync, readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"

import { describe, expect, it } from "vitest"

import { LEVELS } from "@workspace/spec"

import { SKILL_VERSION } from "./cli"

// skills/learn is what people install. These tests fail when it's stale: run `npm run skill:build -w @workspace/cli`.

const root = new URL("../../../", import.meta.url)
const read = (p: string) => readFileSync(new URL(p, root), "utf8")
const script = fileURLToPath(new URL("skills/learn/scripts/learn.mjs", root))

describe("skills/learn", () => {
  it("has the current JSON Schema", () => {
    expect(read("skills/learn/schema/lesson.schema.json")).toBe(
      read("packages/spec/schema/lesson.schema.json")
    )
  })

  // Agents design each lesson from the guides; the example lessons stay in examples/ as fixtures and docs demos.
  it("ships no example lessons, and the guides don't point at any", () => {
    expect(readdirSync(new URL("skills/learn", root))).not.toContain("examples")
    for (const f of [
      "steps.md",
      "levels/index.md",
      ...LEVELS.map((l) => `levels/${l}.md`),
    ])
      expect(read(`skills/learn/${f}`), f).not.toMatch(/examples\//)
  })

  it("bundles the current CLI version", () => {
    const result = spawnSync(process.execPath, [script, "--version"], {
      encoding: "utf8",
    })
    expect(result.stdout.trim()).toBe(SKILL_VERSION)
  })

  // With no server to reach, `validate` falls back to the bundled rules: that's what this checks.
  it.each(
    readdirSync(new URL("examples", root)).filter((f) => f.endsWith(".json"))
  )("bundled script validates %s", (file) => {
    const result = spawnSync(
      process.execPath,
      [script, "validate", fileURLToPath(new URL(`examples/${file}`, root))],
      {
        encoding: "utf8",
        env: { ...process.env, LEARN_API_URL: "http://127.0.0.1:1" },
      }
    )
    expect(result.status, result.stderr).toBe(0)
    expect(result.stdout).toContain("Checked offline")
  })

  it("names the skill in SKILL.md", () => {
    expect(read("skills/learn/SKILL.md")).toMatch(
      /^---\nname: learn\ndescription: .+\n---/
    )
  })

  // The installed SKILL.md is a short bootstrap: the steps sync from learn.ninja, so it rarely changes.
  it("keeps SKILL.md short, and sends the agent to sync and steps.md", () => {
    const skill = read("skills/learn/SKILL.md")
    expect(skill.split(/\s+/).length).toBeLessThanOrEqual(220)
    expect(skill).toContain("scripts/learn.mjs sync")
    expect(skill).toContain("`.learn/skill/steps.md`")
    expect(skill, "guides are read from the synced copy").not.toMatch(
      /reference\/|levels\//
    )
  })
})

// Levels: one short file per level, read only when it applies.
const MAX_LEVEL_WORDS = 400

it("levels/ has index.md and exactly one file per level", () => {
  expect(readdirSync(new URL("skills/learn/levels", root)).sort()).toEqual(
    [...LEVELS.map((l) => `${l}.md`), "index.md"].sort()
  )
})

it("steps.md points at levels/index.md", () => {
  expect(read("skills/learn/steps.md")).toContain("`levels/index.md`")
})

describe.each(LEVELS)("level %s", (name) => {
  const guide = read(`skills/learn/levels/${name}.md`)

  it(`stays under ${MAX_LEVEL_WORDS} words`, () => {
    expect(guide.split(/\s+/).length).toBeLessThanOrEqual(MAX_LEVEL_WORDS)
  })

  it("ends with a drift check", () => {
    expect(guide).toContain("## You've drifted if")
  })

  it("is listed in levels/index.md, the format reference, and the docs", () => {
    expect(read("skills/learn/levels/index.md")).toContain(
      `\`levels/${name}.md\``
    )
    expect(
      read("skills/learn/reference/lesson-format.md").match(
        /^\| `level`.*$/m
      )?.[0]
    ).toContain(`\`${name}\``)
    expect(read("docs/lessons/levels.md")).toContain(`\`${name}\``)
  })
})

it("steps.md points at reference/planning.md", () => {
  expect(read("skills/learn/steps.md")).toContain("`reference/planning.md`")
})
