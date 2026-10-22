import { getIconCSS, getIconData, iconToHTML, iconToSVG } from "@iconify/utils"

type IconifyJSON = Parameters<typeof getIconData>[0]

// Server-side: the icons a lesson may name, resolved at publish time. A lesson names an icon as
// `set/name` (D2) or `icon-[set--name]` (an HTML class); the server embeds the SVG itself, so the
// learner's browser loads nothing from other sites and the lesson stays sealed. Icon data comes
// from Iconify's packaged sets, loaded on first use: lucide (what the player uses), octicon
// (GitHub's own), simple-icons (brand marks, one color), and the colored logos and vscode-icons.

/** The icon sets a lesson may use, as the model names them, each loaded on first use. */
const SETS: Record<string, () => Promise<IconifyJSON>> = {
  lucide: () => import("@iconify-json/lucide").then((m) => m.icons),
  octicon: () => import("@iconify-json/octicon").then((m) => m.icons),
  "simple-icons": () =>
    import("@iconify-json/simple-icons").then((m) => m.icons),
  logos: () => import("@iconify-json/logos").then((m) => m.icons),
  "vscode-icons": () =>
    import("@iconify-json/vscode-icons").then((m) => m.icons),
}

export const ICON_SETS = Object.keys(SETS)

const loaded = new Map<string, Promise<IconifyJSON>>()

async function setData(set: string): Promise<IconifyJSON | null> {
  const load = SETS[set]
  if (!load) return null
  if (!loaded.has(set)) loaded.set(set, load())
  return loaded.get(set)!
}

export interface IconRef {
  set: string
  name: string
}

/** The icon class an HTML visual uses: icon-[lucide--git-branch]. */
export const ICON_CLASS = /^icon-\[([a-z0-9-]+)--([a-z0-9-]+)\]$/

/** `set/name` as written in D2 (`icon: lucide/git-branch`), or null when it isn't one. */
export function parseIconRef(value: string): IconRef | null {
  const m = /^([a-z0-9-]+)\/([a-z0-9-]+)$/.exec(value)
  return m ? { set: m[1]!, name: m[2]! } : null
}

/** The icon named by an `icon-[set--name]` class, or null for any other class. */
export function parseIconClass(className: string): IconRef | null {
  const m = ICON_CLASS.exec(className)
  return m ? { set: m[1]!, name: m[2]! } : null
}

/** Whether the set exists and has this icon (aliases count). */
export async function iconExists({ set, name }: IconRef): Promise<boolean> {
  const data = await setData(set)
  return Boolean(data && getIconData(data, name))
}

/**
 * The icon as an inline `<svg>` sized by the given attributes. One-color icons take `currentColor`,
 * so the drawing's `color` decides theirs; colored icons (logos, file types) keep their own.
 * Null when the icon doesn't exist.
 */
export async function iconSvg(
  ref: IconRef,
  attributes: Record<string, string> = {}
): Promise<string | null> {
  const data = await setData(ref.set)
  const icon = data && getIconData(data, ref.name)
  if (!icon) return null
  const rendered = iconToSVG(icon)
  return iconToHTML(rendered.body, {
    ...rendered.attributes,
    ...attributes,
    role: "img",
  })
}

/**
 * The CSS that draws the icon into every element with `className`: a mask painted in the text
 * color for one-color icons, the picture itself for colored ones. Sized 1em so it follows the font
 * size and sits on the baseline; width and height utilities can override that. Null when the icon
 * doesn't exist.
 */
export async function iconCss(
  className: string,
  ref: IconRef
): Promise<string | null> {
  const data = await setData(ref.set)
  const icon = data && getIconData(data, ref.name)
  if (!icon) return null
  return getIconCSS(icon, {
    iconSelector: `.${cssEscape(className)}`,
    format: "compressed",
    rules: { "vertical-align": "-0.125em", "flex-shrink": "0" },
  })
}

/**
 * Up to three icons in the same set whose names are closest to a name that doesn't exist, for the
 * checker's message. Names sharing a word with the typo come first, then near spellings.
 */
export async function suggestIcons(ref: IconRef): Promise<string[]> {
  const data = await setData(ref.set)
  if (!data) return []
  const names = [...Object.keys(data.icons), ...Object.keys(data.aliases ?? {})]
  const words = new Set(ref.name.split("-"))
  const scored = names
    .map((name) => {
      const shared = name.split("-").filter((w) => words.has(w)).length
      const distance = levenshtein(ref.name, name)
      const score = shared * 10 - distance
      return { name, score, ok: shared > 0 || distance <= 2 }
    })
    .filter((s) => s.ok)
    .sort((a, b) => b.score - a.score || a.name.length - b.name.length)
  return scored.slice(0, 3).map((s) => `${ref.set}/${s.name}`)
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    let diagonal = prev[0]!
    prev[0] = i
    for (let j = 1; j <= b.length; j++) {
      const temp = prev[j]!
      prev[j] = Math.min(
        prev[j]! + 1,
        prev[j - 1]! + 1,
        diagonal + (a[i - 1] === b[j - 1] ? 0 : 1)
      )
      diagonal = temp
    }
  }
  return prev[b.length]!
}

/** A class name as a CSS selector: `icon-[lucide--x]` -> `icon-\[lucide--x\]`. */
function cssEscape(className: string): string {
  return className.replace(/[^a-zA-Z0-9_-]/g, (c) => `\\${c}`)
}
