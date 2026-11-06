import { describe, expect, it } from "vitest"

import { stringsFor } from "@workspace/player-core/strings"

import { markWord } from "./mark-words"

describe("markWord", () => {
  it("says a mark in the player's words, and nothing before a check", () => {
    const t = stringsFor("en")
    expect(markWord(t, "correct")).toBe("correct")
    expect(markWord(t, "wrong")).toBe("not right")
    expect(markWord(t, "partial")).toBe("partly right")
    expect(markWord(t, undefined)).toBeUndefined()
  })
})
