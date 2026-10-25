import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import { PlayerProvider } from "./context"
import { emptyPrepared } from "./prepared"
import { MarkText } from "./marks"
import { stringsFor } from "./strings"

// Checked answers are marked by color and an icon; screen readers get the same result as words.

function render(mark: Parameters<typeof MarkText>[0]["mark"], lang = "en") {
  return renderToStaticMarkup(
    createElement(
      PlayerProvider,
      {
        value: {
          prepared: emptyPrepared,
          t: stringsFor(lang),
          dir: "ltr",
          visualsCss: "/lesson-visuals.css",
        },
      },
      createElement(MarkText, { mark })
    )
  )
}

describe("marks as words", () => {
  it("says each result, hidden from sight", () => {
    expect(render("correct")).toBe('<span class="sr-only">, correct</span>')
    expect(render("wrong")).toContain("not right")
    expect(render("partial")).toContain("partly right")
  })

  it("says nothing for an unmarked answer", () => {
    expect(render(undefined)).toBe("")
  })

  it("speaks the player's language", () => {
    expect(render("correct", "es")).toContain("correcto")
    expect(render("wrong", "ar")).toContain("غير صحيح")
  })
})
