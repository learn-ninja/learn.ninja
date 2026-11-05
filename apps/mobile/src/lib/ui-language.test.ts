import { describe, expect, it } from "vitest"

import { appUiLanguage, isRtl, lessonUiLanguage } from "./ui-language"

describe("the app's language", () => {
  it("follows the learner's choice, else the lesson's language inside a lesson", () => {
    expect(lessonUiLanguage({}, "ar")).toBe("ar")
    expect(lessonUiLanguage({ uiLanguage: "ja" }, "ar")).toBe("ja")
    expect(lessonUiLanguage({ uiLanguage: "xx" }, "ar")).toBe("ar")
  })

  it("follows the choice, else the device's first language the player has, outside a lesson", () => {
    expect(appUiLanguage({}, ["gd-GB", "he-IL", "en-US"])).toBe("he")
    expect(appUiLanguage({}, ["zh-Hant-TW"])).toBe("zh-tw")
    expect(appUiLanguage({}, [])).toBe("en")
    expect(appUiLanguage({ uiLanguage: "fr" }, ["he-IL"])).toBe("fr")
  })

  it("runs Arabic and Hebrew right to left", () => {
    expect(isRtl("ar")).toBe(true)
    expect(isRtl("he")).toBe(true)
    expect(isRtl("ja")).toBe(false)
  })
})
