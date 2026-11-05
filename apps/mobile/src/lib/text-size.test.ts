import { describe, expect, it } from "vitest"

import { lessonTextVars, textScaleOf } from "./text-size"

describe("the learner's text size", () => {
  it("scales lesson text as the web's data-text-size does", () => {
    expect(textScaleOf("sm")).toBe(1)
    expect(textScaleOf(undefined)).toBe(1.125)
    expect(textScaleOf("lg")).toBe(1.25)
    // text-sm is 14, 15.75, and 17.5 at Small, Medium, and Large (the guidelines' numbers).
    expect(lessonTextVars("sm")["--lesson-sm"]).toBe("14px")
    expect(lessonTextVars("md")["--lesson-sm"]).toBe("15.75px")
    expect(lessonTextVars("lg")).toMatchObject({
      "--lesson-sm": "17.5px",
      "--lesson-sm-leading": "25px",
      "--lesson-sm-relaxed": "28.44px",
    })
  })
})
