import "server-only"

import { D2 } from "@terrastruct/d2"
import { DOMParser } from "linkedom"

import {
  ICON_SETS,
  iconExists,
  iconSvg,
  parseIconRef,
  suggestIcons,
} from "./icons"

// Server-only: lays out and draws a lesson's D2 diagrams (https://d2lang.com) with D2.js, a WASM
// build of D2 that runs in a worker thread, once per lesson. The SVG is recolored to the theme's
// tokens, so one drawing serves light and dark, and the player shows it in the same script-free
// sandboxed frame as HTML visuals: D2's Markdown labels pass raw HTML through. Icons are named
// `set/name` (icons.ts) and drawn inline after layout, in place of the <image> D2 would load.

/** D2's own palette codes, which the drawing uses as class names (fill-B6, stroke-N1, ...). */
const THEME_CODE = /^(?:N[1-7]|B[1-6]|AA[245]|AB[45])$/

/** Each D2 palette code as a theme token: D2's neutral theme, redrawn in the lesson's colors. */
const PALETTE: Record<string, string> = {
  // Text and lines.
  N1: "var(--foreground)",
  N2: "var(--muted-foreground)",
  N3: "var(--muted-foreground)",
  // Gray fills: diamonds, queues, hexagons.
  N4: "color-mix(in oklab, var(--foreground) 12%, var(--background))",
  N5: "var(--muted)",
  N6: "var(--muted)",
  N7: "var(--background)",
  // Outlines and arrows.
  B1: "var(--muted-foreground)",
  B2: "var(--muted-foreground)",
  // Containers sit on a muted fill; the shapes in them are on the page's own background.
  B3: "var(--muted)",
  B4: "var(--muted)",
  B5: "var(--background)",
  B6: "var(--background)",
  // Accents: cylinders, pages, and other special shapes.
  AA2: "var(--chart-2)",
  AA4: "color-mix(in oklab, var(--chart-2) 14%, var(--background))",
  AA5: "color-mix(in oklab, var(--chart-2) 8%, var(--background))",
  AB4: "color-mix(in oklab, var(--chart-2) 14%, var(--background))",
  AB5: "color-mix(in oklab, var(--chart-2) 8%, var(--background))",
}

const THEME_CSS =
  `.d2-svg{${Object.entries(PALETTE)
    .map(([code, value]) => `--d2-${code}:${value};`)
    .join("")}}` +
  // Boxes get the lesson's rounded corners, unless the D2 sets its own (style.border-radius).
  `.d2-svg .shape>rect:not([rx]){rx:6px;ry:6px}` +
  // Markdown labels' own colors.
  `.d2-svg .md{--color-fg-default:var(--foreground);--color-fg-muted:var(--muted-foreground);--color-fg-subtle:var(--muted-foreground);--color-canvas-default:var(--background);--color-canvas-subtle:var(--muted);--color-border-default:var(--border);--color-border-muted:var(--border);--color-neutral-muted:var(--muted);--color-accent-fg:var(--foreground);--color-accent-emphasis:var(--foreground);}`

// ---------- the D2 worker ----------

/** How long one diagram may take before the worker is restarted and the diagram fails. */
const TIMEOUT_MS = 15_000

interface Worker {
  ref(): void
  unref(): void
  terminate(): Promise<number>
}
type Instance = D2 & { ready: Promise<void>; worker?: Worker }

let instance: Instance | null = null
let queue: Promise<unknown> = Promise.resolve()

/**
 * Runs one job on the shared D2 instance. D2.js answers one request at a time (a second one in
 * flight never resolves), so jobs wait their turn. The worker only keeps the process alive while
 * a job runs, so scripts and tests can exit.
 */
function run<T>(job: (d2: D2) => Promise<T>): Promise<T> {
  const result = queue.then(async () => {
    const d2 = (instance ??= new D2() as Instance)
    await d2.ready
    d2.worker?.ref()
    let timer: ReturnType<typeof setTimeout> | undefined
    try {
      return await Promise.race([
        job(d2),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => {
            instance = null
            void d2.worker?.terminate()
            reject(new Error("The diagram took too long to lay out."))
          }, TIMEOUT_MS)
        }),
      ])
    } finally {
      clearTimeout(timer)
      d2.worker?.unref()
    }
  })
  queue = result.catch(() => {})
  return result
}

type Compiled = Awaited<ReturnType<D2["compile"]>>

async function compile(source: string): Promise<Compiled> {
  return run((d2) => d2.compile(source))
}

/**
 * D2's compile errors, as readable lines: "line 2: unknown shape \"nope\"". D2.js reports them as
 * a JSON list of { range, errmsg }, where errmsg starts with "index:<line>:<column>: ".
 */
export function compileErrors(error: unknown): string[] {
  const message = error instanceof Error ? error.message : String(error)
  try {
    const list = JSON.parse(message) as { errmsg?: string }[]
    const lines = list
      .map((e) => e.errmsg?.replace(/^index:(\d+):\d+:\s*/, "line $1: "))
      .filter((m): m is string => Boolean(m))
    if (lines.length) return lines
  } catch {
    // Not D2's list: a plain message.
  }
  return [message]
}

// ---------- checks ----------

/**
 * What's wrong with a diagram's D2, as messages an LLM can act on, or none. Compiles it, then
 * rejects what the lesson page can't or shouldn't show: icons the kit doesn't have (an icon is
 * `set/name`, never a URL), links (they'd open other sites), tooltips (they need scripts), HTML or
 * images in Markdown labels, and colors of its own (the drawing takes the theme's, so it reads in
 * light and dark). A diagram with nothing on its first page is rejected too: `steps`, `layers`,
 * and `scenarios` are D2 keywords for multi-page diagrams, so a container by one of those names
 * silently moves its boxes to a page the lesson never shows.
 */
export async function checkDiagram(source: string): Promise<string[]> {
  let compiled: Compiled
  try {
    compiled = await compile(source)
  } catch (error) {
    return [
      `The D2 doesn't compile: ${compileErrors(error).slice(0, 5).join("; ")}. Fix the D2 so it draws.`,
    ]
  }
  const problems: string[] = []
  const { shapes, connections } = compiled.diagram
  if (shapes.length === 0) {
    const boards = compiled.diagram as {
      steps?: unknown[] | null
      layers?: unknown[] | null
      scenarios?: unknown[] | null
    }
    const keyword = (["steps", "layers", "scenarios"] as const).find(
      (k) => boards[k]?.length
    )
    return [
      keyword
        ? `The diagram draws nothing: \`${keyword}\` is a D2 keyword that puts its contents on another page. Name the container something else (\`stages\`, \`timeline\`, \`phases\`).`
        : "The diagram draws nothing. Give it at least one box.",
    ]
  }
  const named = (list: { id: string }[]) =>
    list
      .slice(0, 3)
      .map((s) => `"${s.id}"`)
      .join(", ")

  for (const shape of shapes) {
    const icon = iconPath(shape.icon)
    if (!icon) continue
    const ref = parseIconRef(icon)
    if (!ref || !ICON_SETS.includes(ref.set)) {
      problems.push(
        `"${shape.id}" has icon "${icon}", but icons come from the kit, never a URL: write icon: set/name with a set from ${ICON_SETS.join(", ")}, like lucide/git-branch or octicon/repo-16.`
      )
      continue
    }
    if (!(await iconExists(ref))) {
      const close = await suggestIcons(ref)
      problems.push(
        `"${shape.id}" names an icon that doesn't exist: ${icon}.` +
          (close.length
            ? ` Did you mean ${close.join(", ")}?`
            : ` Check the name in the ${ref.set} set.`)
      )
    }
  }
  const withLink = [...shapes, ...connections].filter(
    (s) => s.link || s.tooltip
  )
  if (withLink.length)
    problems.push(
      `Diagrams can't have links or tooltips (${named(withLink)}). Put what matters in the label.`
    )
  const withHtml = shapes.filter(
    (s) =>
      (s as { language?: string }).language === "markdown" &&
      /<[a-z!/]|!\[/i.test((s as { label?: string }).label ?? "")
  )
  if (withHtml.length)
    problems.push(
      `Markdown labels in a diagram can't contain HTML or images (${named(withHtml)}). Use plain Markdown text.`
    )
  const colored = [...shapes, ...connections].filter((s) =>
    [s.fill, s.stroke, (s as { color?: string }).color].some(
      (c) => c && c !== "transparent" && !THEME_CODE.test(c)
    )
  )
  if (colored.length)
    problems.push(
      `Don't set colors in a diagram (${named(colored)}): it's drawn in the lesson's own colors, in light and dark. To make a part stand out, use style.bold, style.stroke-width, style.stroke-dash, or style.multiple.`
    )
  return problems
}

/** The icon as the D2 was written (`lucide/git-branch`): D2 parses it as a URL and keeps the path. */
function iconPath(icon: unknown): string | null {
  if (!icon || typeof icon !== "object") return null
  const url = icon as { Scheme?: string; Host?: string; Path?: string }
  if (url.Scheme || url.Host) return `${url.Scheme}://${url.Host}${url.Path}`
  return url.Path || null
}

// ---------- drawing ----------

/** How big an icon is drawn inside a labelled box, whatever D2 reserved for it. */
export const BOX_ICON_SIZE = 32
/** The size of a `shape: image` box (the icon itself) when the D2 sets none. D2's own default is 128. */
export const IMAGE_SHAPE_SIZE = 56

/**
 * The D2 with a default size appended for every `shape: image` box left at D2's 128px default,
 * so an icon-as-box comes out the size of a big icon, not a picture. Boxes whose id can't be
 * written back safely (a quote in a segment) keep D2's size.
 */
export function withImageSizes(
  source: string,
  shapes: { id: string; type?: string; width?: number; height?: number }[]
): string {
  const lines = shapes
    .filter((s) => s.type === "image" && s.width === 128 && s.height === 128)
    .map((s) => s.id.split(".").map((seg) => `"${seg}"`))
    .filter((segs) => segs.every((seg) => !/["\n]/.test(seg.slice(1, -1))))
    .flatMap((segs) => {
      const path = segs.join(".")
      return [
        `${path}.width: ${IMAGE_SHAPE_SIZE}`,
        `${path}.height: ${IMAGE_SHAPE_SIZE}`,
      ]
    })
  return lines.length ? `${source}\n${lines.join("\n")}\n` : source
}

/** The space between arrows that meet the same side of a box. */
export const EDGE_SPREAD = 16

/** Box shapes with flat sides, whose sides' middles are on the outline. */
const FLAT_SIDED = new Set(["rectangle", "square", "image"])

type Point = { x: number; y: number }
type Side = "top" | "right" | "bottom" | "left"
interface EdgeShape {
  id: string
  type?: string
  pos: Point
  width: number
  height: number
}
interface EdgeConnection {
  src: string
  dst: string
  isCurve?: boolean
  route: Point[]
}

/**
 * Moves each arrow's ends to the middle of the box sides they meet. D2's default layout (dagre)
 * routes arrows wherever its ranks put them, often near a box's bottom edge, and sometimes stops
 * one short of the box. Arrows sharing a side are spread EDGE_SPREAD apart around its middle, in
 * the order they had. The point after each end moves with it, so the curve keeps its shape. Only
 * dagre's curved routes are touched (sequence diagrams and grids place theirs on purpose), and
 * only at boxes with flat sides; self-loops and arrows between a container and its own child stay.
 */
export function centerEdges(diagram: {
  shapes: EdgeShape[]
  connections: EdgeConnection[]
}): void {
  const shapes = new Map(diagram.shapes.map((s) => [s.id, s]))
  const ends: {
    route: Point[]
    at: number
    neighbor: number
    shape: EdgeShape
    side: Side
  }[] = []
  for (const c of diagram.connections) {
    const { route } = c
    if (!c.isCurve || route.length < 4 || c.src === c.dst) continue
    if (c.dst.startsWith(`${c.src}.`) || c.src.startsWith(`${c.dst}.`)) continue
    for (const [id, at, neighbor] of [
      [c.src, 0, 1],
      [c.dst, route.length - 1, route.length - 2],
    ] as const) {
      const shape = shapes.get(id)
      if (!shape || !FLAT_SIDED.has(shape.type ?? "rectangle")) continue
      const side = sideOf(shape, route[at]!, route[neighbor]!)
      ends.push({ route, at, neighbor, shape, side })
    }
  }
  const groups = new Map<string, typeof ends>()
  for (const e of ends) {
    const key = `${e.shape.id}\n${e.side}`
    groups.set(key, [...(groups.get(key) ?? []), e])
  }
  for (const group of groups.values()) {
    const across = (e: (typeof group)[number]) =>
      e.side === "top" || e.side === "bottom" ? "x" : "y"
    group.sort((a, b) => a.route[a.at]![across(a)] - b.route[b.at]![across(b)])
    group.forEach((e, i) => {
      const { pos, width, height } = e.shape
      const length = across(e) === "x" ? width : height
      const gap = Math.min(EDGE_SPREAD, length / (group.length + 1))
      const offset = (i - (group.length - 1) / 2) * gap
      const target: Point =
        e.side === "top" || e.side === "bottom"
          ? {
              x: pos.x + width / 2 + offset,
              y: e.side === "top" ? pos.y : pos.y + height,
            }
          : {
              x: e.side === "left" ? pos.x : pos.x + width,
              y: pos.y + height / 2 + offset,
            }
      const point = e.route[e.at]!
      const neighbor = e.route[e.neighbor]!
      e.route[e.neighbor] = {
        x: neighbor.x + target.x - point.x,
        y: neighbor.y + target.y - point.y,
      }
      e.route[e.at] = target
    })
  }
}

/**
 * The side of a box an arrow's end meets: of the sides the route heads out through (toward its
 * next point), the one nearest the end. A steep curve can leave through the top while ending
 * closer to the left; dagre also stops some routes short of the box.
 */
function sideOf(shape: EdgeShape, end: Point, next: Point): Side {
  const { x, y } = shape.pos
  const right = x + shape.width
  const bottom = y + shape.height
  const clamp = (v: number, lo: number, hi: number) =>
    Math.min(hi, Math.max(lo, v))
  const sides: { side: Side; out: boolean; distance: number }[] = [
    {
      side: "top",
      out: next.y < y,
      distance: Math.hypot(end.x - clamp(end.x, x, right), end.y - y),
    },
    {
      side: "bottom",
      out: next.y > bottom,
      distance: Math.hypot(end.x - clamp(end.x, x, right), end.y - bottom),
    },
    {
      side: "left",
      out: next.x < x,
      distance: Math.hypot(end.x - x, end.y - clamp(end.y, y, bottom)),
    },
    {
      side: "right",
      out: next.x > right,
      distance: Math.hypot(end.x - right, end.y - clamp(end.y, y, bottom)),
    },
  ]
  const outward = sides.filter((s) => s.out)
  const pool = outward.length ? outward : sides
  return pool.reduce((a, b) => (b.distance < a.distance ? b : a)).side
}

/** The diagram as an SVG string in the theme's colors. Throws when the D2 doesn't compile. */
export async function renderDiagram(source: string): Promise<string> {
  const svg = await run(async (d2) => {
    let { diagram, renderOptions } = await d2.compile(source)
    const sized = withImageSizes(source, diagram.shapes)
    if (sized !== source) ({ diagram, renderOptions } = await d2.compile(sized))
    centerEdges(diagram)
    return d2.render(diagram, {
      ...renderOptions,
      // Light-mode classes only: the theme tokens below recolor them for both modes.
      themeID: 0,
      darkThemeID: undefined,
      pad: 4,
      center: false,
      noXMLTag: true,
    })
  })
  return themed(await withIcons(svg), RTL_LETTER.test(source) ? "rtl" : "ltr")
}

/** The space between a box's label and the icon under it, once both are centered in the box. */
export const LABEL_ICON_GAP = 6

/**
 * Draws each icon in place of the <image> D2 emitted for it. A `shape: image` box, which D2 marks
 * with its stroke and fill classes, is the icon itself and keeps its size. An icon in a labelled
 * box is drawn at BOX_ICON_SIZE (D2 reserves about half the box, which reads heavy next to 16px
 * labels), and the label and icon are then stacked together around the box's middle: D2 pins the
 * label to the top edge and the icon's slot to the middle, so shrinking the icon alone would
 * leave the pair sitting high. The slot's center is the box's center, whatever the shape. A label
 * that isn't centered above or below its icon (icon.near or label.near set, Markdown labels) stays
 * where D2 put it. One-color icons take the drawing's text color; D2's own stroke and fill are
 * dropped, since they'd outline the picture. An unknown icon is removed, leaving the label.
 */
export async function withIcons(svg: string): Promise<string> {
  const images = [...svg.matchAll(/<image\s([^>]*?)\/?>(?:<\/image>)?/g)]
  if (images.length === 0) return svg
  const edits: Edit[] = []
  for (const m of images) {
    const attrs = attributes(m[1]!)
    const ref = attrs.href ? parseIconRef(attrs.href) : null
    const slot = {
      x: Number(attrs.x ?? 0),
      y: Number(attrs.y ?? 0),
      width: Number(attrs.width ?? 0),
      height: Number(attrs.height ?? 0),
    }
    const start = m.index!
    const end = start + m[0].length
    const isImageShape = attrs.class !== undefined
    const size = isImageShape
      ? Math.min(slot.width, slot.height)
      : Math.min(slot.width, slot.height, BOX_ICON_SIZE)
    const place = {
      x: slot.x + (slot.width - size) / 2,
      y: slot.y + (slot.height - size) / 2,
    }
    const label = ref && !isImageShape ? labelAfter(svg, end, slot) : null
    if (label) {
      const stack = label.height + LABEL_ICON_GAP + size
      const top = slot.y + slot.height / 2 - stack / 2
      const [labelTop, iconTop] = label.above
        ? [top, top + label.height + LABEL_ICON_GAP]
        : [top + size + LABEL_ICON_GAP, top]
      place.y = iconTop
      edits.push({ ...label.baseline, text: round(labelTop + label.fontSize) })
    }
    const drawn = ref
      ? await iconSvg(ref, {
          x: round(place.x),
          y: round(place.y),
          width: String(size),
          height: String(size),
          color: "var(--d2-N1)",
        })
      : null
    edits.push({ start, end, text: drawn ?? "" })
  }
  return applyEdits(svg, edits)
}

interface Edit {
  start: number
  end: number
  text: string
}

function applyEdits(text: string, edits: Edit[]): string {
  let out = text
  for (const e of [...edits].sort((a, b) => b.start - a.start))
    out = out.slice(0, e.start) + e.text + out.slice(e.end)
  return out
}

function attributes(tag: string): Record<string, string> {
  return Object.fromEntries(
    [...tag.matchAll(/([a-zA-Z:-]+)="([^"]*)"/g)].map((a) => [a[1]!, a[2]!])
  )
}

/**
 * The plain-text label D2 wrote right after an icon's <image>, when it's centered on the icon's
 * slot: its font size, the height of its lines, whether it sits above the slot's middle, and
 * where its baseline (the y attribute) is in the SVG, so it can be moved. D2 draws the label as
 * one <text>, with a <tspan> per extra line offset by dy; a Markdown label is a <foreignObject>.
 */
function labelAfter(
  svg: string,
  from: number,
  slot: { x: number; y: number; width: number; height: number }
): {
  fontSize: number
  height: number
  above: boolean
  baseline: { start: number; end: number }
} | null {
  const open = /^\s*<text\s([^>]*)>/.exec(svg.slice(from, from + 500))
  if (!open) return null
  const attrs = attributes(open[1]!)
  const style = attrs.style ?? ""
  const fontSize = Number(/font-size:(\d+(?:\.\d+)?)px/.exec(style)?.[1])
  const y = /\sy="(\d+(?:\.\d+)?)"/.exec(open[1]!)
  if (!/text-anchor:middle/.test(style) || !fontSize || !y) return null
  if (Math.abs(Number(attrs.x) - (slot.x + slot.width / 2)) > 1) return null
  const close = svg.indexOf("</text>", from)
  const body = svg.slice(from + open[0].length, close < 0 ? from : close)
  const extraLines = [...body.matchAll(/<tspan\s[^>]*dy="(\d+(?:\.\d+)?)"/g)]
    .map((t) => Number(t[1]))
    .reduce((a, b) => a + b, 0)
  const attrsStart = from + open[0].length - 1 - open[1]!.length
  const valueStart = attrsStart + y.index + y[0].length - 1 - y[1]!.length
  return {
    fontSize,
    // D2 gives a line of text about 1.3 times its font size.
    height: fontSize * 1.3 + extraLines,
    above: Number(y[1]) < slot.y + slot.height / 2,
    baseline: { start: valueStart, end: valueStart + y[1]!.length },
  }
}

const round = (n: number) => String(Math.round(n * 100) / 100)

/** A letter from a right-to-left script: Hebrew, Arabic, Syriac, Thaana, and their forms. */
const RTL_LETTER = /[\u0590-\u08ff\ufb1d-\ufdff\ufe70-\ufeff]/

/**
 * Swaps D2's colors for the theme's tokens, drops its white backdrop, gives the drawing its
 * natural size (scaled down to fit narrow screens), and strips anything that could run code.
 * The labels' direction comes from their own script, not the page's: D2 has already placed them,
 * and an English diagram under an Arabic interface would otherwise move its punctuation.
 */
export function themed(svg: string, direction: "ltr" | "rtl" = "ltr"): string {
  return withoutScripts(
    svg
      // The color classes: .d2-123 .fill-B6{fill:#F7F8FE;} -> {fill:var(--d2-B6);}
      .replace(
        /\.(fill|stroke|background-color|color)-([A-Z]{1,2}\d)\{([a-z-]+):[^;}]+;\}/g,
        (all, kind: string, code: string, prop: string) =>
          THEME_CODE.test(code)
            ? `.${kind}-${code}{${prop}:var(--d2-${code});}`
            : all
      )
      // The backdrop: a full-size rect painted N7, right after the inner <svg>.
      .replace(
        /(<svg class="d2-[^"]*"[^>]*>)<rect [^>]*class=" fill-N7"[^>]*\/>/,
        "$1"
      )
      // Natural size, at most the frame's width.
      .replace(
        /^<svg ([^>]*?)viewBox="0 0 (\d+(?:\.\d+)?) (\d+(?:\.\d+)?)"([^>]*)>/,
        (_, before: string, w: string, h: string, after: string) =>
          `<svg ${before}viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" direction="${direction}" style="max-width:100%;height:auto"${after}><style>${THEME_CSS}</style>`
      )
  )
}

/** An element or attribute name as D2 writes them; anything else is dropped rather than echoed. */
const XML_NAME = /^[A-Za-z_][\w:.-]*$/

// Node types, as numbers: Node isn't a global on the server.
const ELEMENT = 1
const CDATA = 4
const PROCESSING_INSTRUCTION = 7
const COMMENT = 8
const DOCTYPE = 10

/** A name without its namespace prefix, lowercased: `xlink:href` → `href`, `SCRIPT` → `script`. */
const localName = (name: string) =>
  name.slice(name.lastIndexOf(":") + 1).toLowerCase()

/** True for a `javascript:` URL as a browser reads one: any case, spaces and control characters ignored. */
const isScriptUrl = (value: string) =>
  [...value]
    .filter((c) => c > " ")
    .join("")
    .toLowerCase()
    .startsWith("javascript:")

/**
 * The drawing with nothing left that could run code: no `script` elements, no event-handler
 * attributes (`on…`), and no `javascript:` URLs. It's parsed and written back out rather than
 * matched with regexes, which miss `</script\t bar>`, `<scr<script>ipt>`, or `on\nclick=`.
 * Parsed as XML, which D2 writes, so its CDATA styles survive. The browser reads the result as
 * HTML, so whatever the two parsers could read differently goes too: comments (HTML ends one at
 * `--!>`), CDATA holding a `<`, and names D2 never writes. The third layer of three: the checker
 * rejects HTML in labels, and the frame runs no scripts. linkedom only runs here, at publish time.
 */
function withoutScripts(svg: string): string {
  const doc = new DOMParser().parseFromString(
    svg,
    "image/svg+xml"
  ) as unknown as XMLDocument
  const root = doc.documentElement
  if (!root) return ""
  const elements: Element[] = [root]
  for (let el = elements.pop(); el; el = elements.pop()) {
    for (const { name, value } of [...el.attributes]) {
      if (
        !XML_NAME.test(name) ||
        name.toLowerCase().startsWith("on") ||
        localName(name).startsWith("on") ||
        isScriptUrl(value)
      )
        el.removeAttribute(name)
    }
    for (const child of [...el.childNodes]) {
      if (child.nodeType === ELEMENT) {
        const name = (child as Element).tagName
        if (!XML_NAME.test(name) || localName(name) === "script") child.remove()
        else elements.push(child as Element)
      } else if (
        child.nodeType === COMMENT ||
        child.nodeType === PROCESSING_INSTRUCTION ||
        child.nodeType === DOCTYPE
      )
        child.remove()
      else if (child.nodeType === CDATA && child.nodeValue?.includes("<"))
        child.replaceWith(doc.createTextNode(child.nodeValue))
    }
  }
  return root.outerHTML
}
