import { readFileSync } from "node:fs"

import { describe, expect, it } from "vitest"

import { validateLesson } from "@workspace/spec"

import { visualClasses, visualsCssFor } from "./visual-css"
import { VISUAL_THEME } from "./visual-theme"

const squash = (s: string) => s.replace(/\s+/g, " ").trim()

describe("visuals CSS", () => {
  it("keeps the theme mapping in sync with packages/ui globals.css", () => {
    const globals = readFileSync(
      new URL("../../ui/src/styles/globals.css", import.meta.url),
      "utf8"
    )
    const block = globals.match(/@theme inline \{[\s\S]*?\n\}/)?.[0]
    expect(squash(VISUAL_THEME)).toBe(squash(block ?? ""))
  })

  it("collects the classes a lesson's HTML uses", () => {
    const raw = readFileSync(
      new URL("../../../examples/button-hierarchy.json", import.meta.url),
      "utf8"
    )
    const result = validateLesson(raw)
    if (!result.ok) throw new Error("invalid example")
    expect(visualClasses(result.lesson).sort()).toEqual([
      "btn",
      "flex",
      "flex-wrap",
      "gap-2",
    ])
  })

  it("compiles only the utilities used, resolving theme colors", async () => {
    const css = await visualsCssFor([
      "flex",
      "gap-2",
      "bg-primary",
      "not-a-real-class",
    ])
    expect(css).toContain(".flex")
    expect(css).toContain(".gap-2")
    expect(css).toMatch(
      /\.bg-primary\s*\{\s*background-color: var\(--primary\)/
    )
    expect(css).not.toContain("not-a-real-class")
    expect(css).not.toContain(".grid")
  })

  it("draws icon classes before the utilities, so sizes can override", async () => {
    const css = await visualsCssFor([
      "icon-[lucide--git-branch]",
      "icon-[lucide--not-an-icon]",
      "size-6",
    ])
    expect(
      css.startsWith("@layer components{.icon-\\[lucide--git-branch\\]{")
    ).toBe(true)
    expect(css).toContain("mask-image")
    expect(css).toMatch(/@layer utilities\s*\{[\s\S]*\.size-6/)
    expect(css).not.toContain("not-an-icon")
  })

  it("follows the player's dark class, not the OS setting", async () => {
    const css = await visualsCssFor(["dark:bg-muted"])
    expect(css).toContain(".dark")
    expect(css).not.toContain("prefers-color-scheme")
  })

  it("returns nothing when there are no classes", async () => {
    expect(await visualsCssFor([])).toBe("")
  })
})
