import { describe, expect, it } from "vitest"

import { firstSteps, stepCount, textBlocks } from "./text"

describe("textBlocks", () => {
  it("makes each line a paragraph", () => {
    expect(textBlocks("One.\nTwo.\n\nThree.")).toEqual([
      { kind: "paragraph", text: "One." },
      { kind: "paragraph", text: "Two." },
      { kind: "paragraph", text: "Three." },
    ])
  })

  it("groups bullet lines into a list, across blank lines", () => {
    expect(
      textBlocks("Openings:\n- **Italian**\n\n* Sicilian\nThat's all.")
    ).toEqual([
      { kind: "paragraph", text: "Openings:" },
      {
        kind: "list",
        ordered: false,
        start: 1,
        items: ["**Italian**", "Sicilian"],
      },
      { kind: "paragraph", text: "That's all." },
    ])
  })

  it("numbers a list that counts up, from where it starts", () => {
    expect(textBlocks("3. Third\n4. Fourth")).toEqual([
      { kind: "list", ordered: true, start: 3, items: ["Third", "Fourth"] },
    ])
  })

  it("keeps lone marker lines and broken counts as text", () => {
    expect(textBlocks("1. e4 e5 2. Nf3")).toEqual([
      { kind: "paragraph", text: "1. e4 e5 2. Nf3" },
    ])
    expect(textBlocks("1. One\n3. Three")).toEqual([
      { kind: "paragraph", text: "1. One" },
      { kind: "paragraph", text: "3. Three" },
    ])
  })

  it("doesn't take italic or a minus sign for a bullet", () => {
    expect(textBlocks("*Italic* start\n-5 degrees")).toEqual([
      { kind: "paragraph", text: "*Italic* start" },
      { kind: "paragraph", text: "-5 degrees" },
    ])
  })
})

describe("steps", () => {
  const body = "Start with $1,000.\n1. Year 1: $1,050\n2. Year 2: $1,102.50\nIt speeds up."

  it("counts a step for each paragraph and each list item", () => {
    expect(stepCount(body)).toBe(4)
    expect(stepCount("One line.")).toBe(1)
  })

  it("shows the first steps, a list as far as it has got", () => {
    const blocks = textBlocks(body)
    expect(firstSteps(blocks, 1)).toEqual([blocks[0]])
    expect(firstSteps(blocks, 2)).toEqual([
      blocks[0],
      { kind: "list", ordered: true, start: 1, items: ["Year 1: $1,050"] },
    ])
    expect(firstSteps(blocks, 3)).toEqual(blocks.slice(0, 2))
    expect(firstSteps(blocks, 9)).toEqual(blocks)
  })
})
