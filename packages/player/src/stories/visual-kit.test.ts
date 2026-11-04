import { readFileSync } from "node:fs"

import { describe, expect, it } from "vitest"

import { validateLesson } from "@workspace/spec"

import { chartSamples } from "./visual-kit"

// The hand-written chart samples skip the publish checks (prepare-examples.ts draws them directly),
// so check each one here the way a lesson's chart is checked: as a concept kata's visual.
const lesson = JSON.parse(
  readFileSync(
    new URL("../../../../examples/bronze-age-collapse.json", import.meta.url),
    "utf8"
  )
)
const at = lesson.katas.findIndex((k: { type: string }) => k.type === "concept")

describe("chartSamples", () => {
  it.each(chartSamples)("$name passes the chart checks", ({ chart }) => {
    const withSample = structuredClone(lesson)
    withSample.katas[at].visual = chart
    const result = validateLesson(withSample)
    const issues = result.ok
      ? []
      : result.issues.filter((i) => i.path.startsWith(`katas[${at}]`))
    expect(issues).toEqual([])
  })
})
