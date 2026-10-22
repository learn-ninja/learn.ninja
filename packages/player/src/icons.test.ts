import { describe, expect, it } from "vitest"

import {
  iconCss,
  iconExists,
  iconSvg,
  parseIconClass,
  parseIconRef,
  suggestIcons,
} from "./icons"

// Icons are named `set/name` in D2 and `icon-[set--name]` in HTML, and resolved on the server from
// Iconify's packaged sets, so a lesson never loads one from another site.

describe("icon names", () => {
  it("parses D2 and class spellings", () => {
    expect(parseIconRef("lucide/git-branch")).toEqual({
      set: "lucide",
      name: "git-branch",
    })
    expect(parseIconRef("https://example.com/a.svg")).toBeNull()
    expect(parseIconRef("lucide")).toBeNull()
    expect(parseIconClass("icon-[octicon--repo-16]")).toEqual({
      set: "octicon",
      name: "repo-16",
    })
    expect(parseIconClass("icon-lucide")).toBeNull()
    expect(parseIconClass("size-6")).toBeNull()
  })

  it("knows which icons exist, aliases included", async () => {
    expect(await iconExists({ set: "lucide", name: "git-branch" })).toBe(true)
    expect(await iconExists({ set: "octicon", name: "git-branch" })).toBe(true)
    expect(await iconExists({ set: "logos", name: "github-icon" })).toBe(true)
    expect(await iconExists({ set: "lucide", name: "git-brnch" })).toBe(false)
    expect(await iconExists({ set: "nope", name: "git-branch" })).toBe(false)
  })

  it("suggests close names in the same set", async () => {
    expect(await suggestIcons({ set: "lucide", name: "git-brnch" })).toContain(
      "lucide/git-branch"
    )
    expect(
      await suggestIcons({ set: "octicon", name: "pull-request" })
    ).toContain("octicon/git-pull-request")
    expect(await suggestIcons({ set: "nope", name: "x" })).toEqual([])
  })
})

describe("drawing icons", () => {
  it("draws a one-color icon in currentColor at the given size", async () => {
    const svg = await iconSvg(
      { set: "lucide", name: "git-branch" },
      { width: "46", height: "46", x: "10", y: "20" }
    )
    expect(svg).toMatch(/^<svg [^>]*width="46"[^>]*viewBox="0 0 24 24"/)
    expect(svg).toContain('x="10"')
    expect(svg).toContain('stroke="currentColor"')
    expect(svg).not.toMatch(/href=|url\(/)
  })

  it("keeps a colored logo's own colors", async () => {
    const svg = await iconSvg({ set: "logos", name: "github-icon" })
    expect(svg).toMatch(/fill="#[0-9a-fA-F]{6}"/)
  })

  it("returns null for an unknown icon", async () => {
    expect(await iconSvg({ set: "lucide", name: "git-brnch" })).toBeNull()
    expect(await iconCss("x", { set: "lucide", name: "git-brnch" })).toBeNull()
  })

  it("writes a mask in the text color for one-color icons", async () => {
    const css = await iconCss("icon-[lucide--git-branch]", {
      set: "lucide",
      name: "git-branch",
    })
    expect(css).toMatch(/^\.icon-\\\[lucide--git-branch\\\]\{/)
    expect(css).toContain("background-color:currentColor")
    expect(css).toContain("mask-image:var(--svg)")
    expect(css).toContain("width:1em;height:1em")
    expect(css).toContain("vertical-align:-0.125em")
    expect(css).toContain('url("data:image/svg+xml,')
  })

  it("writes the picture itself for colored icons", async () => {
    const css = await iconCss("icon-[logos--github-icon]", {
      set: "logos",
      name: "github-icon",
    })
    expect(css).toContain("background-image:url(")
    expect(css).not.toContain("mask-image")
  })
})
