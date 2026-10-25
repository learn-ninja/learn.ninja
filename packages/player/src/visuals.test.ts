import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import { centeredViewBox, Visual, VISUAL_SANDBOX } from "./visuals"

// The HTML visual's frame is the only place lesson content touches the page, so its shape is pinned here.

const decode = (s: string) =>
  s
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#x27;/g, "'")
    .replace(/&amp;/g, "&")

function frameFor(visual: { html: string; alt?: string; css?: string }) {
  const markup = renderToStaticMarkup(
    createElement(Visual, { visual: { kind: "html", ...visual } })
  )
  // React's server renderer keeps the prop's casing (srcDoc).
  const srcdoc = /srcdoc="([^"]*)"/i.exec(markup)?.[1]
  return { markup, srcdoc: srcdoc === undefined ? undefined : decode(srcdoc) }
}

describe("HTML visual frame", () => {
  it("is sandboxed without scripts", () => {
    const { markup } = frameFor({ html: "<b>Hi</b>" })
    expect(VISUAL_SANDBOX).toBe("allow-same-origin")
    expect(markup).toContain(`sandbox="${VISUAL_SANDBOX}"`)
    expect(markup).not.toContain("allow-scripts")
  })

  it("reads as an image named by its alt text", () => {
    const { markup } = frameFor({ html: "<b>Hi</b>", alt: "A bold hi." })
    expect(markup).toContain('role="img"')
    expect(markup).toContain('aria-label="A bold hi."')
    expect(markup).toContain('title="A bold hi."')
    // Inert would take the image out of the accessibility tree along with the frame.
    const stage = /<div[^>]*role="img"[^>]*>/.exec(markup)?.[0]
    expect(stage).toBeDefined()
    expect(stage).not.toContain("inert")
  })

  it("keeps the lesson's CSS inside its style tag", () => {
    const css = `b{color:red}</style><meta http-equiv="refresh" content="0;url=https://evil.example">`
    const { srcdoc } = frameFor({ html: "<b>Hi</b>", css })
    expect(srcdoc).toBeDefined()
    expect(srcdoc).not.toContain('</style><meta http-equiv="refresh"')
    expect(srcdoc).toContain('<\\/style><meta http-equiv="refresh"')
    // The body is still the lesson's HTML, and the document still closes properly.
    expect(srcdoc).toContain("<body><b>Hi</b></body></html>")
  })
})

describe("centeredViewBox", () => {
  const view = { x: 0, y: 0, width: 400, height: 300 }

  it("moves a drawing that sits low in its canvas to the middle", () => {
    expect(
      centeredViewBox(view, { x: 100, y: 120, width: 200, height: 160 })
    ).toBe("0 50 400 300")
  })

  it("leaves a centered, empty, or oversized drawing alone", () => {
    expect(
      centeredViewBox(view, { x: 100, y: 70, width: 200, height: 160 })
    ).toBeNull()
    expect(
      centeredViewBox(view, { x: 0, y: 0, width: 0, height: 0 })
    ).toBeNull()
    expect(
      centeredViewBox(view, { x: -20, y: 0, width: 440, height: 100 })
    ).toBeNull()
  })
})

describe("chess and map visuals", () => {
  const hotspots = (selected: string[]) => ({
    selected,
    marks: {},
    onToggle: () => {},
    disabled: false,
  })
  const render = (
    visual: Parameters<typeof Visual>[0]["visual"],
    selected?: string[]
  ) =>
    renderToStaticMarkup(
      createElement(Visual, {
        visual,
        hotspots: selected ? hotspots(selected) : undefined,
      })
    )
  const board = {
    kind: "chess" as const,
    fen: "8/8/8/8/4P3/8/8/8",
    alt: "A pawn on e4.",
  }
  const map = {
    kind: "map" as const,
    region: "europe" as const,
    alt: "Western Europe.",
    countries: [{ code: "FR" }],
  }

  it("read as an image named by the alt, or on a hotspot as a group", () => {
    for (const visual of [board, map]) {
      expect(render(visual)).toContain('role="img"')
      expect(render(visual)).toContain(`aria-label="${visual.alt}"`)
      expect(render(visual, [])).toContain('role="group"')
      expect(render(visual, [])).toContain('aria-live="polite"')
    }
  })

  it("name what's picked on a hotspot: squares as they are, countries by name", () => {
    expect(render(board, ["e4", "d5"])).toContain("Picked: e4, d5")
    expect(render(map, ["FR", "DE"])).toContain("Picked: France, Germany")
  })
})
