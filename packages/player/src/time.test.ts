import { describe, expect, it } from "vitest"

import { shortTimeAgo, timeAgo } from "./time"
import { UI_LANGUAGES } from "./strings"

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR
const NOW = Date.UTC(2026, 9, 20, 11, 17)

describe("timeAgo", () => {
  it.each([
    [0, "just now"],
    [30_000, "just now"],
    [-5 * MINUTE, "just now"],
    [MINUTE, "1 minute ago"],
    [5 * MINUTE, "5 minutes ago"],
    [59 * MINUTE, "59 minutes ago"],
    [HOUR, "1 hour ago"],
    [3 * HOUR, "3 hours ago"],
    [23 * HOUR, "23 hours ago"],
    [DAY, "yesterday"],
    [4 * DAY, "4 days ago"],
    [7 * DAY, "last week"],
    [2 * 7 * DAY, "2 weeks ago"],
    [30 * DAY, "last month"],
    [3 * 30 * DAY, "3 months ago"],
    [365 * DAY, "last year"],
    [2 * 365 * DAY, "2 years ago"],
  ])("%d ms ago in English is %s", (age, text) => {
    expect(timeAgo(NOW - age, NOW, "en")).toBe(text)
  })

  it("speaks the player's other languages", () => {
    expect(timeAgo(NOW - 5 * MINUTE, NOW, "ar")).toBe("قبل 5 دقائق")
    expect(timeAgo(NOW - DAY, NOW, "de")).toBe("gestern")
    expect(timeAgo(NOW, NOW, "ja")).toBe("たった今")
  })

  it("has words for every player language", () => {
    for (const { code } of UI_LANGUAGES) {
      expect(timeAgo(NOW, NOW, code)).toMatch(/\S/)
      expect(timeAgo(NOW - 3 * HOUR, NOW, code)).toMatch(/\S/)
    }
  })
})

describe("shortTimeAgo", () => {
  it.each([
    [0, "just now"],
    [MINUTE, "1m"],
    [33 * MINUTE, "33m"],
    [3 * HOUR, "3h"],
    [23 * HOUR, "23h"],
    [DAY, "1d"],
    [6 * DAY, "6d"],
    [7 * DAY, "Oct 13"],
    [30 * DAY, "Sep 20"],
    [365 * DAY, "Oct 20, 2025"],
  ])("%d ms ago in English is %s", (age, text) => {
    expect(shortTimeAgo(NOW - age, NOW, "en")).toBe(text)
  })

  it("has words for every player language", () => {
    for (const { code } of UI_LANGUAGES) {
      expect(shortTimeAgo(NOW - 3 * HOUR, NOW, code)).toMatch(/\S/)
      expect(shortTimeAgo(NOW - 30 * DAY, NOW, code)).toMatch(/\S/)
    }
  })
})
