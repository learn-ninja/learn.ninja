import { existsSync, readFileSync } from "node:fs"
import { dirname, join } from "node:path"

import { compile } from "tailwindcss"

import type { Lesson } from "@workspace/spec"

import { iconCss, parseIconClass } from "./icons"
import { VISUAL_THEME } from "./visual-theme"

// Server-side: the Tailwind CSS a lesson's HTML visuals need, compiled at publish time.

// ---------- Tailwind utilities for exactly the classes a lesson's HTML uses ----------

// Found by walking up from the working directory with plain file-system calls: bundlers rewrite
// require.resolve and createRequire, which breaks this once the player is bundled into the Next.js server.
let tailwindDirCache: string | null = null
function tailwindDir(): string {
  if (tailwindDirCache) return tailwindDirCache
  for (let dir = process.cwd(); ; dir = dirname(dir)) {
    const candidate = join(dir, "node_modules", "tailwindcss")
    if (existsSync(join(candidate, "theme.css")))
      return (tailwindDirCache = candidate)
    if (dirname(dir) === dir)
      throw new Error(
        "Couldn't find node_modules/tailwindcss from " + process.cwd()
      )
  }
}
const stylesheets = new Map<string, string>()

function tailwindStylesheet(id: string): {
  content: string
  base: string
  path: string
} {
  const file = join(tailwindDir(), `${id.replace(/^tailwindcss\//, "")}.css`)
  if (!stylesheets.has(file)) stylesheets.set(file, readFileSync(file, "utf8"))
  return { content: stylesheets.get(file)!, base: tailwindDir(), path: file }
}

/** Class names used in a lesson's HTML visuals (or in any `html` fields, like the Storybook UI kit). */
export function visualClasses(lesson: Lesson | object): string[] {
  const classes = new Set<string>()
  walkStrings(lesson, (value, key) => {
    if (key !== "html" || typeof value !== "string") return
    for (const m of value.matchAll(/class\s*=\s*["']([^"']*)["']/g))
      for (const c of m[1]!.split(/\s+/)) if (c) classes.add(c)
  })
  return [...classes]
}

/**
 * Tailwind CSS for the given classes, after the CSS of any icon classes (icon-[lucide--git-branch])
 * in the components layer, so size and color utilities on an icon win; unknown classes and icons
 * are ignored (checkIcons reports them). Basecoat comes from the shared stylesheet.
 */
export async function visualsCssFor(classes: string[]): Promise<string> {
  if (classes.length === 0) return ""
  const icons: string[] = []
  for (const c of classes) {
    const ref = parseIconClass(c)
    const css = ref && (await iconCss(c, ref))
    if (css) icons.push(css)
  }
  // A fresh compiler each time: Tailwind's build() keeps every class it has seen.
  const compiler = await compile(
    `@layer theme, base, components, utilities;\n@import "tailwindcss/theme" layer(theme);\n@import "tailwindcss/utilities" layer(utilities);\n${VISUAL_THEME}`,
    {
      base: tailwindDir(),
      loadStylesheet: async (id) => tailwindStylesheet(id),
    }
  )
  const iconLayer = icons.length ? `@layer components{${icons.join("")}}` : ""
  return iconLayer + compiler.build(classes)
}

function walkStrings(
  value: unknown,
  visit: (value: unknown, key: string) => void,
  key = ""
) {
  visit(value, key)
  if (Array.isArray(value)) value.forEach((v) => walkStrings(v, visit, key))
  else if (value && typeof value === "object")
    for (const [k, v] of Object.entries(value)) walkStrings(v, visit, k)
}
