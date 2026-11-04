import { describe, expect, it } from "vitest"

import { shareLink } from "./share"

describe("shareLink", () => {
  it("is the lesson's web page with the score, as the web's challenge link", () => {
    expect(shareLink("https://learn.ninja", "/l/tides-ab12cd", 4, 5)).toBe(
      "https://learn.ninja/l/tides-ab12cd?c=4-5"
    )
  })

  it("leaves any query or fragment off, and joins the base cleanly", () => {
    expect(shareLink("https://learn.ninja/", "/l/x-1?ui=ar#top", 0, 3)).toBe(
      "https://learn.ninja/l/x-1?c=0-3"
    )
    expect(shareLink("http://localhost:3000", "lessons/tides", 2, 2)).toBe(
      "http://localhost:3000/lessons/tides?c=2-2"
    )
  })
})
