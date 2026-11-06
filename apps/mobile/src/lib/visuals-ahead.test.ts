import { describe, expect, it } from "vitest"

import type { Item } from "@workspace/player-core/flow"

import { visualsAhead } from "./visuals-ahead"

// Which of a screen's visuals the player measures ahead, and at which widths (a 402-point phone).

const html = (h: string, height?: number) => ({
  kind: "html" as const,
  html: h,
  ...(height ? { height } : {}),
})

const question = (kata: unknown) =>
  ({ kind: "question", kata, role: "practice" }) as Item

describe("visualsAhead", () => {
  it("measures a concept's visual at the frame's width", () => {
    const item = {
      kind: "concept",
      kata: {
        type: "concept",
        title: "T",
        body: "B",
        visual: html("<p>a</p>"),
      },
    } as Item
    expect(visualsAhead(item, 402)).toEqual([
      {
        html: "<p>a</p>",
        css: undefined,
        height: undefined,
        width: 368,
        spots: false,
      },
    ])
  })

  it("skips a visual with its own height, and the screens without visuals", () => {
    const item = {
      kind: "concept",
      kata: {
        type: "concept",
        title: "T",
        body: "B",
        visual: html("<p>a</p>", 200),
      },
    } as Item
    expect(visualsAhead(item, 402)).toEqual([])
    expect(visualsAhead({ kind: "wrap" }, 402)).toEqual([])
    expect(visualsAhead(undefined, 402)).toEqual([])
  })

  it("measures option cards at every width they can take", () => {
    const item = question({
      type: "choice",
      prompt: "P",
      options: ["a", "b", "c"].map((id) => ({ id, visual: html(id) })),
    })
    expect(visualsAhead(item, 402).map((v) => [v.html, v.width])).toEqual([
      ["a", 169],
      ["a", 360],
      ["b", 169],
      ["b", 360],
      ["c", 169],
      ["c", 360],
    ])
  })

  it("measures order items at their one width", () => {
    const item = question({
      type: "order",
      prompt: "P",
      items: [
        { id: "a", visual: html("a") },
        { id: "b", text: "B" },
      ],
    })
    expect(visualsAhead(item, 402).map((v) => [v.html, v.width])).toEqual([
      ["a", 163],
    ])
  })

  it("measures a hotspot's parts at the stage's width, even with its own height", () => {
    const item = question({
      type: "hotspot",
      prompt: "P",
      visual: html("<b data-hotspot='x'>x</b>", 300),
    })
    expect(visualsAhead(item, 402)).toEqual([
      {
        html: "<b data-hotspot='x'>x</b>",
        css: undefined,
        height: 300,
        width: 370,
        spots: true,
      },
    ])
  })
})
