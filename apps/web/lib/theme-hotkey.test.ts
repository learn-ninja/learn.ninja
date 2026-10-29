import { describe, expect, it } from "vitest"

import { flipsTheme } from "./theme-hotkey"

// The theme provider's D (while developing) must not also fire on a lesson page, where D shows and
// hides the player's buttons.

const d = {
  key: "d",
  repeat: false,
  metaKey: false,
  ctrlKey: false,
  altKey: false,
  defaultPrevented: false,
  target: null,
}
const page = (player: boolean) => ({
  querySelector: (selector: string) =>
    player && selector === "[data-lesson-player]" ? ({} as Element) : null,
})

describe("theme hotkey", () => {
  it("flips the theme on D on other pages", () => {
    expect(flipsTheme(d, page(false))).toBe(true)
    expect(flipsTheme({ ...d, key: "D" }, page(false))).toBe(true)
  })

  it("ignores D when a lesson player is on the page", () => {
    expect(flipsTheme(d, page(true))).toBe(false)
  })

  it("ignores other keys, modifiers, repeats, and handled presses", () => {
    expect(flipsTheme({ ...d, key: "w" }, page(false))).toBe(false)
    expect(flipsTheme({ ...d, metaKey: true }, page(false))).toBe(false)
    expect(flipsTheme({ ...d, repeat: true }, page(false))).toBe(false)
    expect(flipsTheme({ ...d, defaultPrevented: true }, page(false))).toBe(
      false
    )
  })
})
