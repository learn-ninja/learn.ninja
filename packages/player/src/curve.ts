import { all, create } from "mathjs/number"
import type {
  ConstantNode,
  FunctionNode,
  MathNode,
  OperatorNode,
  ParenthesisNode,
  SymbolNode,
} from "mathjs"

import { everyVisual, type Issue, type Lesson } from "@workspace/spec"

// Reads the expressions of a function chart ("sin(x)", "x^2 - 2", "1000 * 1.05^x") and samples them
// into points for chart.ts to draw. A lesson is written by an LLM, so an expression is untrusted:
// mathjs parses it into a tree, and only arithmetic, powers, and a list of common functions may
// appear in it (no assignment, no indexing, no lists, no units, no evaluate or import). Nothing is
// ever passed to eval. The number-only build keeps sqrt(-1) a NaN (a gap) rather than a complex number.

// `all` is typed as possibly undefined; the number build always exports it.
const math = create(all!, { predictable: true })
math.import({ ln: (x: number) => Math.log(x) })

/** How many points a curve is sampled at, across its x range. */
export const SAMPLES = 200
/** How long sampling one expression may take before it's rejected. */
const BUDGET_MS = 100

const SYMBOLS = new Set(["x", "pi", "e", "tau"])
const OPERATORS = new Set([
  "add",
  "subtract",
  "multiply",
  "divide",
  "pow",
  "unaryMinus",
  "unaryPlus",
  "mod",
  "factorial",
])
export const FUNCTIONS = [
  "sin",
  "cos",
  "tan",
  "asin",
  "acos",
  "atan",
  "atan2",
  "sinh",
  "cosh",
  "tanh",
  "sqrt",
  "cbrt",
  "abs",
  "exp",
  "ln",
  "log",
  "log2",
  "log10",
  "floor",
  "ceil",
  "round",
  "sign",
  "min",
  "max",
]
const FUNCTION_SET = new Set(FUNCTIONS)

const HOW_TO = `Write one formula in x with numbers, + - * / ^, parentheses, pi and e, and functions like sin(x), sqrt(x), exp(x), ln(x), or abs(x), such as "2x^2 - 3x + 1".`

export interface Point {
  x: number
  /** NaN where the expression has no finite value, which breaks the curve there. */
  y: number
}

export type Sampled = { points: Point[] } | { error: string }

/** Why a node may not appear in a chart expression, or null when it may. */
function disallowed(node: MathNode): string | null {
  switch (node.type) {
    case "ConstantNode":
      return typeof (node as ConstantNode).value === "number"
        ? null
        : `Only numbers can appear in a chart expression. ${HOW_TO}`
    case "SymbolNode": {
      const { name } = node as SymbolNode
      if (SYMBOLS.has(name)) return null
      if (FUNCTION_SET.has(name))
        return `"${name}" is a function, so it needs parentheses: "${name}(x)".`
      return `"${name}" isn't known in a chart expression: the variable is "x", and the constants are "pi" and "e". ${HOW_TO}`
    }
    case "ParenthesisNode":
      return disallowed((node as ParenthesisNode).content)
    case "OperatorNode": {
      const { fn, op, args } = node as OperatorNode
      if (!OPERATORS.has(fn))
        return `The operator "${op}" can't be used in a chart expression. ${HOW_TO}`
      for (const arg of args) {
        const why = disallowed(arg)
        if (why) return why
      }
      return null
    }
    case "FunctionNode": {
      const { fn, args } = node as FunctionNode
      const name = fn.type === "SymbolNode" ? (fn as SymbolNode).name : ""
      if (!FUNCTION_SET.has(name))
        return `"${name || "that"}" isn't a function a chart can draw. The functions are ${FUNCTIONS.join(", ")}.`
      for (const arg of args) {
        const why = disallowed(arg)
        if (why) return why
      }
      return null
    }
    default:
      return `A chart expression is one formula in x, like "x^2 - 2": no "=", lists, conditions, or indexes. ${HOW_TO}`
  }
}

/** The expression as a function of x, or why it can't be read. */
export function parseExpression(
  expression: string
): { f: (x: number) => number } | { error: string } {
  let node: MathNode
  try {
    node = math.parse(expression)
  } catch (e) {
    const reason = e instanceof Error ? e.message : String(e)
    return {
      error: `Can't read the expression "${expression}": ${reason}. ${HOW_TO}`,
    }
  }
  const why = disallowed(node)
  if (why) return { error: `In "${expression}": ${why}` }
  const code = node.compile()
  return {
    f: (x: number) => {
      const y: unknown = code.evaluate({ x })
      return typeof y === "number" ? y : NaN
    },
  }
}

/**
 * The expression sampled at SAMPLES points from x.min to x.max, or why it can't be drawn: it doesn't
 * parse, uses something outside the allowed list, takes too long, or is finite nowhere in the range.
 */
export function sampleExpression(
  expression: string,
  x: { min: number; max: number },
  budgetMs = BUDGET_MS
): Sampled {
  const parsed = parseExpression(expression)
  if ("error" in parsed) return parsed
  const points: Point[] = []
  const deadline = performance.now() + budgetMs
  let finite = 0
  for (let i = 0; i < SAMPLES; i++) {
    if (performance.now() > deadline)
      return {
        error: `"${expression}" takes too long to compute. Simplify it, or use smaller powers and factorials.`,
      }
    const xi = x.min + ((x.max - x.min) * i) / (SAMPLES - 1)
    let y: number
    try {
      y = parsed.f(xi)
    } catch {
      y = NaN
    }
    if (Number.isFinite(y)) finite++
    else y = NaN
    points.push({ x: xi, y })
  }
  if (finite === 0)
    return {
      error: `"${expression}" has no finite value anywhere from x = ${x.min} to ${x.max} (as sqrt(x) has none below 0). Change the expression or the x range.`,
    }
  return { points }
}

/**
 * The publish-time check for function charts, which needs the expression parser and so can't live
 * in the spec's rules: every curve must be an allowed expression with at least one finite point.
 */
export function checkFunctionCharts(lesson: Lesson): Issue[] {
  const issues: Issue[] = []
  for (const { visual, path } of everyVisual(lesson)) {
    if (visual.kind !== "chart" || visual.type !== "function") continue
    ;(visual.series ?? []).forEach((s, i) => {
      const sampled = sampleExpression(s.expression, visual.x)
      if ("error" in sampled)
        issues.push({
          kind: "structure",
          path: `${path}.series[${i}].expression`,
          message: sampled.error,
        })
    })
  }
  return issues
}
