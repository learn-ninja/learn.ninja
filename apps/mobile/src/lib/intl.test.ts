import { readFileSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

import { UI_LANGUAGES } from "@workspace/player-core/strings"

// Hermes has no Intl.PluralRules; index.ts loads the polyfill with plural rules for every
// interface language. A language added to the player's menu needs its rules there too.

describe("the plural-rules polyfill", () => {
  it("has data for every interface language", () => {
    const entry = readFileSync(join(__dirname, "../../index.ts"), "utf8")
    const loaded = [
      ...entry.matchAll(/intl-pluralrules\/locale-data\/([\w-]+)\.js/g),
    ].map((m) => m[1])
    for (const { code } of UI_LANGUAGES)
      expect(loaded, code).toContain(code.split("-")[0])
  })

  it("has number and relative-time formats for every interface language", () => {
    const entry = readFileSync(join(__dirname, "../../index.ts"), "utf8")
    for (const pkg of ["intl-numberformat", "intl-relativetimeformat"]) {
      const loaded = [
        ...entry.matchAll(new RegExp(`${pkg}/locale-data/([\\w-]+)\\.js`, "g")),
      ].map((m) => m[1])
      for (const { code } of UI_LANGUAGES)
        expect(loaded, `${pkg} ${code}`).toContain(
          code === "zh-tw" ? "zh-Hant" : code
        )
    }
  })
})
