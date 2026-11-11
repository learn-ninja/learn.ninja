import { alpha, mix, parseColor } from "./color"
import { colors } from "../../tokens"

// The SVG the server draws (charts, diagrams, molecules) made drawable by react-native-svg: the
// theme's custom properties and color-mix() become the app's own colors, the classes D2 colors by
// become attributes, the stylesheets and fonts go, and the few things react-native-svg can't draw
// are mapped or dropped. The web shows the same strings as they are, styled by its stylesheet.

/** The theme's custom properties, as the app's tokens. */
export const THEME_VARS: Record<string, string> = {
  background: colors.background,
  foreground: colors.foreground,
  card: colors.card.DEFAULT,
  "card-foreground": colors.card.foreground,
  popover: colors.popover.DEFAULT,
  primary: colors.primary.DEFAULT,
  "primary-foreground": colors.primary.foreground,
  secondary: colors.secondary.DEFAULT,
  muted: colors.muted.DEFAULT,
  "muted-foreground": colors.muted.foreground,
  accent: colors.accent.DEFAULT,
  destructive: colors.destructive.DEFAULT,
  border: colors.border,
  input: colors.input,
  ring: colors.ring,
  "chart-1": colors.chart[1],
  "chart-2": colors.chart[2],
  "chart-3": colors.chart[3],
  "chart-4": colors.chart[4],
  "chart-5": colors.chart[5],
}

/** `var(--name)` or `var(--name, fallback)`, resolved against the properties known. */
function resolveVars(text: string, vars: Record<string, string>): string {
  // Innermost first, so nested var() in a fallback or a color-mix() resolves too.
  let out = text
  for (let i = 0; i < 8; i++) {
    const next = out.replace(
      /var\(--([\w-]+)(?:\s*,\s*([^()]*))?\)/g,
      (all, name: string, fallback?: string) =>
        vars[name] ?? fallback?.trim() ?? all
    )
    if (next === out) break
    out = next
  }
  return out
}

/** `color-mix(in <space>, A N%, B)` and its other spellings, as one color. */
function resolveMixes(text: string): string {
  let out = text
  for (let i = 0; i < 4; i++) {
    const next = out.replace(
      /color-mix\(\s*in\s+[\w-]+\s*,\s*([^,()]+?(?:\([^()]*\))?)\s*(?:(\d+(?:\.\d+)?)%)?\s*,\s*([^,()]+?(?:\([^()]*\))?)\s*(?:(\d+(?:\.\d+)?)%)?\s*\)/g,
      (all, a: string, pa?: string, b: string = "", pb?: string) => {
        const first = a.trim()
        const second = b.trim()
        if (!parseColor(first) || !parseColor(second)) return all
        const pct =
          pa !== undefined
            ? Number(pa)
            : pb !== undefined
              ? 100 - Number(pb)
              : 50
        return mix(first, pct, second)
      }
    )
    if (next === out) break
    out = next
  }
  return out
}

/** The custom properties a stylesheet declares (`--name: value;`), the last declaration winning. */
function declaredVars(svg: string): Record<string, string> {
  const vars: Record<string, string> = {}
  for (const m of svg.matchAll(/--([\w-]+)\s*:\s*([^;}]+)[;}]/g))
    vars[m[1]!] = m[2]!.trim()
  return vars
}

/**
 * D2 colors its shapes by class (`.fill-N1{fill:…}`), which react-native-svg doesn't read: the
 * rules become attributes on the elements that carry the class, over any attribute D2 wrote.
 */
function inlineClassColors(svg: string): string {
  const rules = new Map<string, { prop: string; value: string }>()
  for (const m of svg.matchAll(
    /\.((?:fill|stroke)-[A-Z]{1,2}\d)\s*\{\s*(fill|stroke)\s*:\s*([^;}]+);?\s*\}/g
  ))
    rules.set(m[1]!, { prop: m[2]!, value: m[3]!.trim() })
  if (rules.size === 0) return svg
  return svg.replace(
    /<([a-zA-Z]+)([^>]*?)class="([^"]*)"([^>]*?)(\/?)>/g,
    (
      all,
      tag: string,
      before: string,
      classes: string,
      after: string,
      close: string
    ) => {
      let attrs = before + after
      let changed = false
      for (const cls of classes.split(/\s+/)) {
        const rule = rules.get(cls)
        if (!rule) continue
        const re = new RegExp(`\\s${rule.prop}="[^"]*"`)
        attrs = re.test(attrs)
          ? attrs.replace(re, ` ${rule.prop}="${rule.value}"`)
          : `${attrs} ${rule.prop}="${rule.value}"`
        changed = true
      }
      return changed ? `<${tag}${attrs} class="${classes}"${close}>` : all
    }
  )
}

/** The XML without the named elements and their contents, however they nest. */
function withoutElements(xml: string, names: string[]): string {
  let out = xml
  for (const name of names) {
    const element = new RegExp(
      `<${name}\\b[^>]*>[\\s\\S]*?<\\/${name}\\s*>|<${name}\\b[^>]*\\/>`,
      "g"
    )
    for (;;) {
      const next = out.replace(element, "")
      if (next === out) break
      out = next
    }
  }
  return out
}

/** The root `<svg>` tag's attributes, as a map. */
function rootAttributes(svg: string): Record<string, string> {
  const open = /<svg\b([^>]*)>/.exec(svg)
  if (!open) return {}
  return Object.fromEntries(
    [...open[1]!.matchAll(/([a-zA-Z:-]+)="([^"]*)"/g)].map((a) => [
      a[1]!,
      a[2]!,
    ])
  )
}

export interface ThemedSvg {
  xml: string
  /** The drawing's own size, from its width and height or its viewBox. */
  width: number
  height: number
  /** What `currentColor` means in it. */
  color: string
}

/**
 * A server-drawn SVG, ready for react-native-svg. Null when there's no drawing to size.
 */
export function themeSvg(svg: string): ThemedSvg | null {
  const root = rootAttributes(svg)
  const style = Object.fromEntries(
    (root.style ?? "")
      .split(";")
      .map((d) => d.split(":").map((s) => s.trim()))
      .filter((d): d is [string, string] => d.length === 2 && Boolean(d[0]))
  )
  const vars = { ...THEME_VARS, ...declaredVars(svg) }
  // The root's own color sets currentColor (a chart draws its axes in the muted foreground).
  const color = resolveMixes(resolveVars(style.color ?? "currentColor", vars))
  const viewBox = (root.viewBox ?? "").split(/[\s,]+/).map(Number)
  const width = Number(root.width) || viewBox[2] || 0
  const height = Number(root.height) || viewBox[3] || 0
  if (!width || !height) return null

  let xml = inlineClassColors(svg)
  xml = resolveMixes(resolveVars(xml, vars))
  // The stylesheets (D2's fonts among them) and anything the app can't draw. This isn't a
  // sanitizer (react-native-svg draws no HTML and runs nothing, and the server already strips
  // scripts), but each element is removed until none is left, so a nested one can't survive.
  xml = withoutElements(xml, ["style", "foreignObject", "title", "desc"])
  // The web shows text in the page's font; the app in the system's.
  xml = xml.replace(/\sfont-family="[^"]*"/g, "")
  // em lengths (a chart's tick labels sit 0.32em down) in the root's font size.
  const em =
    Number(/^(\d+(?:\.\d+)?)px$/.exec(style["font-size"] ?? "")?.[1]) ||
    Number(root["font-size"]) ||
    12
  xml = xml.replace(
    /\s(x|y|dx|dy)="(-?\d*\.?\d+)em"/g,
    (_, name: string, value: string) =>
      ` ${name}="${Math.round(Number(value) * em * 100) / 100}"`
  )
  // paint-order: a label stroked in the page color under its fill. react-native-svg paints the
  // stroke over the fill, so the halo goes and the label stays legible on its own. Plot sets it on
  // the group around a text mark's labels (a chart's point labels), not on each text.
  xml = xml.replace(/<(?:text|g)\b[^>]*paint-order[^>]*>/g, (tag) =>
    tag
      .replace(/\sstroke(?:-width|-linejoin)?="[^"]*"/g, "")
      .replace(/\spaint-order="[^"]*"/, "")
  )
  xml = xml.replace(
    /\sdominant-baseline="([^"]*)"/g,
    ' alignment-baseline="$1"'
  )
  // D2 rounds its shapes with a stylesheet rule the app can't read.
  if (/class="[^"]*\bd2-svg\b/.test(xml))
    xml = xml.replace(
      /<rect\b(?![^>]*\brx=)([^>]*?)(\/?)>/g,
      '<rect rx="6" ry="6"$1$2>'
    )
  // The root takes its drawn size and the chart's font size; its stylesheet-only styles go.
  xml = xml.replace(/<svg\b([^>]*)>/, (_, attrs: string) => {
    let a = attrs
      .replace(/\sstyle="[^"]*"/, "")
      .replace(/\s(?:width|height|font-size)="[^"]*"/g, "")
    a += ` width="${width}" height="${height}"`
    const fontSize = style["font-size"] ?? root["font-size"]
    if (fontSize) a += ` font-size="${String(fontSize).replace("px", "")}"`
    if (!/viewBox=/.test(a)) a += ` viewBox="0 0 ${width} ${height}"`
    return `<svg${a}>`
  })
  // A chart sets text-anchor="middle" on the root for its labels (a point's label centred over
  // it); react-native-svg doesn't pass the root's down to its text, but a group's it does.
  const anchor = root["text-anchor"]
  if (anchor)
    xml = xml
      .replace(/<svg\b[^>]*>/, (open) => `${open}<g text-anchor="${anchor}">`)
      .replace(/<\/svg>\s*$/, "</g></svg>")
  // Browsers fill in black; react-native-svg too, but a drawing in currentColor needs its color.
  return {
    xml,
    width,
    height,
    color: color === "currentColor" ? colors.foreground : alpha(color, 1),
  }
}
