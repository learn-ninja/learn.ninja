import { describe, expect, it } from "vitest"

import { en } from "./locales/en"
import {
  ariaLocaleFor,
  loadLanguage,
  stringsFor,
  UI_LANGUAGES,
  uiLanguageFor,
} from "./strings"

// Every language the menu offers has every string, and the counted ones render for any number.

const codes = UI_LANGUAGES.map((l) => l.code)

function leaves(value: unknown, path = ""): [string, unknown][] {
  if (typeof value !== "object" || value === null || Array.isArray(value))
    return [[path, value]]
  return Object.entries(value).flatMap(([k, v]) =>
    leaves(v, path ? `${path}.${k}` : k)
  )
}

describe("locales", () => {
  it.each(codes)("%s has every string, none empty", async (code) => {
    const expected = leaves(en).map(([k]) => k)
    const actual = Object.fromEntries(
      leaves((await loadLanguage(code)).strings)
    )
    expect(Object.keys(actual).sort()).toEqual([...expected].sort())
    for (const [key, value] of Object.entries(actual)) {
      if (typeof value === "function") {
        for (const n of [0, 1, 2, 3, 5, 11, 21, 100]) {
          const out = (value as (...a: number[]) => string)(n, 7)
          expect(out, `${code} ${key}(${n})`).toMatch(/\S/)
          expect(out, `${code} ${key}(${n}) keeps the number`).not.toContain(
            "#"
          )
        }
      } else {
        for (const text of Array.isArray(value) ? value : [value])
          expect(text, `${code} ${key}`).toMatch(/\S/)
      }
    }
  })

  it("loads each language once, as its own pack", async () => {
    const pack = await loadLanguage("de-AT")
    expect(await loadLanguage("de")).toBe(pack)
    expect(pack.strings.start).toBe("Lektion starten")
    expect(stringsFor("de")).toBe(pack.strings)
    expect((await loadLanguage("en")).strings).toBe(en)
  })

  it("resolves regional and script variants", () => {
    expect(uiLanguageFor("pt-BR")?.code).toBe("pt")
    expect(uiLanguageFor("zh-Hant-TW")?.code).toBe("zh-tw")
    expect(uiLanguageFor("zh-CN")?.code).toBe("zh")
    expect(uiLanguageFor("xx")).toBeUndefined()
    expect(stringsFor("xx")).toBe(en)
    expect(ariaLocaleFor("ar-EG")).toBe("ar-AE")
    expect(ariaLocaleFor("hi")).toBe("en-US")
  })
})
