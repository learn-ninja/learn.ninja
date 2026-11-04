import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"

import { describe, expect, it } from "vitest"

import { themeSvg } from "./svg-theme"
import { colors } from "../../tokens"

// Drawings the server made for the example lessons (packages/player/scripts/prepare-examples.ts
// writes them for the stories; these are copies, since that file is generated and not committed).
const fixture = (name: string) =>
  readFileSync(
    fileURLToPath(new URL(`./fixtures/${name}.svg`, import.meta.url).href),
    "utf8"
  )
const prepared = {
  charts: { chart: fixture("chart") },
  diagrams: { diagram: fixture("diagram") },
  molecules: { molecule: fixture("molecule") },
}
const first = (map: Record<string, string>) => Object.values(map)[0]!

describe("theming a server-drawn SVG for react-native-svg", () => {
  it("resolves the theme's custom properties and color-mix() to the app's colors", () => {
    const out = themeSvg(
      `<svg width="10" height="10"><rect fill="var(--chart-2)" stroke="color-mix(in oklab, var(--foreground) 12%, var(--background))"/></svg>`
    )!
    expect(out.xml).toContain(`fill="${colors.chart[2]}"`)
    expect(out.xml).not.toContain("var(")
    expect(out.xml).not.toContain("color-mix(")
  })

  it("sizes the drawing from its attributes or its viewBox", () => {
    expect(themeSvg(`<svg viewBox="0 0 480 300"></svg>`)).toMatchObject({
      width: 480,
      height: 300,
    })
    expect(
      themeSvg(`<svg width="161" height="175" viewBox="139 133 129 140"></svg>`)
    ).toMatchObject({
      width: 161,
      height: 175,
    })
    expect(themeSvg(`<svg></svg>`)).toBeNull()
  })

  it("draws a chart: currentColor is the muted foreground, em offsets become px, the stylesheet goes", () => {
    const out = themeSvg(first(prepared.charts))!
    expect(out.color).toBe(colors.muted.foreground)
    expect(out.xml).not.toContain("<style")
    expect(out.xml).not.toContain('em"')
    expect(out.xml).toContain('y="3.84"')
    expect(out.xml).toMatch(/<svg[^>]* font-size="12"/)
    expect(out.xml).not.toContain("font-family=")
    expect(out.xml).not.toContain("var(")
  })

  it("draws a diagram: D2's color classes become attributes, fonts and foreign objects go", () => {
    const out = themeSvg(first(prepared.diagrams))!
    expect(out.xml).not.toContain("<style")
    expect(out.xml).not.toContain("@font-face")
    expect(out.xml).not.toContain("foreignObject")
    expect(out.xml).not.toContain("var(")
    expect(out.xml).not.toContain("color-mix(")
    // A shape's fill: the theme's background, over the color D2 wrote.
    expect(out.xml).toMatch(
      new RegExp(
        `<rect[^>]*fill="${colors.background}"[^>]*class="[^"]*fill-B6`
      )
    )
    expect(out.xml).not.toContain('fill="#F7F8FE"')
    expect(out.xml).toMatch(/<rect rx="6" ry="6"/)
    expect(out.xml).not.toContain('style="max-width')
  })

  it("draws a molecule: element colors mixed into the foreground", () => {
    const out = themeSvg(first(prepared.molecules))!
    expect(out.xml).not.toContain("var(")
    expect(out.xml).not.toContain("color-mix(")
    expect(out.xml).toContain(`stroke="${colors.foreground}"`)
    expect(out.color).toBe(colors.foreground)
  })

  it("removes a stylesheet or foreign object however it nests or self-closes", () => {
    const out = themeSvg(
      `<svg width="10" height="10"><style>a{}<style>b{}</style></style><foreignObject/><foreignObject><div/></foreignObject><rect/></svg>`
    )!
    expect(out.xml).not.toContain("<style")
    expect(out.xml).not.toContain("foreignObject")
    expect(out.xml).toContain("<rect/>")
  })

  it("drops the halo stroke a label can't paint under its fill", () => {
    const out = themeSvg(
      `<svg width="10" height="10"><text fill="#fff" stroke="#000" stroke-width="3" paint-order="stroke">A</text></svg>`
    )!
    expect(out.xml).toContain('<text fill="#fff">A</text>')
  })
})
