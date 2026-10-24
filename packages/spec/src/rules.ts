import katex from "katex"

import { pieceOn, readFen } from "./chess"
import { COUNTRIES, NOT_ON_MAP } from "./countries"
import { DRAWN_SIZES } from "./map-sizes"
import {
  boxesOverlap,
  describeBox,
  inBox,
  MAP_MIN_TAP,
  MAP_REGION_NAMES,
  MAP_REGIONS,
  type Box,
  type MapRegion,
} from "./map"
import {
  LEVELS,
  type Brick,
  type Lesson,
  type QuestionBrick,
  type Visual,
} from "./schema"
import { normalizeTag } from "./tags"
import { listItem, textBlocks } from "./text"

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
  /** Colors a map can shade countries in, each named in its legend. */
  mapGroups: 3,
  /** Numbered ticks on a number line, so the numbers stay readable on a phone. */
  numberLineTicks: 21,
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

// Code that the lesson's text leaves outside backticks. Each pattern is narrow on purpose: a
// command with a known subcommand, a long flag, a call, a file name with a code extension, a path,
// or an HTML tag. Prose that merely mentions git or python is left alone.
const SUBCOMMANDS: Record<string, string[]> = {
  git: "add commit push pull fetch clone status checkout switch branch merge rebase log diff stash reset init remote tag restore".split(
    " "
  ),
  npm: "install i uninstall run test start init ci publish update create exec".split(
    " "
  ),
  npx: ["*"],
  pnpm: "add install i run dev build test exec dlx".split(" "),
  yarn: "add install run dev build test".split(" "),
  pip: "install uninstall freeze list".split(" "),
  pip3: "install uninstall freeze list".split(" "),
  docker: "run build ps pull push compose exec images stop start logs".split(
    " "
  ),
  kubectl: "get apply delete describe logs exec".split(" "),
  brew: "install update upgrade uninstall".split(" "),
  apt: "install update upgrade remove".split(" "),
  "apt-get": "install update upgrade remove".split(" "),
  cargo: "build run test add new".split(" "),
  sudo: ["*"],
  chmod: ["*"],
}
const COMMAND =
  /(?<![\w./-])(git|npm|npx|pnpm|yarn|pip3?|docker|kubectl|brew|apt(?:-get)?|cargo|sudo|chmod)\s+(--?[\w-]+|[\w./~-]+)/g
const BARE_CODE: RegExp[] = [
  // cd, ls, and mkdir followed by a path or a flag
  /(?<![\w./-])(?:cd|ls|mkdir)\s+(?:--?[\w-]+|[\w-]*[./~][\w./~-]*)/,
  /(?<![\w-])--[a-z][\w-]*\b/,
  /\b[A-Za-z_]\w*(?:\.[A-Za-z_]\w*)*\(\)/,
  /(?<!\S)(?:~|\.{1,2})?\/[\w.-]+(?:\/[\w.-]+)+/,
  /(?<!\S)~\/[\w.-]+/,
  // relative paths: a file in a folder, or three or more segments ("and/or" and "3/4" are left alone)
  /(?<![\w./-])[A-Za-z_][\w-]*(?:\/[\w-]+)*\/[\w-]+\.[A-Za-z]\w*\b/,
  /(?<![\w./-])[A-Za-z_][\w-]*(?:\/[\w-]+){2,}\b/,
  /(?<![\w.])[\w-]+\.(?:json|[cm]?jsx?|tsx?|py|rb|rs|java|kt|swift|s?css|html?|mdx?|ya?ml|toml|sh|sql|csv|lock)\b/,
  /(?<!\S)\.env\b/,
  /<\/?[a-z][\w-]*\s*\/?>/,
]

/**
 * A piece of code (a command, flag, call, file name, path, or tag) written outside backticks,
 * or null. Text already in backticks or formulas is ignored.
 */
export function bareCode(text: string): string | null {
  const plain = text
    .replace(/`[^`]*`/g, " ")
    .replace(/\\\((?:.|\n)*?\\\)/g, " ")
  for (const m of plain.matchAll(COMMAND)) {
    const [whole, tool, arg] = m as unknown as [string, string, string]
    const known = SUBCOMMANDS[tool] ?? []
    if (known.includes("*") || known.includes(arg) || arg.startsWith("-"))
      return whole
  }
  for (const re of BARE_CODE) {
    const found = plain.match(re)?.[0]
    // Node.js, Vue.js, and friends are names, not files.
    if (found && !/^[A-Z]\w*\.js$/.test(found)) return found
  }
  return null
}

/** The rich-text fields a learner reads, so the keys where code should sit in backticks. */
const RICH_TEXT_KEYS = new Set([
  "prompt",
  "text",
  "feedback",
  "hint",
  "explanation",
  "situation",
  "outcome",
  "left",
  "right",
  "body",
  "takeaways",
])

const countWords = (s: string) =>
  s
    .replace(/^\s*(?:[-*]|\d{1,3}[.)])\s+/gm, "")
    .replace(/[*`]/g, "")
    .trim()
    .split(/\s+/)
    .filter(Boolean).length

/**
 * Markdown the player doesn't show, which would reach the learner as raw symbols, with what to use
 * instead. Lists are checked apart, since a concept body may have them.
 */
function unsupportedMarkdown(text: string): string | null {
  if (/^\s*(```|~~~)/m.test(text))
    return 'Code blocks don\'t show in lesson text. Put the code in a "code" visual, or a short piece in backticks.'
  // Code and formulas may hold # or |, so they're left out of the rest.
  const prose = text.replace(/\\\([\s\S]*?\\\)|`[^`\n]*`/g, "")
  if (/^\s*#{1,6}\s/m.test(prose))
    return "Headings don't show in lesson text: a concept's title is its heading. Start the line without #, or split the idea into another concept brick."
  if (/!?\[[^\]\n]+\]\([^)\n]*\)/.test(prose))
    return "Links and images don't show in lesson text, and a lesson never sends the learner elsewhere. Name a source in words, and draw a picture as a visual."
  if (/^\s*\|.*\|\s*$/m.test(prose) || /\|\s*:?-{3,}/.test(prose))
    return "Tables don't show in lesson text. Put the table in an HTML visual (3 columns at most, so it fits a phone)."
  // HTML tags are caught by bareCode, which asks for backticks.
  return null
}

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
  if (v.kind === "chess") return CHESS_SQUARES
  if (v.kind === "map") return Object.keys(DRAWN_SIZES[v.region ?? "world"])
  return []
}

/** Every square on a chess board, a1 to h8: on a chess hotspot, each one is tappable. */
const CHESS_SQUARES = [..."abcdefgh"].flatMap((f) =>
  [1, 2, 3, 4, 5, 6, 7, 8].map((r) => `${f}${r}`)
)

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
    checkBrickReferences(brick, path, add, lesson.language)

  // ---------- tags ----------

  // Tags are labels; the rules compare their keys (normalizeTag: spelling folded, synonyms mapped),
  // never the labels, so "JavaScript" next to "JS" is one tag twice. The subject, level, and
  // languages are fields already, so a tag whose key repeats one says nothing.
  const keys = lesson.tags.map((label) => normalizeTag(label))
  lesson.tags.forEach((label, i) => {
    const why = redundantTag(keys[i]!, lesson, label)
    if (why) add("structure", `tags[${i}]`, why)
  })
  for (const dupe of duplicates(keys)) {
    const labels = lesson.tags.filter((_, i) => keys[i] === dupe)
    const same = labels.every((l) => l === labels[0])
    add(
      "structure",
      "tags",
      same
        ? `The tag "${labels[0]}" appears more than once. Keep it once.`
        : `The tags ${labels.map((l) => `"${l}"`).join(" and ")} are the same tag ("${dupe}"). Keep one.`
    )
  }

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

  // Code outside backticks shows as plain text, so `git push` in a match pair or an option reads
  // like prose. Visuals are skipped: their html, code, and d2 are code by nature.
  walkRichText(lesson, (text, where) => {
    const found = bareCode(text)
    if (found)
      add(
        "teaching",
        where,
        `"${found}" looks like code, but it isn't in backticks, so it shows as plain text. Wrap commands, flags, file names, paths, tags, and code in backticks (\`${found}\`) so they render in monospace.`
      )
  })

  // Only a concept body has paragraphs and lists; everywhere else, list markers would show as is.
  walkRichText(lesson, (text, where) => {
    const markdown = unsupportedMarkdown(text)
    if (markdown) return add("structure", where, markdown)
    const isBody = /^bricks\[\d+\]\.body$/.test(where)
    const blocks = textBlocks(text)
    if (!isBody && blocks.some((b) => b.kind === "list"))
      add(
        "structure",
        where,
        where.endsWith(".explanation")
          ? "Only a concept's body can hold a list. Put each step of an explanation on its own line, without a marker."
          : "Only a concept's body can hold a list. Write this as a sentence, or move the list into the concept it practises."
      )
    // A lone "- " line shows its dash, which is usually a list written with one item or on one line.
    const lone = blocks.find(
      (b) => b.kind === "paragraph" && listItem(b.text)?.ordered === false
    )
    if (isBody && lone)
      add(
        "structure",
        where,
        'A list needs two or more items, each on its own line starting with "- " (in JSON, "\\n- "). Make it a list, or write the line as a sentence.'
      )
  })

  // A brick's HTML visual is a picture to a screen reader, so it needs alt text. (Hotspot visuals
  // are read through their tappable regions, item visuals through their captions, and option
  // visuals below. A chess or map hotspot's regions are only names, so its alt describes the
  // picture.)
  const withVisuals = [
    ...lesson.bricks.flatMap((b, i) =>
      b.type === "concept" ? [{ brick: b, path: `bricks[${i}]` }] : []
    ),
    ...questions.filter(
      (q) =>
        q.brick.type !== "hotspot" ||
        q.brick.visual.kind === "chess" ||
        q.brick.visual.kind === "map"
    ),
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
    if (visual.type === "function") {
      // The expressions themselves are read at publish time (the player's checkFunctionCharts).
      const { x, y } = visual
      if (!(x.min < x.max))
        add(
          "structure",
          path,
          `A function chart's "x.min" (${x.min}) must be less than its "x.max" (${x.max}).`
        )
      if (y?.min !== undefined && y?.max !== undefined && !(y.min < y.max))
        add(
          "structure",
          path,
          `A function chart's "y.min" (${y.min}) must be less than its "y.max" (${y.max}).`
        )
      const curves = visual.series ?? []
      if (curves.length === 0 && !visual.points)
        add(
          "structure",
          path,
          `A function chart needs curves in "series", points in "points", or both.`
        )
      const labels = curves.map((s) => s.label ?? s.expression)
      const twice = duplicates(labels)
      if (twice.length)
        add(
          "structure",
          path,
          `Each curve of a function chart needs its own label; "${twice[0]}" is used twice.`
        )
      // A point outside the axes isn't drawn, which a question about it can't survive.
      visual.points?.forEach((p, j) => {
        const outside =
          p.x < x.min ||
          p.x > x.max ||
          (y?.min !== undefined && p.y < y.min) ||
          (y?.max !== undefined && p.y > y.max)
        if (outside)
          add(
            "structure",
            `${path}.points[${j}]`,
            `The point (${p.x}, ${p.y}) is outside the chart's range; widen "x" or "y", or move the point.`
          )
      })
      continue
    }
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

  // Number lines: ticks that fit, and everything marked on them inside the line.
  for (const { visual, path } of everyVisual(lesson)) {
    if (visual.kind !== "numberline") continue
    const { min, max } = visual
    if (!(min < max)) {
      add(
        "structure",
        path,
        `A number line's "min" (${min}) must be less than its "max" (${max}).`
      )
      continue
    }
    const step = visual.step ?? 1
    const ticks = Math.floor((max - min) / step + 1e-9) + 1
    if (ticks > LIMITS.numberLineTicks)
      add(
        "structure",
        path,
        `This number line has ${ticks} ticks; keep it to ${LIMITS.numberLineTicks} with a larger "step" or a shorter range, so the numbers stay readable on a phone.`
      )
    if (visual.fractions && !fractionStep(step))
      add(
        "structure",
        `${path}.step`,
        `Ticks numbered as fractions need a "step" of 1/2, 1/3, … up to 1/12 (0.25 for quarters); this one is ${step}.`
      )
    const off = (v: number) => v < min || v > max
    visual.points?.forEach((p, j) => {
      if (off(p.value))
        add(
          "structure",
          `${path}.points[${j}]`,
          `The point ${p.value} is off the line (${min} to ${max}).`
        )
    })
    visual.ranges?.forEach((r, j) => {
      if (r.from === undefined && r.to === undefined)
        add(
          "structure",
          `${path}.ranges[${j}]`,
          `A range needs "from", "to", or both (leave one out for a ray to that end of the line).`
        )
      else if ([r.from, r.to].some((v) => v !== undefined && off(v)))
        add(
          "structure",
          `${path}.ranges[${j}]`,
          `A range's ends must be on the line (${min} to ${max}).`
        )
      else if (r.from !== undefined && r.to !== undefined && !(r.from < r.to))
        add(
          "structure",
          `${path}.ranges[${j}]`,
          `A range's "from" (${r.from}) must be less than its "to" (${r.to}).`
        )
    })
    visual.jumps?.forEach((jump, j) => {
      if (off(jump.from) || off(jump.to))
        add(
          "structure",
          `${path}.jumps[${j}]`,
          `A jump must start and land on the line (${min} to ${max}).`
        )
      else if (jump.from === jump.to)
        add(
          "structure",
          `${path}.jumps[${j}]`,
          `A jump goes from one value to another; this one starts and lands on ${jump.from}.`
        )
    })
  }

  // Fractions: no more shaded parts than the whole has.
  for (const { visual, path } of everyVisual(lesson)) {
    if (visual.kind !== "fraction") continue
    visual.fractions.forEach((f, j) => {
      if (f.shaded > f.parts)
        add(
          "structure",
          `${path}.fractions[${j}]`,
          `${f.shaded} shaded parts is more than the ${f.parts} the whole is cut into. For a fraction over 1, draw each whole as its own fraction.`
        )
    })
  }

  // Chess positions: a FEN the board can draw, and arrows that move a piece that's there.
  for (const { visual, path } of everyVisual(lesson)) {
    if (visual.kind !== "chess") continue
    const read = readFen(visual.fen)
    if ("error" in read) {
      add("structure", `${path}.fen`, read.error)
      continue
    }
    const twice = duplicates(visual.highlight ?? [])
    if (twice.length)
      add(
        "structure",
        `${path}.highlight`,
        `Each square is highlighted once; "${twice[0]}" is listed twice.`
      )
    const arrows = visual.arrows ?? []
    arrows.forEach((a, j) => {
      if (a.from === a.to)
        add(
          "structure",
          `${path}.arrows[${j}]`,
          `An arrow goes from one square to another; this one starts and ends on ${a.from}.`
        )
      // An arrow shows a piece moving, so its square holds one, unless an earlier arrow brought it
      // there (a route). An empty one usually means the FEN put the piece somewhere else.
      else if (
        !pieceOn(read.placement, a.from) &&
        !arrows.some((b) => b.to === a.from)
      )
        add(
          "structure",
          `${path}.arrows[${j}]`,
          `The arrow starts on ${a.from}, which is empty in this FEN. Check the FEN puts the piece there (count the rank's squares again), or start the arrow where the piece is.`
        )
    })
  }

  // Maps: country codes the map has, and everything marked inside the region shown.
  for (const { visual, path } of everyVisual(lesson)) {
    if (visual.kind !== "map") continue
    const region = visual.region ?? "world"
    const box: Box = [...MAP_REGIONS[region]]
    const countries = visual.countries ?? []
    if (!countries.length && !visual.points)
      add(
        "structure",
        path,
        `A map shows something: shade "countries", mark "points", or both.`
      )
    const twice = duplicates(countries.map((c) => c.code))
    if (twice.length)
      add(
        "structure",
        `${path}.countries`,
        `Each country is listed once; "${twice[0]}" is listed twice.`
      )
    countries.forEach((c, j) => {
      const country = COUNTRIES[c.code]
      if (!country)
        add("structure", `${path}.countries[${j}]`, unknownCountry(c.code))
      else if (!boxesOverlap(country.box, box))
        add(
          "structure",
          `${path}.countries[${j}]`,
          `${country.name} ("${c.code}") isn't on the "${region}" map. ${showingIt((b) => boxesOverlap(country.box, b))}`
        )
    })
    const groups = new Set(countries.flatMap((c) => c.group ?? []))
    const ungrouped = countries.findIndex((c) => !c.group)
    if (groups.size > LIMITS.mapGroups)
      add(
        "structure",
        `${path}.countries`,
        `A map has at most ${LIMITS.mapGroups} groups, so each color reads apart; this one has ${groups.size}.`
      )
    if (groups.size && ungrouped >= 0)
      add(
        "structure",
        `${path}.countries[${ungrouped}]`,
        `Give every country a "group", or none: "${countries[ungrouped]!.code}" has none, so it has no color in the legend.`
      )
    visual.points?.forEach((p, j) => {
      if (!inBox(p.lon, p.lat, box))
        add(
          "structure",
          `${path}.points[${j}]`,
          `The point ${p.label ? `"${p.label}" ` : ""}(lat ${p.lat}, lon ${p.lon}) is outside the "${region}" map (${describeBox(box)}). Check its signs: south and west are negative. ${showingIt((b) => inBox(p.lon, p.lat, b))}`
        )
    })
  }

  // Molecules: the SMILES and the highlight patterns are read on the server (the player's
  // molecule.ts), which needs the chemistry library; here, only what the text alone shows.
  for (const { visual, path } of everyVisual(lesson)) {
    if (visual.kind !== "molecule") continue
    if (/\s/.test(visual.smiles.trim()))
      add(
        "structure",
        `${path}.smiles`,
        `A SMILES has no spaces. To draw several molecules or ions together, separate them with "." ("[Na+].[Cl-]").`
      )
    const twice = duplicates(visual.highlight ?? [])
    if (twice.length)
      add(
        "structure",
        `${path}.highlight`,
        `Each pattern is highlighted once; "${twice[0]}" is listed twice.`
      )
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
    if (/\.(html|css|code|d2|smiles)$|\.visual\.highlight\[\d+\]$/.test(path))
      return
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

/**
 * Why a tag with key `key` says nothing on this lesson, or null when it's fine: it repeats the
 * subject, a level, or a language the lesson already names (by code, or by its English name:
 * "Spanish" on a lesson with `targetLanguage: "es"`). The message quotes `label`, the tag as
 * written. The upgrade uses it too, to drop an old label that became redundant.
 */
export function redundantTag(
  key: string,
  lesson: Pick<Lesson, "subject" | "language" | "targetLanguage">,
  label = key
): string | null {
  if (key === lesson.subject)
    return `The tag "${label}" repeats the subject. Tags are for the specifics: the thing taught, then the product or field.`
  if ((LEVELS as readonly string[]).includes(key))
    return `The tag "${label}" is a level; "level" already says who the lesson is for. Use tags for what it teaches.`
  const codes = [lesson.language, lesson.targetLanguage].filter(
    (c): c is string => typeof c === "string"
  )
  for (const code of codes) {
    if (key === code.toLowerCase())
      return `The tag "${label}" is a language code; "language" and "targetLanguage" already say that. Use tags for what the lesson teaches.`
    const name = languageName(code)
    if (name && key === name)
      return `The tag "${label}" names a language the lesson already sets in "${code === lesson.language ? "language" : "targetLanguage"}". Use tags for what it teaches: "Greetings", "Verb tenses".`
  }
  return null
}

/** The English name of a language code in tag form ("es" → "spanish"), or null when the code is unknown. */
function languageName(code: string): string | null {
  try {
    const name = new Intl.DisplayNames(["en"], { type: "language" }).of(code)
    if (!name || name === code) return null
    return name
      .toLowerCase()
      .replace(/[\s_\p{P}\p{S}]+/gu, "-")
      .replace(/^-+|-+$/g, "")
  } catch {
    return null
  }
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
  add: (k: IssueKind, p: string, m: string) => void,
  language: string
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
            brick.visual.kind === "chess"
              ? `"${c}" isn't a square. On a chess board, "correct" lists squares: a file a–h then a rank 1–8, like "e4".`
              : brick.visual.kind === "map"
                ? notOnHotspotMap(c, brick.visual.region ?? "world")
                : `"${c}" isn't one of this visual's hotspot ids (${ids.join(", ") || "none"}).`
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
      if (brick.visual.kind === "chess") {
        // Marks on the board point the learner somewhere: on an answer square, they give it away.
        const { highlight = [], arrows = [] } = brick.visual
        for (const c of brick.correct) {
          if (highlight.includes(c))
            add(
              "teaching",
              `${path}.visual.highlight`,
              `${c} is an answer and it's highlighted, which gives it away. Highlight the piece the question is about, not the square to find.`
            )
          else if (arrows.some((a) => a.to === c))
            add(
              "teaching",
              `${path}.visual.arrows`,
              `An arrow ends on ${c}, an answer, which gives it away. Show moves that lead up to the question, not its answer.`
            )
        }
        // The alt names the squares pieces stand on; an empty answer square named there is the
        // answer, read out before the learner taps (often as a move, like "Nc7+").
        const read = readFen(brick.visual.fen)
        const named = altSquares(brick.visual.alt ?? "")
        const told =
          "placement" in read &&
          brick.correct.find(
            (c) => named.includes(c) && !pieceOn(read.placement, c)
          )
        if (told)
          add(
            "teaching",
            `${path}.visual.alt`,
            `The alt names ${told}, an answer, which gives it away to a screen reader. Describe the position (where the pieces stand), not the square to find.`
          )
      }
      if (brick.visual.kind === "map") {
        const region = brick.visual.region ?? "world"
        const shaded = brick.visual.countries ?? []
        for (const c of brick.correct) {
          const country = COUNTRIES[c]
          if (!country || !ids.includes(c)) continue
          // A name on the map, or the only shaded country, points the learner straight at it.
          const j = shaded.findIndex((s) => s.code === c)
          if (shaded[j]?.label)
            add(
              "teaching",
              `${path}.visual.countries[${j}].label`,
              `${country.name} ("${c}") is an answer and it's labeled, which gives it away. Leave its name off the map.`
            )
          else if (j >= 0 && shaded.length === 1)
            add(
              "teaching",
              `${path}.visual.countries[${j}]`,
              `${country.name} ("${c}") is an answer and the only country shaded, which gives it away. Shade it among a few others to choose from, or shade none.`
            )
          if ((DRAWN_SIZES[region][c] ?? 0) < MAP_MIN_TAP)
            add(
              "teaching",
              `${path}.visual.region`,
              `${country.name} ("${c}") is too small to find and tap on the "${region}" map. ${largeEnough(c, "Pick a tighter region")}`
            )
        }
        // A screen reader hears the alt before the countries, each by name. Naming the answers
        // among other countries is fine (the toggles name them all anyway); naming only answers
        // gives them away.
        const alt = brick.visual.alt ?? ""
        const answers = brick.correct.filter((c) =>
          namesCountry(alt, c, language)
        )
        const others = Object.keys(DRAWN_SIZES[region]).filter(
          (c) => !brick.correct.includes(c) && namesCountry(alt, c, language)
        )
        if (answers.length && !others.length)
          add(
            "teaching",
            `${path}.visual.alt`,
            `The alt names ${answers.map((c) => COUNTRIES[c]!.name).join(" and ")}, ${answers.length > 1 ? "answers" : "an answer"}, and no other country, which gives it away to a screen reader. Describe the region and what's marked on it, or name the answer among the other candidates.`
          )
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

/** Every rich-text string a learner reads, with its path. Visual subtrees are skipped. */
function walkRichText(
  value: unknown,
  visit: (text: string, path: string) => void,
  path = ""
) {
  if (Array.isArray(value)) {
    value.forEach((v, i) => walkRichText(v, visit, `${path}[${i}]`))
  } else if (value && typeof value === "object") {
    if ("kind" in value) return
    for (const [k, v] of Object.entries(value)) {
      const at = path ? `${path}.${k}` : k
      if (RICH_TEXT_KEYS.has(k) && typeof v === "string") visit(v, at)
      else if (RICH_TEXT_KEYS.has(k) && Array.isArray(v))
        v.forEach((s, i) => typeof s === "string" && visit(s, `${at}[${i}]`))
      else walkRichText(v, visit, at)
    }
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

/** Why a map's country code isn't one it has, and the code to use instead when there is one. */
function unknownCountry(code: string): string {
  const upper = code.toUpperCase()
  const alias = { UK: "GB", EL: "GR" }[upper]
  const a3 = Object.entries(COUNTRIES).find(([, c]) => c.a3 === upper)
  const missing = NOT_ON_MAP[upper]
  if (alias)
    return `"${code}" isn't an ISO country code; ${COUNTRIES[alias]!.name} is "${alias}".`
  if (a3)
    return `Use the two-letter code: "${a3[0]}" for ${a3[1].name}, not "${code}".`
  if (code !== upper && (COUNTRIES[upper] || missing))
    return `Country codes are capital letters: "${upper}", not "${code}".`
  if (missing?.partOf)
    return `${missing.name} ("${upper}") is drawn as part of ${COUNTRIES[missing.partOf]!.name} on the map. Shade "${missing.partOf}", or mark it with a point.`
  if (missing)
    return `${missing.name} ("${upper}") is too small for the map. Mark it with a point instead.`
  return `"${code}" isn't a country code the map knows. Use ISO 3166-1 alpha-2 codes, like "FR" for France or "JP" for Japan.`
}

/** Why an answer on a map hotspot isn't a country the map draws, and what to do instead. */
function notOnHotspotMap(code: string, region: MapRegion): string {
  const country = COUNTRIES[code]
  if (country)
    return `${country.name} ("${code}") isn't on the "${region}" map, so it can't be tapped. ${largeEnough(code, "Pick a region that shows it")}`
  const missing = NOT_ON_MAP[code]
  if (missing)
    return `${missing.name} ("${code}") isn't drawn on the map${missing.partOf ? ` (it's part of ${COUNTRIES[missing.partOf]!.name}, "${missing.partOf}")` : ", it's too small"}, so it can't be tapped. Ask about a country the map draws.`
  // A three-letter code, a lowercase one, or "UK": unknownCountry names the code to use.
  if (/^[a-z]{2,3}$/i.test(code)) return unknownCountry(code)
  return `"${code}" isn't a country code. On a map, "correct" lists countries by ISO 3166-1 alpha-2 code: two capital letters, like "FR" for France.`
}

/** Squares an alt names, alone or in a move ("e4", "Nc7+"), but not inside a word. */
const altSquares = (alt: string) =>
  [...alt.matchAll(/(?<![a-z0-9])([a-h][1-8])(?![0-9])/g)].map((m) => m[1]!)

/** Former or common English names the ISO names leave out, which an alt might still use. */
const COUNTRY_ALIASES: Record<string, string[]> = {
  CD: ["Congo-Kinshasa", "Zaire"],
  CI: ["Ivory Coast"],
  CV: ["Cape Verde"],
  CZ: ["Czech Republic"],
  GB: ["Britain", "Great Britain", "UK"],
  MK: ["Macedonia"],
  MM: ["Burma"],
  NL: ["Holland"],
  SZ: ["Swaziland"],
  TR: ["Turkey"],
  US: ["USA"],
}

/** Whether text names a country: in English, in the lesson's language, or by a common other name. */
function namesCountry(text: string, code: string, language: string): boolean {
  if (!text) return false
  const names = new Set([
    COUNTRIES[code]?.name,
    ...(COUNTRY_ALIASES[code] ?? []),
    ...[language, "en"].map((l) => regionName(l, code)),
  ])
  return [...names].some((n) => {
    if (!n) return false
    const escaped = n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    return new RegExp(`(?<!\\p{L})${escaped}(?!\\p{L})`, "iu").test(text)
  })
}

function regionName(language: string, code: string): string | undefined {
  try {
    const name = new Intl.DisplayNames([language], { type: "region" }).of(code)
    return name === code ? undefined : name
  } catch {
    return undefined
  }
}

/** "Pick a tighter region: …", naming the regions that draw a country large enough to tap. */
function largeEnough(code: string, pick: string): string {
  const regions = MAP_REGION_NAMES.filter(
    (r) => (DRAWN_SIZES[r][code] ?? 0) >= MAP_MIN_TAP
  )
  return regions.length
    ? `${pick}: ${regions.map((r) => `"${r}"`).join(", ")}.`
    : "No region draws it large enough to tap; ask about a larger country, or make this a choice with the names as options."
}

/** "Pick a region that shows it: …", naming the regions whose box passes the test. */
function showingIt(shows: (box: Box) => boolean): string {
  const regions = MAP_REGION_NAMES.filter((r) => shows([...MAP_REGIONS[r]]))
  return regions.length
    ? `Pick a region that shows it: ${regions.map((r) => `"${r}"`).join(", ")}.`
    : "No region shows it."
}

/** The n of a number line step that is 1/n (2 to 12), or undefined. Shared with the player's ticks. */
export function fractionStep(step: number): number | undefined {
  const n = Math.round(1 / step)
  return n >= 2 && n <= 12 && Math.abs(n * step - 1) < 1e-9 ? n : undefined
}

/** What a visual is called in messages. */
const VISUAL_NAMES: Partial<Record<Visual["kind"], string>> = {
  html: "HTML visual",
  numberline: "number line",
  fraction: "fraction picture",
  chess: "chess position",
}
const visualName = (v: Visual) => VISUAL_NAMES[v.kind] ?? v.kind

/** Every visual in the lesson with its path: on bricks, on options, and on items. */
export function everyVisual(
  lesson: Lesson
): { visual: Visual; path: string }[] {
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
