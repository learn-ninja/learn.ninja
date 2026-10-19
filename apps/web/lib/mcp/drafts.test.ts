import { describe, expect, it } from "vitest"

import { applyPatches, parsePath, PatchError } from "./drafts"

describe("parsePath", () => {
  it("reads the checker's path syntax", () => {
    expect(parsePath("bricks[2].options[0].feedback")).toEqual([
      "bricks",
      2,
      "options",
      0,
      "feedback",
    ])
    expect(parsePath("title")).toEqual(["title"])
  })

  it("refuses malformed and prototype paths", () => {
    for (const bad of [
      "",
      "a..b",
      "a]b",
      "a[x]",
      "__proto__.x",
      "a.constructor",
    ])
      expect(() => parsePath(bad), bad).toThrow(PatchError)
  })
})

describe("applyPatches", () => {
  const lesson = { title: "A", bricks: [{ id: 1 }, { id: 2 }] }

  it("sets, inserts, and removes without touching the original", () => {
    const out = applyPatches(lesson, [
      { op: "set", path: "title", value: "B" },
      { op: "set", path: "bricks[0].body", value: "hi" },
      { op: "insert", path: "bricks[1]", value: { id: 9 } },
      { op: "remove", path: "bricks[2]" },
      { op: "set", path: "bricks[2]", value: { id: 3 } },
    ])
    expect(out).toEqual({
      title: "B",
      bricks: [{ id: 1, body: "hi" }, { id: 9 }, { id: 3 }],
    })
    expect(lesson).toEqual({ title: "A", bricks: [{ id: 1 }, { id: 2 }] })
  })

  it("names the patch that doesn't fit", () => {
    expect(() =>
      applyPatches(lesson, [
        { op: "set", path: "title", value: "B" },
        { op: "remove", path: "bricks[5]" },
      ])
    ).toThrow(/Patch 2 \(bricks\[5\]\)/)
    expect(() =>
      applyPatches(lesson, [{ op: "set", path: "missing.x", value: 1 }])
    ).toThrow(PatchError)
    expect(() =>
      applyPatches(lesson, [{ op: "insert", path: "title", value: 1 }])
    ).toThrow(/arrays/)
  })
})
