import "server-only"

import katex from "katex"
import {
  createHighlighter,
  type BundledLanguage,
  type Highlighter,
} from "shiki"

import { everyVisual, type Issue, type Lesson } from "@workspace/spec"

import { renderChart } from "./chart"
import { chartsIn } from "./charts"
import { checkFunctionCharts } from "./curve"
import { checkDiagram, renderDiagram } from "./diagram"
import { iconExists, parseIconClass, suggestIcons } from "./icons"
import { checkMolecule, renderMolecule } from "./molecule"
import {
  chartKey,
  codeKey,
  diagramKey,
  INLINE_MATH,
  mathKey,
  moleculeKey,
  type Prepared,
} from "./prepared"
import { visualClasses, visualsCssFor } from "./visual-css"

// Server-only: renders formulas with KaTeX, highlights code with Shiki, draws charts with Observable
// Plot, diagrams with D2, and molecules with OpenChemLib, and compiles the Tailwind CSS a lesson's visuals use, once per lesson,
// so the learner's browser loads none of those libraries.

const THEMES = { light: "github-light", dark: "github-dark" } as const

let highlighter: Promise<Highlighter> | null = null
const loadedLanguages = new Set<string>()

async function getHighlighter(languages: string[]): Promise<Highlighter> {
  highlighter ??= createHighlighter({
    themes: Object.values(THEMES),
    langs: [],
  })
  const h = await highlighter
  for (const lang of languages) {
    if (loadedLanguages.has(lang)) continue
    try {
      await h.loadLanguage(lang as BundledLanguage)
      loadedLanguages.add(lang)
    } catch {
      // Unknown language: the code is shown without highlighting.
    }
  }
  return h
}

export async function prepareLesson(lesson: Lesson): Promise<Prepared> {
  const prepared: Prepared = {
    math: {},
    code: {},
    visualsCss: await visualsCssFor(visualClasses(lesson)),
    charts: {},
    diagrams: {},
    molecules: {},
  }
  const codeBlocks: { language: string; code: string }[] = []

  for (const { chart, compact } of chartsIn(lesson))
    prepared.charts![chartKey(chart, compact)] = renderChart(chart, compact)

  for (const d2 of diagramsIn(lesson)) {
    try {
      prepared.diagrams![diagramKey(d2)] = await renderDiagram(d2)
    } catch {
      // checkDiagrams() rejects D2 that doesn't compile; anything else shows its alt text instead.
    }
  }

  for (const { visual } of everyVisual(lesson)) {
    if (visual.kind !== "molecule") continue
    try {
      prepared.molecules![moleculeKey(visual)] = renderMolecule(visual)
    } catch {
      // checkMolecules() rejects SMILES that can't be read; anything else shows its alt text instead.
    }
  }

  walk(lesson, (value, key, parent) => {
    if (typeof value === "string") {
      if (key === "tex") {
        prepared.math[mathKey(value, true)] = katex.renderToString(value, {
          displayMode: true,
          throwOnError: false,
        })
      } else if (
        !["html", "css", "code", "d2", "smiles", "highlight"].includes(key)
      ) {
        for (const m of value.matchAll(INLINE_MATH)) {
          const tex = m[1]!.trim()
          prepared.math[mathKey(tex, false)] = katex.renderToString(tex, {
            throwOnError: false,
          })
        }
      }
    }
    if (
      parent &&
      (parent as { kind?: string }).kind === "code" &&
      key === "code" &&
      typeof value === "string"
    ) {
      codeBlocks.push({
        language: (parent as { language: string }).language,
        code: value,
      })
    }
  })

  if (codeBlocks.length) {
    const h = await getHighlighter([
      ...new Set(codeBlocks.map((c) => c.language)),
    ])
    for (const { language, code } of codeBlocks) {
      if (!loadedLanguages.has(language)) continue
      const { tokens } = h.codeToTokens(code, {
        lang: language as BundledLanguage,
        themes: THEMES,
      })
      prepared.code[codeKey(language, code)] = tokens.map((line) =>
        line.map((t) => ({
          content: t.content,
          style: t.htmlStyle as Record<string, string> | undefined,
        }))
      )
    }
  }

  return prepared
}

/** The lesson's diagram sources, each once. */
function diagramsIn(lesson: Lesson): string[] {
  const sources = everyVisual(lesson).flatMap(({ visual }) =>
    visual.kind === "diagram" ? [visual.d2] : []
  )
  return [...new Set(sources)]
}

/**
 * The publish-time checks for diagram visuals, which need D2 itself and so can't live in the
 * spec's rules: D2 that doesn't compile, and what the lesson page can't show (see checkDiagram).
 */
export async function checkDiagrams(lesson: Lesson): Promise<Issue[]> {
  const issues: Issue[] = []
  for (const { visual, path } of everyVisual(lesson)) {
    if (visual.kind !== "diagram") continue
    for (const message of await checkDiagram(visual.d2))
      issues.push({ kind: "structure", path: `${path}.d2`, message })
  }
  return issues
}

/**
 * The publish-time check for icon classes in HTML visuals (icon-[lucide--git-branch]), which
 * needs the icon sets and so can't live in the spec's rules: each named icon must exist, or the
 * learner sees an empty box where the picture should be.
 */
export async function checkIcons(lesson: Lesson): Promise<Issue[]> {
  const issues: Issue[] = []
  for (const { visual, path } of everyVisual(lesson)) {
    if (visual.kind !== "html") continue
    const seen = new Set<string>()
    for (const className of visualClasses({ html: visual.html })) {
      const ref = parseIconClass(className)
      if (!ref || seen.has(className)) continue
      seen.add(className)
      if (await iconExists(ref)) continue
      const close = (await suggestIcons(ref)).map(
        (s) => `icon-[${s.replace("/", "--")}]`
      )
      issues.push({
        kind: "structure",
        path: `${path}.html`,
        message:
          `The icon ${className} doesn't exist.` +
          (close.length
            ? ` Did you mean ${close.join(", ")}?`
            : ` Icons are icon-[set--name] with a set from lucide, octicon, simple-icons, logos, or vscode-icons.`),
      })
    }
  }
  return issues
}

/**
 * The publish-time checks for molecule visuals, which need OpenChemLib and so can't live in the
 * spec's rules: a SMILES that can't be read or is too big, and highlights that match nothing.
 */
export function checkMolecules(lesson: Lesson): Issue[] {
  return everyVisual(lesson).flatMap(({ visual, path }) =>
    visual.kind === "molecule"
      ? checkMolecule(visual).map(({ field, message }) => ({
          kind: "structure" as const,
          path: `${path}.${field}`,
          message,
        }))
      : []
  )
}

/** Every publish-time check that needs the server: function charts, diagrams, molecules, and icons. */
export async function checkVisuals(lesson: Lesson): Promise<Issue[]> {
  return [
    ...checkFunctionCharts(lesson),
    ...(await checkDiagrams(lesson)),
    ...checkMolecules(lesson),
    ...(await checkIcons(lesson)),
  ]
}

function walk(
  value: unknown,
  visit: (value: unknown, key: string, parent: unknown) => void,
  key = "",
  parent: unknown = null
) {
  visit(value, key, parent)
  if (Array.isArray(value)) value.forEach((v) => walk(v, visit, key, parent))
  else if (value && typeof value === "object")
    for (const [k, v] of Object.entries(value)) walk(v, visit, k, value)
}
