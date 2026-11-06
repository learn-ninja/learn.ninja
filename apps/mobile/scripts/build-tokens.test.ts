import { readFileSync } from "node:fs"

import { describe, expect, it } from "vitest"

import { toRgb, tokensSource, TOKENS_PATH } from "./build-tokens.mjs"

describe("tokens.ts", () => {
  it("is up to date with globals.css (run `npm run tokens -w mobile`)", async () => {
    expect(readFileSync(TOKENS_PATH, "utf8")).toBe(await tokensSource())
    // Formatting the source cold takes over vitest's 5 s default on a busy CI runner.
  }, 30_000)

  it("converts the theme's OKLCH colors", () => {
    expect(toRgb("oklch(0.18 0 0)")).toBe("#121212")
    expect(toRgb("oklch(1 0 0 / 10%)")).toBe("rgba(255, 255, 255, 0.1)")
    // Tailwind 4's green-600, the web's checked-answer color (not Tailwind 3's #16a34a).
    expect(toRgb("oklch(62.7% 0.194 149.214)")).toBe("#00a63e")
  })
})
