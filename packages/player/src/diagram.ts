import "server-only"

import { D2 } from "@terrastruct/d2"

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
 * light and dark).
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

/** The diagram as an SVG string in the theme's colors. Throws when the D2 doesn't compile. */
export async function renderDiagram(source: string): Promise<string> {
  const svg = await run(async (d2) => {
    const { diagram, renderOptions } = await d2.compile(source)
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

/**
 * Draws each icon in place of the <image> D2 emitted for it, at the same spot and size. One-color
 * icons take the drawing's text color; D2's own stroke and fill (from `shape: image`) are dropped,
 * since they'd outline the picture. An unknown icon is removed, leaving the shape's label.
 */
export async function withIcons(svg: string): Promise<string> {
  const images = [...svg.matchAll(/<image\s([^>]*?)\/?>(?:<\/image>)?/g)]
  if (images.length === 0) return svg
  let out = svg
  for (const m of images) {
    const attrs = Object.fromEntries(
      [...m[1]!.matchAll(/([a-zA-Z:-]+)="([^"]*)"/g)].map((a) => [a[1]!, a[2]!])
    )
    const ref = attrs.href ? parseIconRef(attrs.href) : null
    const size = Object.fromEntries(
      ["x", "y", "width", "height"]
        .filter((k) => attrs[k] !== undefined)
        .map((k) => [k, String(Number(attrs[k]))])
    )
    const drawn = ref
      ? await iconSvg(ref, { ...size, color: "var(--d2-N1)" })
      : null
    out = out.replace(m[0], drawn ?? "")
  }
  return out
}

/** A letter from a right-to-left script: Hebrew, Arabic, Syriac, Thaana, and their forms. */
const RTL_LETTER = /[\u0590-\u08ff\ufb1d-\ufdff\ufe70-\ufeff]/

/**
 * Swaps D2's colors for the theme's tokens, drops its white backdrop, gives the drawing its
 * natural size (scaled down to fit narrow screens), and strips anything that could run code.
 * The labels' direction comes from their own script, not the page's: D2 has already placed them,
 * and an English diagram under an Arabic interface would otherwise move its punctuation.
 */
export function themed(svg: string, direction: "ltr" | "rtl" = "ltr"): string {
  return (
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
      .replace(/<script\b[\s\S]*?<\/script\s*>/gi, "")
      .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
  )
}
