import { describe, expect, it } from "vitest"

import { createAnswerMarks, revealBy, type Measurable } from "./answer-marks"

const view = (y: number, height: number): Measurable => ({
  measureInWindow: (cb) => cb(0, y, 100, height),
})

describe("answer marks", () => {
  it("finds the lowest marked answer, and forgets one taken off", async () => {
    const marks = createAnswerMarks()
    marks.register(view(100, 40))
    const off = marks.register(view(500, 40))
    marks.register(view(300, 0)) // not laid out
    expect(await marks.lowest()).toEqual({ top: 500, bottom: 540 })
    off()
    expect(await marks.lowest()).toEqual({ top: 100, bottom: 140 })
  })

  it("has nothing to show with nothing marked", async () => {
    expect(await createAnswerMarks().lowest()).toBeNull()
  })

  it("scrolls a covered answer clear of the tray, never past its own top", () => {
    const window = { top: 100, height: 400 } // the tray starts at 500
    expect(revealBy({ top: 300, bottom: 350 }, window)).toBe(0)
    expect(revealBy({ top: 480, bottom: 530 }, window)).toBe(42)
    // Taller than the room left: its top stops at the window's.
    expect(revealBy({ top: 200, bottom: 900 }, window)).toBe(100)
  })
})
