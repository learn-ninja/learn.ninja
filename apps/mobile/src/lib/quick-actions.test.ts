import { describe, expect, it, vi } from "vitest"

import { stringsFor } from "@workspace/player-core/strings"

vi.mock("expo-quick-actions", () => ({}))
vi.mock("expo-quick-actions/router", () => ({}))
vi.mock("expo-sqlite/kv-store", () => ({ Storage: {} }))
vi.mock("./use-strings", () => ({}))
vi.mock("./widget", () => ({ refreshWidget: () => {} }))
vi.mock("./session", () => ({}))

import { quickActionItems } from "./quick-actions"

const t = stringsFor("en")

describe("quickActionItems", () => {
  it("offers Explore and Profile without a lesson to continue", () => {
    expect(quickActionItems(t, null, true).map((a) => a.id)).toEqual([
      "explore",
      "profile",
    ])
  })
  it("offers only Explore when logged out: there's no profile tab", () => {
    expect(quickActionItems(t, null, false).map((a) => a.id)).toEqual([
      "explore",
    ])
  })
  it("puts Continue first, with the lesson's title and route", () => {
    const [first] = quickActionItems(
      t,
      { href: "/l/abc", title: "Gravity" },
      true
    )
    expect(first).toMatchObject({
      id: "continue",
      subtitle: "Gravity",
      params: { href: "/l/abc" },
    })
  })
})
