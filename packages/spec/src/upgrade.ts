// Older lesson files, brought up to the current spec. Published lessons and older skills can
// still hand us spec 0.2, 0.3 (with or without a concept brick's `term`, since dropped), 0.4, or
// 0.5, so the server upgrades them before validating or playing them. 0.3 to 0.4 only added the
// chart visual and 0.4 to 0.5 the diagram visual, so those lessons need nothing but their version
// changed. 0.6 replaced the free-text `topic` label with a `subject` from a fixed list and `tags`:
// the old label is mapped to a subject by a small lookup (and otherwise to `life`), and kept as a
// tag so nothing is lost.

import { redundantTag } from "./rules"
import { SPEC_VERSION } from "./schema"
import { isSubject, type Subject } from "./subjects"
import { normalizeTag, TAG_LIMITS, TAG_PATTERN } from "./tags"

interface LessonV02 {
  spec: "0.2"
  loops: { concept: Record<string, unknown>; practice: unknown[] }[]
  [key: string]: unknown
}

const OLD_SPECS = ["0.2", "0.3", "0.4", "0.5"]

/** True for data that claims an older spec, or has a concept `term`, that this module can upgrade. */
export function canUpgrade(data: unknown): boolean {
  if (typeof data !== "object" || data === null) return false
  const { spec, bricks } = data as { spec?: unknown; bricks?: unknown }
  return (
    (typeof spec === "string" && OLD_SPECS.includes(spec)) ||
    (Array.isArray(bricks) && bricks.some(hasTerm))
  )
}

function hasTerm(brick: unknown): boolean {
  return (
    typeof brick === "object" &&
    brick !== null &&
    (brick as { type?: unknown }).type === "concept" &&
    "term" in brick
  )
}

/**
 * Brings a lesson up to the current spec. From 0.2, each loop's concept becomes a concept brick,
 * followed by its practice bricks. Concept bricks lose their `term`. A `topic` becomes a subject
 * and a tag. Anything else comes back unchanged, for validateLesson to judge.
 */
export function upgradeLesson(data: unknown): unknown {
  if (!canUpgrade(data)) return data
  if ((data as { spec?: unknown }).spec !== "0.2") {
    const lesson = data as { bricks?: unknown[] }
    return withSubject({
      ...lesson,
      spec: SPEC_VERSION,
      bricks: Array.isArray(lesson.bricks)
        ? lesson.bricks.map(withoutTerm)
        : lesson.bricks,
    })
  }
  const { loops, ...rest } = data as LessonV02
  if (!Array.isArray(loops)) return withSubject({ ...rest, spec: SPEC_VERSION })
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(rest)) {
    if (key === "challenge")
      out.bricks = loops.flatMap((loop) => [
        conceptBrick(loop?.concept),
        ...(Array.isArray(loop?.practice) ? loop.practice : []),
      ])
    out[key] = key === "spec" ? SPEC_VERSION : value
  }
  return withSubject(out)
}

function conceptBrick(concept: Record<string, unknown> | undefined) {
  const { id, term: _term, ...rest } = concept ?? {}
  return { id, type: "concept", ...rest }
}

function withoutTerm(brick: unknown) {
  if (!hasTerm(brick)) return brick
  const { term: _term, ...rest } = brick as Record<string, unknown>
  return rest
}

/**
 * The labels lessons were given as `topic` before 0.6, each mapped to a subject. A best effort for
 * what's already in the database; anything else lands in `life`, the widest subject, with the label
 * kept as a tag so a person (or a later upgrade) can move it.
 */
const TOPIC_SUBJECTS: Record<string, Subject> = {
  // The bundled examples
  "ui design": "design",
  "product management": "business",
  "personal finance": "money",
  data: "math",
  javascript: "programming",
  spanish: "languages",
  history: "history",
  // Labels seen on published lessons
  startups: "business",
  "git & claude code": "tools",
  "claude code": "tools",
  // Subject names and near misses an agent would reach for
  programming: "programming",
  coding: "programming",
  "software engineering": "programming",
  "web development": "programming",
  python: "programming",
  typescript: "programming",
  ai: "ai",
  "artificial intelligence": "ai",
  "machine learning": "ai",
  llms: "ai",
  tools: "tools",
  productivity: "tools",
  git: "tools",
  design: "design",
  "ux design": "design",
  "product design": "design",
  business: "business",
  product: "business",
  management: "business",
  marketing: "marketing",
  writing: "marketing",
  sales: "marketing",
  finance: "money",
  investing: "money",
  money: "money",
  economics: "money",
  science: "science",
  physics: "science",
  chemistry: "science",
  biology: "science",
  math: "math",
  maths: "math",
  mathematics: "math",
  statistics: "math",
  "data science": "math",
  health: "health",
  fitness: "health",
  nutrition: "health",
  medicine: "health",
  psychology: "society",
  philosophy: "society",
  politics: "society",
  law: "society",
  geography: "society",
  society: "society",
  languages: "languages",
  language: "languages",
  english: "languages",
  french: "languages",
  german: "languages",
  arts: "arts",
  art: "arts",
  music: "arts",
  film: "arts",
  literature: "arts",
  culture: "arts",
  cooking: "life",
  travel: "life",
  life: "life",
  careers: "careers",
  career: "careers",
  learning: "careers",
  education: "careers",
}

/** The subject an old `topic` label maps to: the lookup above, else `life`. */
export function subjectForTopic(topic: unknown): Subject {
  if (typeof topic !== "string") return "life"
  return TOPIC_SUBJECTS[topic.trim().toLowerCase()] ?? "life"
}

/**
 * Gives a pre-0.6 lesson its `subject` (from its `topic`, or `life`) and keeps the old label as a
 * tag when it's a valid one and says something the fields don't. A lesson that already has a
 * subject keeps it; `topic` goes either way.
 */
function withSubject(lesson: Record<string, unknown>): Record<string, unknown> {
  const { topic, ...rest } = lesson
  const subject = isSubject(rest.subject)
    ? rest.subject
    : subjectForTopic(topic)
  const tags = Array.isArray(rest.tags) ? [...rest.tags] : []
  if (typeof topic === "string") {
    const tag = normalizeTag(topic)
    const fits =
      tag.length >= TAG_LIMITS.min &&
      tag.length <= TAG_LIMITS.max &&
      TAG_PATTERN.test(tag)
    const fields = {
      subject,
      language: typeof rest.language === "string" ? rest.language : "",
      targetLanguage:
        typeof rest.targetLanguage === "string"
          ? rest.targetLanguage
          : undefined,
    }
    if (
      fits &&
      !tags.includes(tag) &&
      tags.length < TAG_LIMITS.perLesson &&
      !redundantTag(tag, fields)
    )
      tags.push(tag)
  }
  // Keep the field order a hand-written file has: subject and tags after estimatedMinutes.
  const out: Record<string, unknown> = {}
  let placed = false
  const place = () => {
    if (placed) return
    placed = true
    out.subject = subject
    if (tags.length) out.tags = tags
  }
  for (const [key, value] of Object.entries(rest)) {
    if (key === "subject" || key === "tags") {
      place()
      continue
    }
    if (key === "source" || key === "hook") place()
    out[key] = value
    if (key === "estimatedMinutes") place()
  }
  place()
  return out
}
