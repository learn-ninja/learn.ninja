import { readdirSync } from "node:fs"

import { describe, expect, it } from "vitest"

import { bundledLessonList, LESSON_SLUGS } from "./lessons"

describe("bundled lessons", () => {
  it("lists every example lesson with its own title and summary", () => {
    const files = readdirSync(new URL("../../../examples", import.meta.url))
      .filter((f) => f.endsWith(".json"))
      .map((f) => f.replace(/\.json$/, ""))
    expect([...LESSON_SLUGS].sort()).toEqual(files.sort())
    const list = bundledLessonList()
    expect(list.map((l) => l.slug)).toEqual(LESSON_SLUGS)
    for (const l of list) {
      expect(l.title).toBeTruthy()
      expect(l.summary).toBeTruthy()
    }
  })
})
