import { describe, expect, it } from "vitest"

import { parseChallenge } from "@workspace/player-core/challenge"
import { stringsFor } from "@workspace/player-core/strings"

import {
  challengeNote,
  challengeVerdict,
  isolateHandles,
} from "./challenge-text"

const t = stringsFor("en")

describe("a friend's challenge", () => {
  it("reads the link's score and handle, and drops anything malformed", () => {
    expect(parseChallenge("3-5", "ada")).toEqual({
      first: 3,
      total: 5,
      by: "ada",
    })
    expect(parseChallenge("3-5", "<script>")).toEqual({ first: 3, total: 5 })
    expect(parseChallenge("6-5", "ada")).toBeUndefined()
    expect(parseChallenge(undefined, undefined)).toBeUndefined()
  })

  it("says the score to beat, and who won", () => {
    const challenge = { first: 3, total: 5, by: "ada" }
    expect(challengeNote(challenge, t)).toBe(
      "⁦@ada⁩ got 3 of 5. Can you beat it?"
    )
    expect(challengeVerdict(4, challenge, t)).toEqual({
      won: true,
      text: "You beat ⁦@ada⁩, 4 to 3",
    })
    expect(challengeVerdict(3, challenge, t).won).toBe(false)
    expect(challengeVerdict(2, { first: 3, total: 5 }, t).text).toBe(
      "Your friend wins this one, 3 to 2"
    )
  })

  it("keeps handles left to right", () => {
    expect(isolateHandles("@a-b x")).toBe("⁦@a-b⁩ x")
  })
})
