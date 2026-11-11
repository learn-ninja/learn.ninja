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
  type Kata,
  type Lesson,
  type QuestionKata,
  type Visual,
} from "./schema"
import { normalizeTag } from "./tags"
import { listItem, stepCount, textBlocks } from "./text"
import {
  everyVisual,
  isGuess,
  fractionStep,
  LEVELS,
  LIMITS,
  matchesBlank,
} from "./basics"

// Rules the schema can't express: cross-references, teaching quality, v1 limits, and safety.
// Every message says what's wrong and how to fix it, so an LLM can correct the lesson on its own.

export type IssueKind = "structure" | "teaching" | "v1" | "safety"

export interface Issue {
  path: string
  message: string
  kind: IssueKind
}

/** A question kata together with where it sits in the lesson, in play order. */
interface PlacedQuestion {
  kata: QuestionKata
  path: string
}

function placedQuestions(lesson: Lesson): PlacedQuestion[] {
  const practice: PlacedQuestion[] = []
  lesson.katas.forEach((kata, i) => {
    if (kata.type !== "concept") practice.push({ kata, path: `katas[${i}]` })
  })
  return [
    { kata: lesson.hook, path: "hook" },
    ...practice,
    { kata: lesson.challenge, path: "challenge" },
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
/**
 * How many sentences a text has, by its ending marks: `.`, `!`, `?`, or `…` before a space or the
 * end (closing quotes and brackets may follow), or a CJK full stop. A decimal point, a colon, and
 * a comma don't end one; a text that trails off without a mark still counts its last sentence.
 */
export function sentenceCount(text: string): number {
  const enders = text.match(/[.!?…]["'”’)\]]*(?=\s|$)|[。！？]/g) ?? []
  const openTail = /[.!?…。！？]["'”’)\]]*\s*$/.test(text) ? 0 : 1
  return enders.length + openTail
}

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
    return "Headings don't show in lesson text: a concept's title is its heading. Start the line without #, or split the idea into another concept kata."
  if (/!?\[[^\]\n]+\]\([^)\n]*\)/.test(prose))
    return "Links and images don't show in lesson text, and a lesson never sends the learner elsewhere. Name a source in words, and draw a picture as a visual."
  if (/^\s*\|.*\|\s*$/m.test(prose) || /\|\s*:?-{3,}/.test(prose))
    return "Tables don't show in lesson text. Put the table in an HTML visual (3 columns at most, so it fits a phone)."
  // HTML tags are caught by bareCode, which asks for backticks.
  return null
}

const NAMED_REFERENCES: Record<string, string> = {
  colon: ":",
  sol: "/",
  period: ".",
  lpar: "(",
  rpar: ")",
  quot: '"',
  apos: "'",
  tab: "\t",
  newline: "\n",
}

const codePoint = (n: number) =>
  n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : ""

/** Visual HTML or CSS with character references and CSS escapes decoded, for the safety checks. */
function decoded(text: string): string {
  return text
    .replace(/&#x([0-9a-f]+);?/gi, (_, hex: string) =>
      codePoint(parseInt(hex, 16))
    )
    .replace(/&#(\d+);?/g, (_, dec: string) => codePoint(Number(dec)))
    .replace(
      /&([a-z]+);/gi,
      (ref: string, name: string) => NAMED_REFERENCES[name.toLowerCase()] ?? ref
    )
    .replace(/\\([0-9a-f]{1,6})\s?/gi, (_, hex: string) =>
      codePoint(parseInt(hex, 16))
    )
    .replace(/\\([^\n])/g, "$1")
}

/**
 * The visible length of a one-answer question's right option and of its longest wrong one, or null
 * when length can't be compared: fewer than 3 options, pictures, or formulas, whose TeX isn't what
 * the learner sees.
 */
function answerLengths(
  kata: QuestionKata
): { right: number; wrong: number } | null {
  if (kata.type !== "choice" && kata.type !== "scenario") return null
  const options =
    kata.type === "scenario"
      ? kata.options.map((o) => ({
          text: o.text,
          right: o.quality === "best",
        }))
      : kata.options.map((o) => ({
          text: o.visual ? undefined : o.text,
          right: kata.correct.includes(o.id),
        }))
  const shown = options.flatMap(({ text, right }) =>
    text && !text.includes("\\(")
      ? [{ right, size: text.replace(/[*`]/g, "").trim().length }]
      : []
  )
  const rightOnes = shown.filter((o) => o.right)
  if (
    options.length < 3 ||
    shown.length < options.length ||
    rightOnes.length !== 1
  )
    return null
  return {
    right: rightOnes[0]!.size,
    wrong: Math.max(...shown.filter((o) => !o.right).map((o) => o.size)),
  }
}

function duplicates(values: string[]): string[] {
  const seen = new Set<string>()
  const dupes = new Set<string>()
  for (const v of values) (seen.has(v) ? dupes : seen).add(v)
  return [...dupes]
}

const sameSet = (a: string[], b: string[]) =>
  a.length === b.length && a.every((x) => b.includes(x))

/**
 * What a learner sees of an option, item, or label. Two that look the same can't be told apart,
 * so picking or placing the "wrong" one of them counts as a miss. Case is kept: "lunes" and
 * "Lunes" can be the very thing a question asks about.
 */
const looks = (x: { text?: string; visual?: Visual }) =>
  JSON.stringify([x.text?.trim().replace(/\s+/g, " "), x.visual ?? null])

/** Indices of the entries that look like an earlier one. */
function lookalikes<T>(entries: T[], key: (e: T) => string): number[] {
  const seen = new Set<string>()
  const repeats: number[] = []
  entries.forEach((e, i) => {
    const k = key(e)
    if (seen.has(k)) repeats.push(i)
    else seen.add(k)
  })
  return repeats
}

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

  const lessonIds = [lesson.hook, ...lesson.katas, lesson.challenge].map(
    (b) => b.id
  )
  for (const dupe of duplicates(lessonIds)) {
    add(
      "structure",
      "",
      `The id "${dupe}" is used more than once. Every kata id must be unique within the lesson.`
    )
  }

  for (const { kata, path } of questions)
    checkKataReferences(kata, path, add, lesson.language)

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

  for (const { kata, path } of questions) {
    if (kata.type === "number") {
      add(
        "v1",
        path,
        "Number katas aren't supported in v1. Rewrite this as a choice kata whose wrong options come from common mistakes, each with feedback."
      )
    }
    if (kata.type === "blank") {
      kata.blanks.forEach((b, i) => {
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

  for (const { kata, path } of questions) {
    const explanationWords = countWords(kata.explanation)
    if (explanationWords > LIMITS.explanationWords) {
      add(
        "teaching",
        `${path}.explanation`,
        `The explanation has ${explanationWords} words; keep it to ${LIMITS.explanationWords} or fewer. Apply the idea to this question in a sentence or two; don't restate the concept.`
      )
    }
    if (countWords(kata.prompt) > LIMITS.promptWords) {
      add(
        "teaching",
        `${path}.prompt`,
        `The prompt has ${countWords(kata.prompt)} words; keep it to ${LIMITS.promptWords} or fewer.`
      )
    }
    if (kata.type === "choice" || kata.type === "compare") {
      const correct = kata.type === "choice" ? kata.correct : [kata.correct]
      kata.options.forEach((o, i) => {
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

  // A right answer that's longer than the rest can be picked without knowing anything: on one
  // question when the gap is wide, and across a lesson when it keeps happening.
  const lengths = questions.flatMap(({ kata, path }) => {
    const found = answerLengths(kata)
    return found ? [{ ...found, path }] : []
  })
  for (const { right, wrong, path } of lengths) {
    if (
      right >= LIMITS.answerLengthMin &&
      right >= wrong * LIMITS.answerLengthRatio
    )
      add(
        "teaching",
        `${path}.options`,
        `The right answer is ${right} characters and the longest wrong one ${wrong}, so its length gives it away. Move the reasoning into the explanation, or give the wrong options the same detail, so no option stands out.`
      )
  }
  const longest = lengths.filter((q) => q.right > q.wrong).length
  if (lengths.length >= LIMITS.answerPatternMin && longest * 2 > lengths.length)
    add(
      "teaching",
      "",
      `The right answer is the longest option in ${longest} of ${lengths.length} questions, so a learner can pass by always picking the longest. Make a wrong option the longest in some of them.`
    )

  // The player shuffles options (and a match's right column), so "the second statement" can point
  // at the wrong one on screen. Explanations and feedback have to name an option by what it says.
  for (const { kata, path } of questions) {
    if (
      kata.type !== "choice" &&
      kata.type !== "compare" &&
      kata.type !== "scenario" &&
      kata.type !== "match"
    )
      continue
    const texts: [string, string | undefined][] = [
      [`${path}.explanation`, kata.explanation],
      [`${path}.hint`, kata.hint],
      ...(kata.type === "match"
        ? []
        : kata.options.flatMap((o, i): [string, string | undefined][] => [
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
    const isBody = /^katas\[\d+\]\.body$/.test(where)
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

  // A kata's HTML visual is a picture to a screen reader, so it needs alt text. (Hotspot visuals
  // are read through their tappable regions, item visuals through their captions, and option
  // visuals below. A chess or map hotspot's regions are only names, so its alt describes the
  // picture.)
  const withVisuals = [
    ...lesson.katas.flatMap((b, i) =>
      b.type === "concept" ? [{ kata: b, path: `katas[${i}]` }] : []
    ),
    ...questions.filter(
      (q) =>
        q.kata.type !== "hotspot" ||
        q.kata.visual.kind === "chess" ||
        q.kata.visual.kind === "map"
    ),
  ]
  for (const { kata, path } of withVisuals) {
    const v = kata.visual
    if (v && v.kind !== "code" && v.kind !== "math" && !v.alt)
      add(
        "teaching",
        `${path}.visual`,
        `This ${visualName(v)} has no "alt". Add one sentence saying what it shows, for people using a screen reader.`
      )
  }

  // A reveal takes the visual's place once the question is answered, so it needs a visual to replace
  // (one appearing from nothing after Check pushes the answers down) and its own alt. A hotspot's
  // visual is what the learner taps and a scenario's plays the outcome, so neither has one.
  for (const { kata, path } of questions) {
    const v = kata.reveal
    if (!v) continue
    if (kata.type === "hotspot" || kata.type === "scenario")
      add(
        "structure",
        `${path}.reveal`,
        `A ${kata.type} kata can't have a "reveal": its visual already shows the answer after checking. Remove it.`
      )
    else if (!kata.visual)
      add(
        "structure",
        `${path}.reveal`,
        `A "reveal" takes the place of the question's "visual", and this question has none. Add a "visual" (the same picture without the answer), or remove the reveal.`
      )
    else if (v.kind !== "code" && v.kind !== "math" && !v.alt)
      add(
        "teaching",
        `${path}.reveal`,
        `This reveal's ${visualName(v)} has no "alt". Add one sentence saying what it shows once the answer is in, for people using a screen reader.`
      )
  }

  // An option's visual is read through its alt, or its caption when it has one. A caption is for
  // what the visual can't say, so most visual options have an alt and no caption.
  for (const { kata, path } of questions) {
    if (kata.type !== "choice" && kata.type !== "compare") continue
    kata.options.forEach((o, j) => {
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

  // Chats: someone besides the learner speaks, and few enough people to tell apart by their bubbles.
  for (const { visual, path } of everyVisual(lesson)) {
    if (visual.kind !== "chat") continue
    const speakers = [
      ...new Set(visual.turns.flatMap((t) => (t.who ? [t.who] : []))),
    ]
    if (speakers.length === 0)
      add(
        "structure",
        `${path}.turns`,
        `Every turn in this chat is the learner's own. Give the other person's turns a "who" (their name); a turn without one is the learner's.`
      )
    if (speakers.length > LIMITS.chatSpeakers)
      add(
        "structure",
        `${path}.turns`,
        `This chat has ${speakers.length} people besides the learner (${speakers.join(", ")}); keep it to ${LIMITS.chatSpeakers}, so each one's bubbles stay apart on a phone.`
      )
  }
  // A scenario's chat ends on the other person's turn: the options are what the learner says back,
  // and the pick's outcome arrives as that person's reply.
  for (const { kata, path } of questions) {
    if (kata.type !== "scenario" || kata.visual?.kind !== "chat") continue
    const last = kata.visual.turns[kata.visual.turns.length - 1]!
    if (!last.who)
      add(
        "teaching",
        `${path}.visual.turns`,
        `A scenario's chat ends on the learner's own line. End it on the other person's turn (one with a "who"): the options are what the learner says back, and the outcome shows as that person's reply.`
      )
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
    const given = visual.step ?? 1
    const n = visual.fractions ? fractionStep(given) : undefined
    const step = n ? 1 / n : given
    const ticks = Math.floor((max - min) / step + 1e-9) + 1
    if (ticks > LIMITS.numberLineTicks)
      add(
        "structure",
        path,
        `This number line has ${ticks} ticks; keep it to ${LIMITS.numberLineTicks} with a larger "step" or a shorter range, so the numbers stay readable on a phone.`
      )
    if (visual.fractions && !n)
      add(
        "structure",
        `${path}.step`,
        `Ticks numbered as fractions need a "step" of 1/2, 1/3, … up to 1/12, as a decimal to 3 places or more (0.25 for quarters, 0.333 for thirds); this one is ${given}.`
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

  lesson.katas.forEach((kata, i) => {
    if (kata.type !== "concept") return
    const words = countWords(kata.body)
    if (words > LIMITS.conceptBodyWords) {
      add(
        "teaching",
        `katas[${i}].body`,
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
    // <meta http-equiv="refresh"> can show any page of the site in the frame, and the rest load
    // or point at files a visual has no use for.
    if (/<\s*(meta|link|base|video|audio|source|track)\b/i.test(html))
      add(
        "safety",
        `${path}.html`,
        "Visuals can't contain meta, link, base, video, audio, source, or track tags."
      )
    if (/\son[a-z]+\s*=/i.test(html))
      add(
        "safety",
        `${path}.html`,
        "Visuals can't contain event handlers (onclick and similar)."
      )
    // Read as the browser will: a URL can hide behind character references and CSS escapes.
    const plainHtml = decoded(html)
    const plainCss = decoded(v.css ?? "")
    if (/javascript\s*:/i.test(plainHtml))
      add("safety", `${path}.html`, "Visuals can't contain javascript: URLs.")
    // Any attribute that starts with an off-site URL (src, href, poster, xlink:href…), or a CSS url().
    // Matching from the space, slash, or quote before the name keeps it linear on long runs of letters.
    const external =
      /[\s/"'][\w:-]+\s*=\s*["']?\s*(?:https?:)?\/\/|url\(\s*["']?\s*(?:https?:)?\/\//i
    const styles = [
      plainCss,
      ...[...plainHtml.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style\s*>/gi)].map(
        (m) => m[1]!
      ),
    ]
    // SVG's namespace declarations are names, not loads.
    const attributes = plainHtml.replace(
      /\sxmlns(?::[\w-]+)?\s*=\s*(["'])[^"']*\1/gi,
      ""
    )
    if (
      external.test(attributes) ||
      external.test(plainCss) ||
      styles.some((css) => /@import/i.test(css))
    ) {
      add(
        "safety",
        path,
        "Visuals can't load anything from external URLs. Use the built-in UI kit, inline SVG, and CSS only."
      )
    }
    // The frame takes its height from the visual, so a height tied to the viewport makes it grow
    // without end: the frame grows, the viewport with it, and the visual again.
    const styling = [
      ...styles,
      ...[
        ...plainHtml.matchAll(/\s(?:style|class)\s*=\s*("[^"]*"|'[^']*')/gi),
      ].map((m) => m[1]!),
    ]
    if (
      styling.some((text) =>
        /(?:^|[^\w-])(?:min-|max-)?h-(?:screen|[dls]vh)(?![\w-])|\d[dls]?vh\b/.test(
          text
        )
      )
    )
      add(
        "structure",
        path,
        "Visuals can't size to the screen's height (vh, dvh, h-screen): the frame takes its height from the visual, so it would grow without end. Give it a fixed height like h-64, or let the content set it."
      )
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

/** Teach, then practise: concept katas, each followed by the question katas that practise it. */
function checkRhythm(
  lesson: Lesson,
  add: (k: IssueKind, p: string, m: string) => void
) {
  const { concepts, practicePerConcept, practiceTotal } = LIMITS
  const conceptAt = lesson.katas.flatMap((b, i) =>
    b.type === "concept" ? [i] : []
  )
  // A stepped concept shows one step per Continue, so it needs a few, and not a tap for every line.
  lesson.katas.forEach((kata, i) => {
    if (kata.type !== "concept" || !kata.stepped) return
    const steps = stepCount(kata.body)
    if (steps < 2 || steps > 6)
      add(
        "structure",
        `katas[${i}].body`,
        `Concept kata "${kata.id}" is stepped, but its body has ${steps} ${steps === 1 ? "step" : "steps"}; it needs 2–6. Each paragraph (a line break, "\n") and each list item is a step. Split the body, or remove "stepped".`
      )
  })
  // A guess is asked before the concept that teaches it, so it sits right before one, and it's
  // practice for neither concept: it doesn't count below.
  const guessAt = lesson.katas.flatMap((b, i) => (isGuess(b) ? [i] : []))
  for (const i of guessAt)
    if (lesson.katas[i + 1]?.type !== "concept")
      add(
        "structure",
        `katas[${i}]`,
        `Kata "${lesson.katas[i]!.id}" is a guess ("guess": true), so the next kata must be the concept that answers it. Move it right before that concept, or remove "guess".`
      )
  for (const [kata, path] of [
    [lesson.hook, "hook"],
    [lesson.challenge, "challenge"],
  ] as const)
    if (isGuess(kata))
      add(
        "structure",
        `${path}.guess`,
        `Remove "guess" from the ${path}: it's only for a question in "katas" that comes right before a concept.`
      )
  if (lesson.katas[0]?.type !== "concept") {
    add(
      "structure",
      "katas[0]",
      `The first kata must be a concept kata. Teach the idea first, then add the question katas that practise it.`
    )
  }
  if (conceptAt.length < concepts.min || conceptAt.length > concepts.max) {
    add(
      "structure",
      "katas",
      `The lesson has ${conceptAt.length} concept katas; it needs ${concepts.min}–${concepts.max}, one idea each.`
    )
  }
  conceptAt.forEach((at, n) => {
    const next = conceptAt[n + 1] ?? lesson.katas.length
    const count =
      next - at - 1 - guessAt.filter((i) => i > at && i < next).length
    if (count < practicePerConcept.min || count > practicePerConcept.max) {
      const id = lesson.katas[at]!.id
      add(
        "structure",
        `katas[${at}]`,
        `Concept kata "${id}" is followed by ${count} question katas; it needs ${practicePerConcept.min}–${practicePerConcept.max} before the next concept kata or the challenge.`
      )
    }
  })
  const practiceCount = lesson.katas.length - conceptAt.length - guessAt.length
  if (practiceCount < practiceTotal.min || practiceCount > practiceTotal.max) {
    add(
      "structure",
      "katas",
      `The lesson has ${practiceCount} practice katas in total; it needs ${practiceTotal.min}–${practiceTotal.max}. Add or remove question katas (${practicePerConcept.min}–${practicePerConcept.max} after each concept kata).`
    )
  }
}

function checkKataReferences(
  kata: QuestionKata,
  path: string,
  add: (k: IssueKind, p: string, m: string) => void,
  language: string
) {
  switch (kata.type) {
    case "choice": {
      const ids = kata.options.map((o) => o.id)
      for (const d of duplicates(ids))
        add(
          "structure",
          `${path}.options`,
          `Option id "${d}" is used more than once.`
        )
      for (const c of kata.correct)
        if (!ids.includes(c))
          add(
            "structure",
            `${path}.correct`,
            `"${c}" isn't one of this kata's option ids (${ids.join(", ")}).`
          )
      if (!kata.multiple && kata.correct.length !== 1)
        add(
          "structure",
          `${path}.correct`,
          `With "multiple": false, "correct" must list exactly one option id.`
        )
      for (const d of duplicates(kata.correct))
        add(
          "structure",
          `${path}.correct`,
          `"${d}" is listed more than once in "correct".`
        )
      if (kata.correct.length >= ids.length)
        add("teaching", `${path}.correct`, "At least one option must be wrong.")
      sameLooking(kata.options, `${path}.options`, "Option", add)
      break
    }
    case "compare": {
      const ids = kata.options.map((o) => o.id)
      for (const d of duplicates(ids))
        add(
          "structure",
          `${path}.options`,
          `Option id "${d}" is used more than once.`
        )
      if (!ids.includes(kata.correct))
        add(
          "structure",
          `${path}.correct`,
          `"${kata.correct}" isn't one of this kata's option ids (${ids.join(", ")}).`
        )
      sameLooking(kata.options, `${path}.options`, "Option", add)
      break
    }
    case "scenario": {
      const ids = kata.options.map((o) => o.id)
      for (const d of duplicates(ids))
        add(
          "structure",
          `${path}.options`,
          `Option id "${d}" is used more than once.`
        )
      if (!kata.options.some((o) => o.quality === "best"))
        add(
          "teaching",
          `${path}.options`,
          `A scenario needs at least one option with "quality": "best".`
        )
      // The ninja tells the situation one sentence at a time before the question, so a single
      // sentence is a story with one beat: nothing builds up to the decision.
      if (sentenceCount(kata.situation) < 2)
        add(
          "teaching",
          `${path}.situation`,
          `A scenario's "situation" is one sentence. Build it up in two to four: set the scene, say what's at stake, and end on the moment that calls for a decision.`
        )
      sameLooking(kata.options, `${path}.options`, "Option", add)
      break
    }
    case "order": {
      const ids = kata.items.map((i) => i.id)
      for (const d of duplicates(ids))
        add(
          "structure",
          `${path}.items`,
          `Item id "${d}" is used more than once.`
        )
      ;(kata.alsoAccept ?? []).forEach((alt, i) => {
        if (!sameSet(alt, ids))
          add(
            "structure",
            `${path}.alsoAccept[${i}]`,
            `Each alternative order must list every item id exactly once (${ids.join(", ")}).`
          )
      })
      sameLooking(kata.items, `${path}.items`, "Item", add)
      break
    }
    case "sort": {
      const groupIds = kata.groups.map((g) => g.id)
      for (const d of duplicates(groupIds))
        add(
          "structure",
          `${path}.groups`,
          `Group id "${d}" is used more than once.`
        )
      for (const d of duplicates(kata.items.map((i) => i.id)))
        add(
          "structure",
          `${path}.items`,
          `Item id "${d}" is used more than once.`
        )
      kata.items.forEach((it, i) => {
        if (!groupIds.includes(it.group))
          add(
            "structure",
            `${path}.items[${i}].group`,
            `"${it.group}" isn't one of this kata's group ids (${groupIds.join(", ")}).`
          )
      })
      for (const i of lookalikes(kata.groups, (g) => looks({ text: g.label })))
        add(
          "structure",
          `${path}.groups[${i}].label`,
          `Group "${kata.groups[i]!.id}" has the same label as another group, so a learner can't tell which is which. Give each group its own label.`
        )
      kata.items.forEach((it, i) => {
        const twin = kata.items.find(
          (o, j) => j < i && o.group !== it.group && looks(o) === looks(it)
        )
        if (twin)
          add(
            "structure",
            `${path}.items[${i}]`,
            `Item "${it.id}" reads the same as item "${twin.id}" but belongs in another group, so there's no telling where it goes. Reword one of them.`
          )
      })
      break
    }
    case "match": {
      for (const side of ["left", "right"] as const)
        for (const i of lookalikes(kata.pairs, (p) => looks({ text: p[side] })))
          add(
            "structure",
            `${path}.pairs[${i}].${side}`,
            `Pair ${i + 1}'s ${side} side is the same as another pair's, so matching it to either looks right but only one counts. Make every ${side} side different.`
          )
      break
    }
    case "blank": {
      const gaps = [...kata.template.matchAll(/\[\[([^\]]+)\]\]/g)].map(
        (m) => m[1]!
      )
      const blankIds = kata.blanks.map((b) => b.id)
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
      // Compared the way the player compares them (matchesBlank).
      const right = (b: (typeof kata.blanks)[number], chip: string) =>
        b.accept.some((a) =>
          matchesBlank(a, chip, { ...b, caseSensitive: kata.caseSensitive })
        )
      kata.blanks.forEach((b, i) => {
        const choices = b.choices ?? []
        if (b.choices && !choices.some((c) => right(b, c))) {
          add(
            "structure",
            `${path}.blanks[${i}].choices`,
            `None of blank "${b.id}"'s accepted answers is among its choices, so it can't be answered. Add "${b.accept[0]}" to "choices".`
          )
        }
        // More chips than one count as the same answer: the extra ones were meant as decoys. (Every
        // matching chip listed in "accept" itself is meant to be right.)
        const extras = b.accept.flatMap((answer) => {
          const matching = choices.filter((c) =>
            matchesBlank(answer, c, {
              ...b,
              caseSensitive: kata.caseSensitive,
            })
          )
          if (matching.length < 2) return []
          const listed = matching.filter((c) => b.accept.includes(c))
          return listed.length
            ? matching.filter((c) => !b.accept.includes(c))
            : matching.slice(1)
        })
        for (const chip of new Set(extras))
          add(
            "structure",
            `${path}.blanks[${i}].choices`,
            `The chip "${chip}" counts as a right answer to blank "${b.id}" (${b.numeric ? "numbers compare by value" : "case is ignored"}), so it isn't a decoy. Make it a different word${b.numeric ? "" : ', or set "caseSensitive": true'}, or add it to "accept".`
          )
        ;(b.mistakes ?? []).forEach((m, j) => {
          if (
            !choices.some((c) =>
              matchesBlank(m.answer, c, {
                ...b,
                caseSensitive: kata.caseSensitive,
              })
            )
          )
            add(
              "structure",
              `${path}.blanks[${i}].mistakes[${j}]`,
              `"${m.answer}" isn't one of blank "${b.id}"'s chips, so its feedback can never show. Use a chip's text, or add it to "choices" as a decoy.`
            )
        })
      })
      // A chip for every gap and none to spare is ordering, not a question.
      const chips = [...new Set(kata.blanks.flatMap((b) => b.choices ?? []))]
      if (
        chips.length > 0 &&
        chips.every((chip) => kata.blanks.some((b) => right(b, chip)))
      )
        add(
          "teaching",
          `${path}.blanks`,
          `Every chip is a right answer to some gap, so there's nothing to choose between. Add 1–2 believable decoys to "choices".`
        )
      break
    }
    case "hotspot": {
      const ids = hotspotIds(kata.visual)
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
      for (const c of kata.correct)
        if (!ids.includes(c))
          add(
            "structure",
            `${path}.correct`,
            kata.visual.kind === "chess"
              ? `"${c}" isn't a square. On a chess board, "correct" lists squares: a file a–h then a rank 1–8, like "e4".`
              : kata.visual.kind === "map"
                ? notOnHotspotMap(c, kata.visual.region ?? "world")
                : `"${c}" isn't one of this visual's hotspot ids (${ids.join(", ") || "none"}).`
          )
      if (!kata.multiple && kata.correct.length !== 1)
        add(
          "structure",
          `${path}.correct`,
          `With "multiple": false, "correct" must list exactly one hotspot id.`
        )
      if (kata.visual.kind === "code") {
        const lines = kata.visual.code.split("\n").length
        const spots = kata.visual.hotspots ?? []
        spots.forEach((h, i) => {
          if (h.line > lines)
            add(
              "structure",
              `${path}.visual.hotspots[${i}]`,
              `Line ${h.line} doesn't exist; the code has ${lines} lines.`
            )
          // A line is tapped as a whole, so only one hotspot per line can be picked.
          const before = spots.find((o, j) => j < i && o.line === h.line)
          if (before)
            add(
              "structure",
              `${path}.visual.hotspots[${i}]`,
              `Hotspots "${before.id}" and "${h.id}" are both on line ${h.line}; a learner taps a whole line, so only one of them can be picked. Give each hotspot its own line.`
            )
        })
      }
      if (kata.visual.kind === "chess") {
        // Marks on the board point the learner somewhere: on an answer square, they give it away.
        const { highlight = [], arrows = [] } = kata.visual
        for (const c of kata.correct) {
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
        const read = readFen(kata.visual.fen)
        const named = altSquares(kata.visual.alt ?? "")
        const told =
          "placement" in read &&
          kata.correct.find(
            (c) => named.includes(c) && !pieceOn(read.placement, c)
          )
        if (told)
          add(
            "teaching",
            `${path}.visual.alt`,
            `The alt names ${told}, an answer, which gives it away to a screen reader. Describe the position (where the pieces stand), not the square to find.`
          )
      }
      if (kata.visual.kind === "map") {
        const region = kata.visual.region ?? "world"
        const shaded = kata.visual.countries ?? []
        for (const c of kata.correct) {
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
        const named = countriesNamed(
          kata.visual.alt ?? "",
          [...new Set([...kata.correct, ...Object.keys(DRAWN_SIZES[region])])],
          language
        )
        const answers = kata.correct.filter((c) => named.has(c))
        const others = [...named].filter((c) => !kata.correct.includes(c))
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

/** Flags options or items that look like an earlier one in the same kata. */
function sameLooking(
  entries: { id: string; text?: string; visual?: Visual }[],
  path: string,
  noun: "Option" | "Item",
  add: (k: IssueKind, p: string, m: string) => void
) {
  for (const i of lookalikes(entries, looks)) {
    const twin = entries.find(
      (e, j) => j < i && looks(e) === looks(entries[i]!)
    )!
    add(
      "structure",
      `${path}[${i}]`,
      `${noun} "${entries[i]!.id}" looks the same as ${noun.toLowerCase()} "${twin.id}", so a learner can't tell them apart. Make each one different.`
    )
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

/**
 * The countries a text names: in English, in the lesson's language, or by a common other name. A
 * name inside a longer one doesn't count, so "South Sudan" names South Sudan, not Sudan too.
 */
function countriesNamed(
  text: string,
  codes: string[],
  language: string
): Set<string> {
  if (!text) return new Set()
  const found = codes.flatMap((code) =>
    namePatterns(code, language).flatMap((re) =>
      [...text.matchAll(re)].map((m) => ({
        code,
        start: m.index,
        end: m.index + m[0].length,
      }))
    )
  )
  return new Set(
    found
      .filter(
        (a) =>
          !found.some(
            (b) =>
              b.code !== a.code &&
              b.start <= a.start &&
              b.end >= a.end &&
              b.end - b.start > a.end - a.start
          )
      )
      .map((a) => a.code)
  )
}

/** A country's names as whole-word patterns, made once per language. */
const patterns = new Map<string, RegExp[]>()
function namePatterns(code: string, language: string): RegExp[] {
  const key = `${language}:${code}`
  const known = patterns.get(key)
  if (known) return known
  const names = new Set(
    [
      COUNTRIES[code]?.name,
      ...(COUNTRY_ALIASES[code] ?? []),
      ...[language, "en"].map((l) => regionName(l, code)),
    ].filter((n): n is string => !!n && n !== code)
  )
  const made = [...names].map(
    (n) =>
      new RegExp(
        `(?<!\\p{L})${n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?!\\p{L})`,
        "giu"
      )
  )
  patterns.set(key, made)
  return made
}

/** A country's name in a language, from the runtime's names, which are made once per language. */
const displayNames = new Map<string, Intl.DisplayNames | null>()
function regionName(language: string, code: string): string | undefined {
  try {
    if (!displayNames.has(language))
      displayNames.set(
        language,
        new Intl.DisplayNames([language], { type: "region" })
      )
    return displayNames.get(language)?.of(code)
  } catch {
    // A language the runtime can't read, or a code that isn't one (answers are checked elsewhere).
    if (!displayNames.has(language)) displayNames.set(language, null)
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

/** What a visual is called in messages. */
const VISUAL_NAMES: Partial<Record<Visual["kind"], string>> = {
  html: "HTML visual",
  numberline: "number line",
  fraction: "fraction picture",
  chess: "chess position",
  chat: "chat",
}
const visualName = (v: Visual) => VISUAL_NAMES[v.kind] ?? v.kind
