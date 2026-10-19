import { describe, expect, it } from "vitest"

import { checkDiagram, compileErrors, renderDiagram, themed } from "./diagram"

// Diagrams are laid out by D2 on the server into SVG that carries only theme tokens, so one drawing
// serves light and dark, and the checks keep out what the sandboxed frame shouldn't show.

const flow = `direction: right
browser: Browser
server: Server
db: Database {shape: cylinder}
browser -> server: request
server -> db: query`

describe("renderDiagram", () => {
  it("draws the labels in theme colors on a clear background", async () => {
    const svg = await renderDiagram(flow)
    expect(svg.startsWith("<svg")).toBe(true)
    expect(svg).toContain(">Browser<")
    expect(svg).toContain(">request<")
    expect(svg).toContain("var(--d2-B6)")
    expect(svg).toContain("--d2-N1:var(--foreground)")
    // D2's own palette is gone from the color classes, and so is its white backdrop.
    expect(svg).not.toMatch(/\.fill-N1\{fill:#/)
    expect(svg).not.toMatch(/<rect [^>]*class=" fill-N7"/)
    expect(svg).toMatch(
      /^<svg [^>]*width="\d+" height="\d+" direction="ltr" style="max-width:100%;height:auto"/
    )
  }, 20_000)

  it("sets the labels' direction from their script", async () => {
    expect(await renderDiagram("a: Server")).toContain('direction="ltr"')
    expect(await renderDiagram('a: "الخادم"')).toContain('direction="rtl"')
  }, 20_000)

  it("runs one diagram at a time when asked for several at once", async () => {
    const svgs = await Promise.all(
      ["a -> b", "c -> d", "e -> f"].map((d2) => renderDiagram(d2))
    )
    expect(svgs[0]).toContain(">a<")
    expect(svgs[1]).toContain(">c<")
    expect(svgs[2]).toContain(">e<")
  }, 20_000)

  it("throws on D2 that doesn't compile", async () => {
    await expect(renderDiagram("a -> {")).rejects.toThrow()
  }, 20_000)
})

describe("checkDiagram", () => {
  it("accepts plain boxes and arrows", async () => {
    expect(await checkDiagram(flow)).toEqual([])
  }, 20_000)

  it("says where D2 fails to compile", async () => {
    const [message] = await checkDiagram("a: {shape: blob}")
    expect(message).toMatch(/doesn't compile: line 1: unknown shape "blob"/)
  }, 20_000)

  it("rejects icons, links, and tooltips", async () => {
    const problems = await checkDiagram(
      "a: {icon: https://example.com/a.svg}\nb: {link: https://example.com}\nc: {tooltip: hi}"
    )
    expect(problems.join("\n")).toMatch(/icons or images \("a"\)/)
    expect(problems.join("\n")).toMatch(/links or tooltips \("b", "c"\)/)
  }, 20_000)

  it("rejects HTML in Markdown labels", async () => {
    const problems = await checkDiagram(
      'a: |md\n  Hi <b onclick="x">there</b>\n|'
    )
    expect(problems.join("\n")).toMatch(/can't contain HTML or images/)
  }, 20_000)

  it("rejects colors of its own", async () => {
    const problems = await checkDiagram(
      'a -> b\na.style.fill: "#ff0000"\nb.style.font-color: red'
    )
    expect(problems.join("\n")).toMatch(/Don't set colors.*"a", "b"/)
  }, 20_000)
})

describe("compileErrors", () => {
  it("turns D2's error list into lines", () => {
    const error = new Error(
      JSON.stringify([
        { range: "x", errmsg: "index:3:5: connection missing destination" },
      ])
    )
    expect(compileErrors(error)).toEqual([
      "line 3: connection missing destination",
    ])
  })
})

describe("themed", () => {
  it("strips scripts and event handlers", () => {
    const svg = themed(
      '<svg viewBox="0 0 10 10"><b onclick="x()">a</b><script>x()</script></svg>'
    )
    expect(svg).not.toContain("onclick")
    expect(svg).not.toContain("<script")
  })
})
