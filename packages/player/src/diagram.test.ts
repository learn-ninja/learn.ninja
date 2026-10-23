import { describe, expect, it } from "vitest"

import {
  checkDiagram,
  compileErrors,
  LABEL_ICON_GAP,
  renderDiagram,
  themed,
  withImageSizes,
} from "./diagram"

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

  it("draws sequence diagrams, grids, and tables in theme colors", async () => {
    const sequence = await renderDiagram(
      "shape: sequence_diagram\na: Alice\nb: Bob\na -> b: hello\nb -> b: thinks\na.note: Waits\nchat: Chat {\n  b -> a: hi\n}"
    )
    expect(sequence).toContain(">hello<")
    expect(sequence).toContain(">Waits<")
    expect(sequence).toContain(">Chat<")
    const grid = await renderDiagram(
      'stages: {\n  grid-rows: 1\n  grid-gap: 0\n  a: "1200 BC\\nTrade thrives"\n  b: Attack\n}'
    )
    expect(grid).toContain(">1200 BC<")
    expect(grid).toContain(">Trade thrives<")
    const table = await renderDiagram(
      "users: {shape: sql_table; id: int {constraint: primary_key}; team: int {constraint: foreign_key}}\nteams: {shape: sql_table; id: int {constraint: primary_key}}\nusers.team -> teams.id"
    )
    expect(table).toContain(">PK<")
    expect(table).toContain(">FK<")
    // The table's header is drawn in the text color, with its name in the background color.
    expect(table).toContain('class="class_header fill-N1"')
    for (const svg of [sequence, grid, table]) {
      expect(svg).not.toMatch(/\.(?:fill|stroke)-[A-Z]{1,2}\d\{[a-z]+:#/)
      expect(svg).toContain("--d2-N1:var(--foreground)")
    }
  }, 20_000)

  it("throws on D2 that doesn't compile", async () => {
    await expect(renderDiagram("a -> {")).rejects.toThrow()
  }, 20_000)

  it("draws icons inline where D2 would load an image", async () => {
    const svg = await renderDiagram(
      "repo: Repo {icon: octicon/repo-16}\nbranch: Branch {shape: image; icon: lucide/git-branch}\nrepo -> branch"
    )
    expect(svg).not.toContain("<image")
    const icons = svg.match(/<svg [^>]*role="img"[^>]*>/g) ?? []
    expect(icons).toHaveLength(2)
    // At the box size, in the drawing's text color.
    expect(icons[0]).toMatch(/viewBox="0 0 16 16"/)
    expect(icons[0]).toMatch(/width="32" height="32"/)
    expect(icons[0]).toMatch(/color="var\(--d2-N1\)"/)
    // A shape: image box is the icon itself, 56px unless the D2 sets a size.
    expect(icons[1]).toMatch(/width="56" height="56"/)
    expect(svg).toContain(">Repo<")
  }, 20_000)

  it("stacks a box's label and icon around the box's middle", async () => {
    const svg = await renderDiagram(
      "repo: Repo on GitHub {icon: octicon/repo-16}\nhex: Hex {shape: hexagon; icon: lucide/server}\nbelow: Below {icon: lucide/server; label.near: bottom-center}"
    )
    const num = (re: RegExp) => Number(re.exec(svg)?.[1])
    // D2 pins the label to the top and the icon to the middle; both now share the middle.
    const box = {
      y: num(/<rect x="[\d.]+" y="([\d.]+)" width="[\d.]+" height="92/),
      height: 92,
    }
    const icon = num(/<svg [^>]*width="32" height="32"[^>]*\sy="([\d.]+)"/)
    const baseline = num(/<text [^>]*y="([\d.]+)"[^>]*>Repo on GitHub</)
    const labelTop = baseline - 16
    expect(icon - (labelTop + 16 * 1.3)).toBeCloseTo(LABEL_ICON_GAP, 1)
    expect((labelTop + icon + 32) / 2).toBeCloseTo(box.y + box.height / 2, 1)
    // The same inside a hexagon, where D2's icon slot would overlap the label.
    const hexBaseline = num(/<text [^>]*y="([\d.]+)"[^>]*>Hex</)
    const hexIcons = [
      ...svg.matchAll(/<svg [^>]*width="32" height="32"[^>]*\sy="([\d.]+)"/g),
    ]
    expect(Number(hexIcons[1]![1]) - (hexBaseline - 16 + 16 * 1.3)).toBeCloseTo(
      LABEL_ICON_GAP,
      1
    )
    // A label under its icon stays under it.
    const belowBaseline = num(/<text [^>]*y="([\d.]+)"[^>]*>Below</)
    expect(belowBaseline - 16 - Number(hexIcons[2]![1]) - 32).toBeCloseTo(
      LABEL_ICON_GAP,
      1
    )
  }, 20_000)

  it("keeps the size the D2 gives an image shape", async () => {
    const svg = await renderDiagram(
      "db: {shape: image; icon: lucide/database; width: 40; height: 40}"
    )
    expect(svg).toMatch(/<svg [^>]*width="40" height="40"[^>]*role="img"/)
  }, 20_000)

  it("sizes image shapes by their full id, inside containers too", () => {
    const sized = withImageSizes("x", [
      { id: "cloud", type: "rectangle", width: 200, height: 100 },
      { id: "cloud.web app", type: "image", width: 128, height: 128 },
      { id: "cloud.db", type: "image", width: 40, height: 40 },
      { id: 'odd"id', type: "image", width: 128, height: 128 },
    ])
    expect(sized).toBe(
      'x\n"cloud"."web app".width: 56\n"cloud"."web app".height: 56\n'
    )
  })
})

describe("checkDiagram", () => {
  it("accepts plain boxes and arrows", async () => {
    expect(await checkDiagram(flow)).toEqual([])
  }, 20_000)

  it("accepts sequence diagrams, grids, and tables", async () => {
    expect(
      await checkDiagram(
        "shape: sequence_diagram\na: Alice\nb: Bob\na -> b: hello\na.note: Waits"
      )
    ).toEqual([])
    expect(
      await checkDiagram("stages: {grid-rows: 1; grid-gap: 0; one; two; three}")
    ).toEqual([])
    expect(
      await checkDiagram(
        "users: {shape: sql_table; id: int {constraint: primary_key}; name: text}\norders: {shape: sql_table; user_id: int {constraint: foreign_key}}\nusers.id -> orders.user_id"
      )
    ).toEqual([])
  }, 20_000)

  it("rejects a diagram that draws nothing, and names the keyword that hid it", async () => {
    const [message] = await checkDiagram("steps: {grid-rows: 1; one; two}")
    expect(message).toMatch(/draws nothing: `steps` is a D2 keyword/)
    expect(await checkDiagram("scenarios: {x: {a -> b}}")).toEqual([
      expect.stringMatching(/`scenarios` is a D2 keyword/),
    ])
    expect(await checkDiagram("vars: {x: 1}")).toEqual([
      expect.stringMatching(/draws nothing\. Give it at least one box/),
    ])
  }, 20_000)

  it("says where D2 fails to compile", async () => {
    const [message] = await checkDiagram("a: {shape: blob}")
    expect(message).toMatch(/doesn't compile: line 1: unknown shape "blob"/)
  }, 20_000)

  it("rejects icons from URLs, links, and tooltips", async () => {
    const problems = await checkDiagram(
      "a: {icon: https://example.com/a.svg}\nb: {link: https://example.com}\nc: {tooltip: hi}"
    )
    expect(problems.join("\n")).toMatch(
      /"a" has icon "https:\/\/example.com\/a.svg", but icons come from the kit/
    )
    expect(problems.join("\n")).toMatch(/links or tooltips \("b", "c"\)/)
  }, 20_000)

  it("accepts the kit's icons and suggests a fix for a misspelt one", async () => {
    expect(
      await checkDiagram(
        "repo: Repo {icon: octicon/repo-16}\nbranch: {shape: image; icon: lucide/git-branch}"
      )
    ).toEqual([])
    const problems = await checkDiagram("a: {icon: lucide/git-brnch}")
    expect(problems.join("\n")).toMatch(
      /"a" names an icon that doesn't exist: lucide\/git-brnch. Did you mean lucide\/git-branch/
    )
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
