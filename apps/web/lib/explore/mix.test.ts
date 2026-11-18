import { describe, expect, it } from "vitest"

import { mixSubjects } from "./mix"

const list = (subjects: string) =>
  subjects.split(" ").map((subject, i) => ({ id: i, subject }))
const ids = (lessons: { id: number }[]) => lessons.map((l) => l.id)

describe("mixSubjects", () => {
  it("keeps at most two lessons per subject, newest first", () => {
    const lessons = list(
      "programming programming programming programming health languages money programming history"
    )
    expect(ids(mixSubjects(lessons, 6))).toEqual([0, 1, 4, 5, 6, 8])
  })

  it("tops up with skipped lessons when there aren't enough subjects", () => {
    const lessons = list("programming programming programming programming health")
    expect(ids(mixSubjects(lessons, 4))).toEqual([0, 1, 2, 4])
  })

  it("returns a short list as it is", () => {
    const lessons = list("programming programming programming")
    expect(mixSubjects(lessons, 10)).toEqual(lessons)
  })
})
