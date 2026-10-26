import { describe, expect, it } from "vitest"

import {
  challengeFor,
  challengeLink,
  challengeResult,
  parseChallenge,
} from "./challenge"

const URL_ = "https://learn.ninja/l/how-a-website-keeps-you-logged-in-ab12cd34"

describe("challenge links", () => {
  it("carries the score and the sender, without the page's own query", () => {
    expect(challengeLink(`${URL_}?ui=ar&c=1-5#top`, 4, 5, "colin")).toBe(
      `${URL_}?c=4-5&by=colin`
    )
    expect(challengeLink(URL_, 5, 5)).toBe(`${URL_}?c=5-5`)
  })

  it("reads back what it wrote", () => {
    const link = new URL(challengeLink(URL_, 3, 5, "quiet-kitsune-7"))
    expect(
      parseChallenge(link.searchParams.get("c"), link.searchParams.get("by"))
    ).toEqual({ first: 3, total: 5, by: "quiet-kitsune-7" })
  })

  it("drops anything malformed", () => {
    expect(parseChallenge(undefined, undefined)).toBeUndefined()
    expect(parseChallenge("6-5", null)).toBeUndefined()
    expect(parseChallenge("0-0", null)).toBeUndefined()
    expect(parseChallenge("4/5", null)).toBeUndefined()
    expect(parseChallenge("400-500", null)).toBeUndefined()
    // A score without a believable handle keeps the score only.
    expect(parseChallenge("4-5", "Not A Handle!")).toEqual({
      first: 4,
      total: 5,
    })
  })

  it("applies only while the lesson has as many questions", () => {
    const c = { first: 4, total: 5 }
    expect(challengeFor(c, 5)).toBe(c)
    expect(challengeFor(c, 6)).toBeUndefined()
  })

  it("compares first tries", () => {
    const c = { first: 3, total: 5 }
    expect(challengeResult(4, c)).toBe("won")
    expect(challengeResult(3, c)).toBe("tied")
    expect(challengeResult(2, c)).toBe("lost")
  })
})
