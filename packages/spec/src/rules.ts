import katex from "katex"

import type { Brick, Lesson, QuestionBrick, Visual } from "./schema"

// Rules the schema can't express: cross-references, teaching quality, v1 limits, and safety.
// Every message says what's wrong and how to fix it, so an LLM can correct the lesson on its own.

export type IssueKind = "structure" | "teaching" | "v1" | "safety"

export interface Issue {
  path: string
  message: string
  kind: IssueKind
}

export const LIMITS = {
  /** Series a chart visual can show (lines on a line chart, colors on a scatter). */
  chartSeries: 3,
  concepts: { min: 1, max: 4 },
  /** Question bricks after each concept brick. */
  practicePerConcept: { min: 2, max: 4 },
  practiceTotal: { min: 3, max: 12 },
  promptWords: 40,
  /** An explanation is shown in the ninja's speech bubble, so it stays short. */
  explanationWords: 30,
  conceptBodyWords: 80,
  htmlVisualBytes: 20 * 1024,
  lessonBytes: 500 * 1024,
} as const

/** A question brick together with where it sits in the lesson, in play order. */
interface PlacedQuestion {
  brick: QuestionBrick
  path: string
}

function placedQuestions(lesson: Lesson): PlacedQuestion[] {
  const practice: PlacedQuestion[] = []
  lesson.bricks.forEach((brick, i) => {
    if (brick.type !== "concept") practice.push({ brick, path: `bricks[${i}]` })
  })
  return [
    { brick: lesson.hook, path: "hook" },
    ...practice,
    { brick: lesson.challenge, path: "challenge" },
  ]
}

/**
 * A phrase that names an answer by where it sits ("the second statement", "option B"), or null.
 * English only, and narrow on purpose: "the right answer" or "the third step" are fine.
 */
export function positionalReference(text: string): string | null {
  const plain = text.replace(/[*`]/g, "")
  const ordinal =
    /\bthe\s+(?:first|second|third|fourth|last|top|bottom)\s+(?:option|answer|choice|statement|one|explanation|message|example|version|card|pick)s?\b/i
  const lettered =
    /\b(?:[Oo]ption|[Aa]nswer|[Cc]hoice|[Pp]lot|[Cc]hart|[Gg]raph|[Vv]ersion)\s+(?:[A-D]|[1-9])\b/
  return (plain.match(ordinal) ?? plain.match(lettered))?.[0] ?? null
}

const countWords = (s: string) =>
  s.replace(/[*`]/g, "").trim().split(/\s+/).filter(Boolean).length

function duplicates(values: string[]): string[] {
  const seen = new Set<string>()
  const dupes = new Set<string>()
  for (const v of values) (seen.has(v) ? dupes : seen).add(v)
  return [...dupes]
}

const sameSet = (a: string[], b: string[]) =>
  a.length === b.length && a.every((x) => b.includes(x))

/** Ids of the tappable regions in a hotspot visual. */
function hotspotIds(v: Visual): string[] {
  if (v.kind === "html")
    return [...v.html.matchAll(/data-hotspot\s*=\s*["']([^"']+)["']/g)].map(
      (m) => m[1]!
    )
  if (v.kind === "code") return (v.hotspots ?? []).map((h) => h.id)
  return []
}

export function checkLesson(lesson: Lesson, raw: string): Issue[] {
  const issues: Issue[] = []
  const add = (kind: IssueKind, path: string, message: string) =>
    issues.push({ kind, path, message })
  const questions = placedQuestions(lesson)

  // ---------- structure ----------

  checkRhythm(lesson, add)

  const lessonIds = [lesson.hook, ...lesson.bricks, lesson.challenge].map(
    (b) => b.id
  )
  for (const dupe of duplicates(lessonIds)) {
    add(
      "structure",
      "",
      `The id "${dupe}" is used more than once. Every brick id must be unique within the lesson.`
    )
  }

  for (const { brick, path } of questions)
    checkBrickReferences(brick, path, add)

  // ---------- v1 limits ----------

  for (const { brick, path } of questions) {
    if (brick.type === "number") {
      add(
        "v1",
        path,
        "Number bricks aren't supported in v1. Rewrite this as a choice brick whose wrong options come from common mistakes, each with feedback."
      )
    }
    if (brick.type === "blank") {
      brick.blanks.forEach((b, i) => {
        if (!b.choices) {
          add(
            "v1",
            `${path}.blanks[${i}]`,
            `Blank "${b.id}" has no choices. Typed answers aren't supported in v1: add a "choices" word bank that includes the accepted answer and one or two decoys.`
          )
        }
      })
    }
  }

  // ---------- teaching quality ----------

  for (const { brick, path } of questions) {
    const explanationWords = countWords(brick.explanation)
    if (explanationWords > LIMITS.explanationWords) {
      add(
        "teaching",
        `${path}.explanation`,
        `The explanation has ${explanationWords} words; keep it to ${LIMITS.explanationWords} or fewer. Apply the idea to this question in a sentence or two; don't restate the concept.`
      )
    }
    if (countWords(brick.prompt) > LIMITS.promptWords) {
      add(
        "teaching",
        `${path}.prompt`,
        `The prompt has ${countWords(brick.prompt)} words; keep it to ${LIMITS.promptWords} or fewer.`
      )
    }
    if (brick.type === "choice" || brick.type === "compare") {
      const correct = brick.type === "choice" ? brick.correct : [brick.correct]
      brick.options.forEach((o, i) => {
        if (!correct.includes(o.id) && !o.feedback) {
          add(
            "teaching",
            `${path}.options[${i}]`,
            `Wrong option "${o.id}" has no feedback. Explain why it's wrong, so the learner learns from the mistake.`
          )
        }
      })
    }
  }

  // The player shuffles options (and a match's right column), so "the second statement" can point
  // at the wrong one on screen. Explanations and feedback have to name an option by what it says.
  for (const { brick, path } of questions) {
    if (
      brick.type !== "choice" &&
      brick.type !== "compare" &&
      brick.type !== "scenario" &&
      brick.type !== "match"
    )
      continue
    const texts: [string, string | undefined][] = [
      [`${path}.explanation`, brick.explanation],
      [`${path}.hint`, brick.hint],
      ...(brick.type === "match"
        ? []
        : brick.options.flatMap((o, i): [string, string | undefined][] => [
            [
              `${path}.options[${i}].feedback`,
              "feedback" in o ? o.feedback : undefined,
            ],
            [
              `${path}.options[${i}].outcome`,
              "outcome" in o ? o.outcome : undefined,
            ],
          ])),
    ]
    for (const [where, text] of texts) {
      const found = text ? positionalReference(text) : null
      if (found)
        add(
          "teaching",
          where,
          `"${found}" points at an option by its place, but the player shuffles the options, so it can name the wrong one. Name the option by what it says instead.`
        )
    }
  }

  // A brick's HTML visual is a picture to a screen reader, so it needs alt text. (Hotspot visuals
  // are read through their tappable regions, item visuals through their captions, and option
  // visuals below.)
  const withVisuals = [
    ...lesson.bricks.flatMap((b, i) =>
      b.type === "concept" ? [{ brick: b, path: `bricks[${i}]` }] : []
    ),
    ...questions.filter((q) => q.brick.type !== "hotspot"),
  ]
  for (const { brick, path } of withVisuals) {
    const v = brick.visual
    if (v && v.kind !== "code" && v.kind !== "math" && !v.alt)
      add(
        "teaching",
        `${path}.visual`,
        `This ${visualName(v)} has no "alt". Add one sentence saying what it shows, for people using a screen reader.`
      )
  }

  // An option's visual is read through its alt, or its caption when it has one. A caption is for
  // what the visual can't say, so most visual options have an alt and no caption.
  for (const { brick, path } of questions) {
    if (brick.type !== "choice" && brick.type !== "compare") continue
    brick.options.forEach((o, j) => {
      const v = o.visual
      if (v && v.kind !== "code" && v.kind !== "math" && !v.alt && !o.text)
        add(
          "teaching",
          `${path}.options[${j}].visual`,
          `This option's ${visualName(v)} has no "alt" and no caption. Add an "alt": one sentence saying what it shows, for people using a screen reader.`
        )
    })
  }

  // Charts: the data has to fit the chart type, or it can't be drawn as meant.
  for (const { visual, path } of everyVisual(lesson)) {
    if (visual.kind !== "chart") continue
    const { type, data } = visual
    const numeric = data.filter((d) => typeof d.x === "number").length
    if (type === "scatter" && numeric < data.length)
      add(
        "structure",
        path,
        `A scatter chart needs a number for every point's "x".`
      )
    if (type !== "scatter" && numeric > 0 && numeric < data.length)
      add(
        "structure",
        path,
        `Give every point the same kind of "x": all numbers or all category names.`
      )
    if (type !== "scatter" && data.some((d) => d.label))
      add("structure", path, `Point labels are only for scatter charts.`)
    if (type !== "scatter" && visual.trend)
      add("structure", path, `"trend" is only for scatter charts.`)
    const series = new Set(data.map((d) => d.series ?? ""))
    if (type === "bar" && data.some((d) => d.series))
      add(
        "structure",
        path,
        `A bar chart has one series: drop "series" from its points.`
      )
    if (series.size > LIMITS.chartSeries)
      add(
        "structure",
        path,
        `A chart can have at most ${LIMITS.chartSeries} series; this one has ${series.size}.`
      )
    if (type !== "scatter")
      for (const name of series) {
        const xs = data
          .filter((d) => (d.series ?? "") === name)
          .map((d) => String(d.x))
        const twice = duplicates(xs)
        if (twice.length)
          add(
            "structure",
            path,
            `${type === "bar" ? "A bar" : "A line"} chart has one point per "x"${name ? ` in series "${name}"` : ""}; "${twice[0]}" appears more than once.`
          )
      }
  }

  lesson.bricks.forEach((brick, i) => {
    if (brick.type !== "concept") return
    const words = countWords(brick.body)
    if (words > LIMITS.conceptBodyWords) {
      add(
        "teaching",
        `bricks[${i}].body`,
        `The concept body has ${words} words; keep it to ${LIMITS.conceptBodyWords} or fewer and one idea only.`
      )
    }
  })

  // ---------- languages ----------

  for (const [path, code] of languageCodes(lesson)) {
    try {
      Intl.getCanonicalLocales(code)
    } catch {
      add(
        "structure",
        path,
        `"${code}" isn't a valid BCP 47 language code. Use codes like "en", "es", "ar", or "pt-BR".`
      )
    }
  }

  // ---------- formulas ----------

  walkStrings(lesson, "", (value, path) => {
    if (/\.(html|css|code|d2)$/.test(path)) return
    if (path.endsWith(".tex")) return checkFormula(value, path, add)
    const opens = value.split("\\(").length - 1
    const closes = value.split("\\)").length - 1
    if (opens !== closes) {
      add(
        "structure",
        path,
        `Unbalanced inline formula: ${opens} "\\(" and ${closes} "\\)". Wrap each formula as \\( ... \\).`
      )
      return
    }
    for (const m of value.matchAll(/\\\(([\s\S]*?)\\\)/g))
      checkFormula(m[1]!, path, add)
  })

  // ---------- safety and size ----------

  walkVisuals(lesson, (v, path) => {
    if (v.kind !== "html") return
    const html = v.html
    if (/<\s*script\b/i.test(html))
      add(
        "safety",
        `${path}.html`,
        "Visuals can't contain <script>. Use plain HTML and CSS only."
      )
    if (/<\s*(iframe|form|object|embed|frame)\b/i.test(html))
      add(
        "safety",
        `${path}.html`,
        "Visuals can't contain iframes, forms, objects, or embeds."
      )
    if (/\son[a-z]+\s*=/i.test(html))
      add(
        "safety",
        `${path}.html`,
        "Visuals can't contain event handlers (onclick and similar)."
      )
    if (/javascript\s*:/i.test(html))
      add("safety", `${path}.html`, "Visuals can't contain javascript: URLs.")
    const external =
      /(?:src|href|srcset|action)\s*=\s*["']?\s*(?:https?:)?\/\/|url\(\s*["']?\s*(?:https?:)?\/\//i
    if (
      external.test(html) ||
      (v.css && external.test(v.css)) ||
      (v.css && /@import/i.test(v.css))
    ) {
      add(
        "safety",
        path,
        "Visuals can't load anything from external URLs. Use the built-in UI kit, inline SVG, and CSS only."
      )
    }
    const bytes = new TextEncoder().encode(html + (v.css ?? "")).length
    if (bytes > LIMITS.htmlVisualBytes) {
      add(
        "safety",
        path,
        `This visual is ${Math.round(bytes / 1024)} KB; keep each HTML visual under ${LIMITS.htmlVisualBytes / 1024} KB.`
      )
    }
  })

  const lessonBytes = new TextEncoder().encode(raw).length
  if (lessonBytes > LIMITS.lessonBytes) {
    add(
      "safety",
      "",
      `The lesson file is ${Math.round(lessonBytes / 1024)} KB; keep it under ${LIMITS.lessonBytes / 1024} KB.`
    )
  }

  return issues
}

/** Teach, then practise: concept bricks, each followed by the question bricks that practise it. */
function checkRhythm(
  lesson: Lesson,
  add: (k: IssueKind, p: string, m: string) => void
) {
  const { concepts, practicePerConcept, practiceTotal } = LIMITS
  const conceptAt = lesson.bricks.flatMap((b, i) =>
    b.type === "concept" ? [i] : []
  )
  if (lesson.bricks[0]?.type !== "concept") {
    add(
      "structure",
      "bricks[0]",
      `The first brick must be a concept brick. Teach the idea first, then add the question bricks that practise it.`
    )
  }
  if (conceptAt.length < concepts.min || conceptAt.length > concepts.max) {
    add(
      "structure",
      "bricks",
      `The lesson has ${conceptAt.length} concept bricks; it needs ${concepts.min}–${concepts.max}, one idea each.`
    )
  }
  conceptAt.forEach((at, n) => {
    const next = conceptAt[n + 1] ?? lesson.bricks.length
    const count = next - at - 1
    if (count < practicePerConcept.min || count > practicePerConcept.max) {
      const id = lesson.bricks[at]!.id
      add(
        "structure",
        `bricks[${at}]`,
        `Concept brick "${id}" is followed by ${count} question bricks; it needs ${practicePerConcept.min}–${practicePerConcept.max} before the next concept brick or the challenge.`
      )
    }
  })
  const practiceCount = lesson.bricks.length - conceptAt.length
  if (practiceCount < practiceTotal.min || practiceCount > practiceTotal.max) {
    add(
      "structure",
      "bricks",
      `The lesson has ${practiceCount} practice bricks in total; it needs ${practiceTotal.min}–${practiceTotal.max}. Add or remove question bricks (${practicePerConcept.min}–${practicePerConcept.max} after each concept brick).`
    )
  }
}

function checkBrickReferences(
  brick: QuestionBrick,
  path: string,
  add: (k: IssueKind, p: string, m: string) => void
) {
  switch (brick.type) {
    case "choice": {
      const ids = brick.options.map((o) => o.id)
      for (const d of duplicates(ids))
        add(
          "structure",
          `${path}.options`,
          `Option id "${d}" is used more than once.`
        )
      for (const c of brick.correct)
        if (!ids.includes(c))
          add(
            "structure",
            `${path}.correct`,
            `"${c}" isn't one of this brick's option ids (${ids.join(", ")}).`
          )
      if (!brick.multiple && brick.correct.length !== 1)
        add(
          "structure",
          `${path}.correct`,
          `With "multiple": false, "correct" must list exactly one option id.`
        )
      if (brick.correct.length >= ids.length)
        add("teaching", `${path}.correct`, "At least one option must be wrong.")
      break
    }
    case "compare": {
      const ids = brick.options.map((o) => o.id)
      for (const d of duplicates(ids))
        add(
          "structure",
          `${path}.options`,
          `Option id "${d}" is used more than once.`
        )
      if (!ids.includes(brick.correct))
        add(
          "structure",
          `${path}.correct`,
          `"${brick.correct}" isn't one of this brick's option ids (${ids.join(", ")}).`
        )
      break
    }
    case "scenario": {
      const ids = brick.options.map((o) => o.id)
      for (const d of duplicates(ids))
        add(
          "structure",
          `${path}.options`,
          `Option id "${d}" is used more than once.`
        )
      if (!brick.options.some((o) => o.quality === "best"))
        add(
          "teaching",
          `${path}.options`,
          `A scenario needs at least one option with "quality": "best".`
        )
      break
    }
    case "order": {
      const ids = brick.items.map((i) => i.id)
      for (const d of duplicates(ids))
        add(
          "structure",
          `${path}.items`,
          `Item id "${d}" is used more than once.`
        )
      ;(brick.alsoAccept ?? []).forEach((alt, i) => {
        if (!sameSet(alt, ids))
          add(
            "structure",
            `${path}.alsoAccept[${i}]`,
            `Each alternative order must list every item id exactly once (${ids.join(", ")}).`
          )
      })
      break
    }
    case "sort": {
      const groupIds = brick.groups.map((g) => g.id)
      for (const d of duplicates(groupIds))
        add(
          "structure",
          `${path}.groups`,
          `Group id "${d}" is used more than once.`
        )
      for (const d of duplicates(brick.items.map((i) => i.id)))
        add(
          "structure",
          `${path}.items`,
          `Item id "${d}" is used more than once.`
        )
      brick.items.forEach((it, i) => {
        if (!groupIds.includes(it.group))
          add(
            "structure",
            `${path}.items[${i}].group`,
            `"${it.group}" isn't one of this brick's group ids (${groupIds.join(", ")}).`
          )
      })
      break
    }
    case "blank": {
      const gaps = [...brick.template.matchAll(/\[\[([^\]]+)\]\]/g)].map(
        (m) => m[1]!
      )
      const blankIds = brick.blanks.map((b) => b.id)
      for (const d of duplicates(blankIds))
        add(
          "structure",
          `${path}.blanks`,
          `Blank id "${d}" is used more than once.`
        )
      for (const d of duplicates(gaps))
        add(
          "structure",
          `${path}.template`,
          `The gap [[${d}]] appears more than once in the template.`
        )
      for (const g of gaps)
        if (!blankIds.includes(g))
          add(
            "structure",
            `${path}.template`,
            `The gap [[${g}]] has no matching entry in "blanks".`
          )
      for (const b of blankIds)
        if (!gaps.includes(b))
          add(
            "structure",
            `${path}.blanks`,
            `Blank "${b}" doesn't appear in the template as [[${b}]].`
          )
      brick.blanks.forEach((b, i) => {
        if (b.choices && !b.accept.some((a) => b.choices!.includes(a))) {
          add(
            "structure",
            `${path}.blanks[${i}].choices`,
            `None of blank "${b.id}"'s accepted answers is among its choices, so it can't be answered. Add "${b.accept[0]}" to "choices".`
          )
        }
      })
      break
    }
    case "hotspot": {
      const ids = hotspotIds(brick.visual)
      if (ids.length === 0)
        add(
          "structure",
          `${path}.visual`,
          `A hotspot visual needs tappable regions: data-hotspot="id" attributes in html, or "hotspots" on a code visual.`
        )
      for (const d of duplicates(ids))
        add(
          "structure",
          `${path}.visual`,
          `Hotspot id "${d}" is used more than once.`
        )
      for (const c of brick.correct)
        if (!ids.includes(c))
          add(
            "structure",
            `${path}.correct`,
            `"${c}" isn't one of this visual's hotspot ids (${ids.join(", ") || "none"}).`
          )
      if (!brick.multiple && brick.correct.length !== 1)
        add(
          "structure",
          `${path}.correct`,
          `With "multiple": false, "correct" must list exactly one hotspot id.`
        )
      if (brick.visual.kind === "code") {
        const lines = brick.visual.code.split("\n").length
        ;(brick.visual.hotspots ?? []).forEach((h, i) => {
          if (h.line > lines)
            add(
              "structure",
              `${path}.visual.hotspots[${i}]`,
              `Line ${h.line} doesn't exist; the code has ${lines} lines.`
            )
        })
      }
      break
    }
    default:
      break
  }
}

function checkFormula(
  tex: string,
  path: string,
  add: (k: IssueKind, p: string, m: string) => void
) {
  try {
    katex.renderToString(tex, { throwOnError: true })
  } catch (e) {
    add(
      "structure",
      path,
      `This formula doesn't render: ${(e as Error).message.replace(/^KaTeX parse error: /, "")}`
    )
  }
}

function languageCodes(lesson: Lesson): [string, string][] {
  const found: [string, string][] = [["language", lesson.language]]
  if (lesson.targetLanguage)
    found.push(["targetLanguage", lesson.targetLanguage])
  walkObjects(lesson, "", (obj, path) => {
    for (const key of ["lang", "leftLang", "rightLang"] as const) {
      const v = obj[key]
      if (typeof v === "string") found.push([path ? `${path}.${key}` : key, v])
    }
  })
  return found
}

function walkObjects(
  value: unknown,
  path: string,
  visit: (obj: Record<string, unknown>, path: string) => void
) {
  if (Array.isArray(value))
    value.forEach((v, i) => walkObjects(v, `${path}[${i}]`, visit))
  else if (value && typeof value === "object") {
    visit(value as Record<string, unknown>, path)
    for (const [k, v] of Object.entries(value))
      walkObjects(v, path ? `${path}.${k}` : k, visit)
  }
}

function walkStrings(
  value: unknown,
  path: string,
  visit: (s: string, path: string) => void
) {
  if (typeof value === "string") visit(value, path)
  else if (Array.isArray(value))
    value.forEach((v, i) => walkStrings(v, `${path}[${i}]`, visit))
  else if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value))
      walkStrings(v, path ? `${path}.${k}` : k, visit)
  }
}

function walkVisuals(lesson: Lesson, visit: (v: Visual, path: string) => void) {
  walkObjects(lesson, "", (obj, path) => {
    if (obj.kind === "html" || obj.kind === "code" || obj.kind === "math")
      visit(obj as unknown as Visual, path)
  })
}

/** What a visual is called in messages. */
const visualName = (v: Visual) =>
  v.kind === "html" ? "HTML visual" : v.kind === "chart" ? "chart" : v.kind

/** Every visual in the lesson with its path: on bricks, on options, and on items. */
export function everyVisual(lesson: Lesson): { visual: Visual; path: string }[] {
  const out: { visual: Visual; path: string }[] = []
  const bricks: { brick: Brick; path: string }[] = [
    { brick: lesson.hook, path: "hook" },
    ...lesson.bricks.map((brick, i) => ({ brick, path: `bricks[${i}]` })),
    { brick: lesson.challenge, path: "challenge" },
  ]
  for (const { brick, path } of bricks) {
    if ("visual" in brick && brick.visual)
      out.push({ visual: brick.visual, path: `${path}.visual` })
    if ("options" in brick)
      brick.options.forEach((o, j) => {
        if ("visual" in o && o.visual)
          out.push({ visual: o.visual, path: `${path}.options[${j}].visual` })
      })
    if ("items" in brick)
      brick.items.forEach((it, j) => {
        if ("visual" in it && it.visual)
          out.push({ visual: it.visual, path: `${path}.items[${j}].visual` })
      })
  }
  return out
}
