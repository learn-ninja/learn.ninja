import { describe, expect, it } from "vitest"

import type { QuestionKata } from "@workspace/spec"

import { initials, scenarioTurns } from "./chat"

const kata: QuestionKata = {
  id: "ch",
  type: "scenario",
  prompt: "What do you say?",
  situation: "A colleague has a study.",
  visual: {
    kind: "chat",
    alt: "Priya asks about a coffee study.",
    turns: [{ who: "Priya", text: "Can we say coffee extends life?" }],
  },
  options: [
    { id: "a", quality: "best", text: "Who are the non-drinkers?", outcome: "Good point." },
    { id: "b", quality: "poor", text: "Go for it.", outcome: "Drafting it now." },
  ],
  explanation: "Confounding.",
}

describe("scenarioTurns", () => {
  it("adds nothing until the answer is checked", () => {
    expect(
      scenarioTurns(kata, { kind: "select", ids: ["b"] }, "answering")
    ).toEqual([])
  })

  it("adds the pick as the learner's line and its outcome as the other person's reply", () => {
    expect(
      scenarioTurns(kata, { kind: "select", ids: ["b"] }, "feedback")
    ).toEqual([
      { text: "Go for it.", added: "pick" },
      { who: "Priya", text: "Drafting it now.", added: "reply" },
    ])
  })

  it("plays the best path once the answer is revealed", () => {
    expect(
      scenarioTurns(kata, { kind: "select", ids: ["b"] }, "revealed")
    ).toEqual([
      { text: "Who are the non-drinkers?", added: "pick" },
      { who: "Priya", text: "Good point.", added: "reply" },
    ])
  })

  it("leaves other katas and visuals alone", () => {
    const plain = { ...kata, visual: undefined }
    expect(
      scenarioTurns(plain, { kind: "select", ids: ["a"] }, "feedback")
    ).toEqual([])
  })
})

describe("initials", () => {
  it("takes the first letter of the first two words, in capitals", () => {
    expect(initials("Priya")).toBe("P")
    expect(initials("ana maría lópez")).toBe("AM")
    expect(initials("  Dr. Chen ")).toBe("DC")
  })
})
