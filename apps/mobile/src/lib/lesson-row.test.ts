import { describe, expect, it } from "vitest"

import type { LessonRowData } from "./feed"
import { compact, rowBadge, rowTime, wedge } from "./lesson-row"

const row = (over: Partial<LessonRowData> = {}): LessonRowData => ({
  id: "abc",
  slug: "buttons",
  title: "Buttons",
  summary: "",
  level: "beginner",
  minutes: 8,
  language: "en",
  author: { id: "ada", handle: "ada", name: "Ada", image: null },
  views: 0,
  likes: 0,
  visibility: "public",
  hidden: false,
  createdAt: 0,
  expiresAt: null,
  ...over,
})
const viewer = (completed: Record<string, number> = {}) => ({
  signedIn: true,
  liked: [],
  completed,
})

describe("a lesson's row", () => {
  it("shows the length, then Done once finished", () => {
    expect(rowTime(row(), viewer(), null)).toEqual({
      kind: "length",
      minutes: 8,
    })
    expect(rowTime(row(), viewer({ abc: 5 }), null)).toEqual({
      kind: "done",
      at: 5,
    })
  })

  it("shows the minutes left while partway, the device's progress over the account's", () => {
    const partway = row({ progress: { done: 1, total: 4 } })
    expect(rowTime(partway, viewer({ abc: 5 }), null)).toMatchObject({
      kind: "left",
      minutes: 6,
      done: 1,
    })
    expect(rowTime(partway, viewer(), { done: 3, total: 4 })).toMatchObject({
      kind: "left",
      minutes: 2,
      share: 0.75,
    })
    expect(rowTime(row(), viewer(), { done: 4, total: 4 })).toMatchObject({
      minutes: 1,
    })
  })

  it("badges the viewer's own unlisted and hidden lessons only", () => {
    expect(rowBadge(row({ visibility: "unlisted" }), "ada")).toBe("private")
    expect(rowBadge(row({ hidden: true }), "ada")).toBe("hidden")
    expect(rowBadge(row({ visibility: "unlisted" }), "bob")).toBeNull()
    expect(rowBadge(row(), "ada")).toBeNull()
  })

  it("counts compactly and draws the pie", () => {
    expect(compact(1234, "en")).toBe("1.2K")
    expect(wedge(0)).toBe("")
    expect(wedge(0.25)).toBe("M12 12V7A5 5 0 0 1 17.00 12.00Z")
  })
})
