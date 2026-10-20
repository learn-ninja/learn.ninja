import { describe, expect, it } from "vitest"

import { exampleFiles, readExample } from "./test-helpers"
import { formatIssues, validateLesson } from "./validate"

describe("example lessons", () => {
  const files = exampleFiles()

  it("includes all seven test lessons", () => {
    expect(files).toEqual([
      "bronze-age-collapse.json",
      "button-hierarchy.json",
      "compound-interest.json",
      "correlation-vs-causation.json",
      "map-vs-foreach.json",
      "spanish-greetings.json",
      "writing-a-prd.json",
    ])
  })

  it.each(files)("%s is a valid v0.6 lesson", (file) => {
    const result = validateLesson(readExample(file))
    if (!result.ok)
      throw new Error(`${file} has issues:\n${formatIssues(result.issues)}`)
    expect(result.ok).toBe(true)
  })
})
