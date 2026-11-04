import { describe, expect, it } from "vitest"

import { changesPrompt } from "./creator"
import { stringsFor } from "@workspace/player-core/strings"

// The prompt Make changes copies for the maker to paste into their chat.

const t = stringsFor("en")
const url = "https://learn.ninja/l/buttons-k3x9a2mq"

describe("changesPrompt", () => {
  it("lists a new level first, then the ticked changes, then the maker's own words", () => {
    const text = changesPrompt(
      t,
      url,
      ["shorter", "visual"],
      " The second question is confusing. ",
      "advanced"
    )
    expect(text.split("\n").slice(4)).toEqual([
      "- Change the level to Advanced",
      "- Make it more visual",
      "- Make it shorter",
      "- The second question is confusing.",
    ])
  })

  it("is empty when nothing changes", () => {
    expect(changesPrompt(t, url, [], "  ")).toBe("")
  })
})
