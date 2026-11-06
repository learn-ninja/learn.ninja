import { describe, expect, it, vi } from "vitest"

vi.mock("expo-store-review", () => ({}))
vi.mock("expo-sqlite/kv-store", () => ({ Storage: {} }))

import { shouldAskForReview } from "./review"

describe("shouldAskForReview", () => {
  it("asks on a milestone day not asked at yet", () => {
    expect(shouldAskForReview(7, [])).toBe(true)
    expect(shouldAskForReview(30, [7])).toBe(true)
  })
  it("stays quiet on other days and on milestones already asked at", () => {
    expect(shouldAskForReview(6, [])).toBe(false)
    expect(shouldAskForReview(8, [])).toBe(false)
    expect(shouldAskForReview(7, [7])).toBe(false)
  })
})
