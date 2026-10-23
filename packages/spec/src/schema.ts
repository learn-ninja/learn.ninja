import { z } from "zod"

import { SUBJECTS } from "./subjects"
import { TAG_LABEL_PATTERN, TAG_LIMITS } from "./tags"

// Lesson spec v0.8: the shape of a lesson file.
// Structural limits that JSON Schema can express live here; cross-field and
// teaching-quality rules live in rules.ts.

export const SPEC_VERSION = "0.8" as const

/** Who a lesson is for, from least to most prior knowledge. The skill's `levels/` guides say how each one teaches. */
export const LEVELS = ["beginner", "intermediate", "advanced"] as const
export type Level = (typeof LEVELS)[number]

const id = z.string().min(1).max(64)
/** Markdown subset: **bold**, *italic*, `code`, and inline formulas as \( ... \). A $ is always a dollar sign. */
const richText = z.string().min(1)
/** A BCP 47 language code, e.g. "en", "es", "ar", "pt-BR". Checked further in rules.ts. */
const langCode = z.string().min(2).max(35)

/** One of the subjects in subjects.ts. The message lists them, so an agent that guessed can pick again. */
const subject = z.enum(SUBJECTS, {
  error: `"subject" must be one of: ${SUBJECTS.join(", ")}. Pick by what the learner will do afterwards; the format reference's subject table has the scope of each.`,
})

/** A tag as the lesson keeps it: a short label as a reader sees it, already trimmed by the checker (tags.ts). */
const tag = z
  .string()
  .min(TAG_LIMITS.min)
  .max(TAG_LIMITS.max)
  .regex(TAG_LABEL_PATTERN, {
    error:
      'A tag is a short label as a reader should see it, like "Claude Code" or "Compound interest": letters, digits, spaces, and - + # . & / \', not starting with #.',
  })

// ---------- visuals ----------

export const htmlVisual = z
  .strictObject({
    kind: z.literal("html"),
    html: z.string().min(1),
    /** One sentence saying what the visual shows, for screen readers. Required on concept and question visuals (rules.ts). */
    alt: z.string().min(1).max(200).optional(),
    css: z.string().optional(),
    height: z.int().positive().optional(),
  })
  .meta({ id: "HtmlVisual" })

export const codeVisual = z
  .strictObject({
    kind: z.literal("code"),
    code: z.string().min(1),
    language: z.string().min(1),
    highlight: z.array(z.int().positive()).optional(),
    hotspots: z
      .array(z.strictObject({ id, line: z.int().positive() }))
      .optional(),
  })
  .meta({ id: "CodeVisual" })

export const mathVisual = z
  .strictObject({
    kind: z.literal("math"),
    tex: z.string().min(1),
  })
  .meta({ id: "MathVisual" })

/** A plain number or a category name on the x axis; y is always a number. */
const chartX = z.union([z.number(), z.string().min(1).max(40)])
const axisLabel = z.string().min(1).max(60).optional()

/** A chart drawn from points the lesson gives. */
const dataChartVisual = z
  .strictObject({
    kind: z.literal("chart"),
    /** scatter: numeric x and y. bar and line: x is a category or a number, in the order given. */
    type: z.enum(["scatter", "bar", "line"]),
    /** One sentence saying what the chart shows, for screen readers. Required (rules.ts). */
    alt: z.string().min(1).max(200).optional(),
    x: z.strictObject({ label: axisLabel }).optional(),
    y: z.strictObject({ label: axisLabel }).optional(),
    /** The points, in order. `label` names a point on a scatter; `series` groups points into lines or colors (up to 3). */
    data: z
      .array(
        z.strictObject({
          x: chartX,
          y: z.number(),
          label: z.string().min(1).max(24).optional(),
          series: z.string().min(1).max(24).optional(),
        })
      )
      .min(2)
      .max(60),
    /** A fitted trend line through the points (scatter only). */
    trend: z.boolean().optional(),
  })
  .meta({ id: "DataChartVisual" })

/**
 * A chart of one to three functions of x, each written as an expression ("sin(x)", "x^2 - 2",
 * "1000 * 1.05^x"). The player samples and draws them at publish time (packages/player/src/curve.ts
 * reads the expressions; the checker rejects one it can't read or that has no finite value).
 */
const functionChartVisual = z
  .strictObject({
    kind: z.literal("chart"),
    type: z.literal("function"),
    /** One sentence saying what the chart shows, for screen readers. Required (rules.ts). */
    alt: z.string().min(1).max(200).optional(),
    /** The range of x to draw, and an optional axis label. */
    x: z.strictObject({ label: axisLabel, min: z.number(), max: z.number() }),
    /** An optional label and range for the y axis; without a range it fits the curves. */
    y: z
      .strictObject({
        label: axisLabel,
        min: z.number().optional(),
        max: z.number().optional(),
      })
      .optional(),
    /** The curves (at most LIMITS.chartSeries). `label` names one where the curve ends; it defaults to the expression. */
    series: z
      .array(
        z.strictObject({
          /** A formula in x: numbers, x, pi, e, + - * / ^, parentheses, and functions like sin, sqrt, exp, ln, abs. */
          expression: z.string().min(1).max(120),
          label: z.string().min(1).max(24).optional(),
        })
      )
      .min(1)
      .max(3),
  })
  .meta({ id: "FunctionChartVisual" })

export const chartVisual = z
  .discriminatedUnion("type", [dataChartVisual, functionChartVisual])
  .meta({ id: "ChartVisual" })

export const diagramVisual = z
  .strictObject({
    kind: z.literal("diagram"),
    /** The diagram in D2 (https://d2lang.com): boxes, arrows, containers. Laid out and drawn at publish time. */
    d2: z.string().min(1).max(4000),
    /** One sentence saying what the diagram shows, for screen readers. Required (rules.ts). */
    alt: z.string().min(1).max(200).optional(),
  })
  .meta({ id: "DiagramVisual" })

export const visual = z
  .discriminatedUnion("kind", [
    htmlVisual,
    codeVisual,
    mathVisual,
    chartVisual,
    diagramVisual,
  ])
  .meta({ id: "Visual" })

// ---------- shared pieces ----------

export const option = z
  .strictObject({
    id,
    text: richText.optional(),
    visual: visual.optional(),
    feedback: richText.optional(),
    lang: langCode.optional(),
  })
  .refine((o) => o.text !== undefined || o.visual !== undefined, {
    error: "An option needs text or a visual.",
  })
  .meta({ id: "Option" })

/** What every question brick has. */
const questionBase = {
  id,
  prompt: richText,
  visual: visual.optional(),
  hint: richText.optional(),
  explanation: richText,
}

const textMistake = z.strictObject({
  answer: z.string().min(1),
  feedback: richText,
})
const numberMistake = z.strictObject({ answer: z.number(), feedback: richText })

// ---------- bricks: one concept brick and nine question bricks ----------

export const choiceBrick = z
  .strictObject({
    ...questionBase,
    type: z.literal("choice"),
    options: z.array(option).min(2).max(5),
    correct: z.array(id).min(1),
    multiple: z.boolean(),
  })
  .meta({ id: "ChoiceBrick" })

export const compareBrick = z
  .strictObject({
    ...questionBase,
    type: z.literal("compare"),
    options: z.array(option).length(2),
    correct: id,
  })
  .meta({ id: "CompareBrick" })

export const orderItem = z
  .strictObject({
    id,
    text: richText.optional(),
    visual: visual.optional(),
    lang: langCode.optional(),
  })
  .refine((i) => i.text !== undefined || i.visual !== undefined, {
    error: "An item needs text or a visual.",
  })
  .meta({ id: "OrderItem" })

export const orderBrick = z
  .strictObject({
    ...questionBase,
    type: z.literal("order"),
    /** Written in the correct order; the player shuffles them. */
    items: z.array(orderItem).min(3).max(6),
    /** Other valid orders, as arrays of item ids. */
    alsoAccept: z.array(z.array(id)).optional(),
  })
  .meta({ id: "OrderBrick" })

export const sortBrick = z
  .strictObject({
    ...questionBase,
    type: z.literal("sort"),
    groups: z
      .array(
        z.strictObject({
          id,
          label: z.string().min(1),
          lang: langCode.optional(),
        })
      )
      .min(2)
      .max(3),
    items: z
      .array(
        z.strictObject({
          id,
          text: richText,
          group: id,
          lang: langCode.optional(),
        })
      )
      .min(4)
      .max(8),
  })
  .meta({ id: "SortBrick" })

export const matchBrick = z
  .strictObject({
    ...questionBase,
    type: z.literal("match"),
    pairs: z
      .array(z.strictObject({ left: richText, right: richText }))
      .min(3)
      .max(5),
    leftLang: langCode.optional(),
    rightLang: langCode.optional(),
  })
  .meta({ id: "MatchBrick" })

export const blank = z
  .strictObject({
    id,
    accept: z.array(z.string().min(1)).min(1),
    /** Word chips. Required in v1 (no typed answers); checked in rules.ts. */
    choices: z.array(z.string().min(1)).min(2).optional(),
    mistakes: z.array(textMistake).optional(),
    numeric: z.boolean().optional(),
    tolerance: z.number().nonnegative().optional(),
    strictAccents: z.boolean().optional(),
  })
  .meta({ id: "Blank" })

export const blankBrick = z
  .strictObject({
    ...questionBase,
    type: z.literal("blank"),
    /** Text or code with [[id]] gaps. */
    template: z.string().min(1),
    format: z.enum(["text", "code"]),
    language: z.string().min(1).optional(),
    lang: langCode.optional(),
    caseSensitive: z.boolean().optional(),
    blanks: z.array(blank).min(1),
  })
  .meta({ id: "BlankBrick" })

export const hotspotBrick = z
  .strictObject({
    ...questionBase,
    type: z.literal("hotspot"),
    /** An html visual with data-hotspot elements, or a code visual with hotspots. */
    visual: z.discriminatedUnion("kind", [htmlVisual, codeVisual]),
    correct: z.array(id).min(1),
    multiple: z.boolean(),
  })
  .meta({ id: "HotspotBrick" })

export const scenarioBrick = z
  .strictObject({
    ...questionBase,
    type: z.literal("scenario"),
    situation: richText,
    options: z
      .array(
        z.strictObject({
          id,
          text: richText,
          quality: z.enum(["best", "okay", "poor"]),
          outcome: richText,
          lang: langCode.optional(),
        })
      )
      .min(2)
      .max(4),
  })
  .meta({ id: "ScenarioBrick" })

/** Defined in the spec, but not allowed in v1 lessons (numeric questions use choice). */
export const numberBrick = z
  .strictObject({
    ...questionBase,
    type: z.literal("number"),
    answer: z.number(),
    tolerance: z.number().nonnegative().optional(),
    unit: z.string().min(1).optional(),
    mistakes: z.array(numberMistake).optional(),
  })
  .meta({ id: "NumberBrick" })

/** Theory: one short idea, shown before the questions that practise it. Not scored. */
export const conceptBrick = z
  .strictObject({
    id,
    type: z.literal("concept"),
    title: z.string().min(1).max(60),
    body: richText,
    visual: visual.optional(),
  })
  .meta({ id: "ConceptBrick" })

/** A brick that asks the learner something and checks the answer. */
export const questionBrick = z
  .discriminatedUnion("type", [
    choiceBrick,
    compareBrick,
    orderBrick,
    sortBrick,
    matchBrick,
    blankBrick,
    hotspotBrick,
    scenarioBrick,
    numberBrick,
  ])
  .meta({ id: "QuestionBrick" })

export const brick = z
  .discriminatedUnion("type", [conceptBrick, ...questionBrick.options])
  .meta({ id: "Brick" })

/** The hook is a guess before any teaching, so it's always a choice or compare brick. */
export const hookBrick = z
  .discriminatedUnion("type", [choiceBrick, compareBrick])
  .meta({ id: "HookBrick" })

// ---------- lesson ----------

export const lesson = z.strictObject({
  spec: z.literal(SPEC_VERSION),
  title: z.string().min(1).max(60),
  summary: z.string().min(1).max(160),
  objective: z.string().min(1),
  language: langCode,
  targetLanguage: langCode.optional(),
  level: z.enum(LEVELS),
  estimatedMinutes: z.int().min(3).max(15),
  subject,
  /**
   * One to five labels, from the thing taught to the field it sits in; the first is the lesson's
   * label on Explore rows and the title screen. Checked further in rules.ts.
   */
  tags: z.array(tag).min(1).max(TAG_LIMITS.perLesson),
  source: z
    .strictObject({ title: z.string().min(1), url: z.url().optional() })
    .optional(),
  hook: hookBrick,
  /**
   * The teaching part, in play order: each concept brick is followed by the 1–6 question bricks
   * that practise it. The rhythm is checked in rules.ts.
   */
  bricks: z.array(brick).min(3).max(20),
  challenge: questionBrick,
  wrapup: z.strictObject({
    takeaways: z.array(richText).min(2).max(4),
    next: z.string().min(1).optional(),
  }),
})

export type Lesson = z.infer<typeof lesson>
export type Brick = z.infer<typeof brick>
export type QuestionBrick = z.infer<typeof questionBrick>
export type ConceptBrick = z.infer<typeof conceptBrick>
export type Visual = z.infer<typeof visual>
export type ChartVisual = z.infer<typeof chartVisual>
export type DataChartVisual = z.infer<typeof dataChartVisual>
export type FunctionChartVisual = z.infer<typeof functionChartVisual>
export type DiagramVisual = z.infer<typeof diagramVisual>
