import { describe, expect, it } from "vitest"

import { loadExample } from "./test-helpers"
import { bareCode, positionalReference } from "./rules"
import { SUBJECTS } from "./subjects"
import { validateLesson } from "./validate"

// Each test breaks a valid example lesson in one way and checks the right issue comes back.

function issuesFor(lesson: unknown) {
  const result = validateLesson(lesson)
  expect(result.ok).toBe(false)
  return result.issues
}

function expectIssue(
  lesson: unknown,
  match: { path?: string; message: RegExp; kind?: string }
) {
  const issues = issuesFor(lesson)
  const found = issues.find(
    (i) =>
      match.message.test(i.message) &&
      (match.path === undefined || i.path === match.path) &&
      (match.kind === undefined || i.kind === match.kind)
  )
  if (!found)
    throw new Error(
      `Expected an issue like ${match.message} at "${match.path ?? "*"}", got:\n${JSON.stringify(issues, null, 2)}`
    )
}

const buttons = () => loadExample("button-hierarchy.json")
const compound = () => loadExample("compound-interest.json")

describe("visuals", () => {
  it("wants alt text on a concept's HTML visual", () => {
    const lesson = buttons()
    delete lesson.bricks[0].visual.alt
    expectIssue(lesson, { path: "bricks[0].visual", message: /no "alt"/ })
  })

  it("wants alt text on a question's HTML visual", () => {
    const lesson = compound()
    delete lesson.bricks[6].visual.alt
    expectIssue(lesson, { path: "bricks[6].visual", message: /no "alt"/ })
  })

  it("doesn't need alt text on a hotspot visual", () => {
    const lesson = buttons()
    expect(lesson.bricks[2].type).toBe("hotspot")
    expect(lesson.bricks[2].visual.alt).toBeUndefined()
    expect(validateLesson(lesson).ok).toBe(true)
  })

  it("wants alt text on an option's visual without a caption", () => {
    const lesson = buttons()
    delete lesson.hook.options[0].visual.alt
    expectIssue(lesson, {
      path: "hook.options[0].visual",
      message: /no "alt" and no caption/,
    })
  })

  it("reads an option's visual through its caption when it has one", () => {
    const lesson = buttons()
    delete lesson.hook.options[0].visual.alt
    lesson.hook.options[0].text = "Three filled buttons"
    expect(validateLesson(lesson).ok).toBe(true)
  })
})

describe("schema", () => {
  it("rejects text that isn't JSON", () => {
    expect(validateLesson("{ not json")).toMatchObject({
      ok: false,
      issues: [{ message: expect.stringMatching(/isn't valid JSON/) }],
    })
  })

  it("rejects unknown fields, so typos are caught", () => {
    const l = buttons()
    l.bricks[1].colour = "blue"
    expectIssue(l, { path: "bricks[1]", message: /colour/ })
  })

  it("only allows choice or compare as the hook", () => {
    const l = buttons()
    l.hook = { ...l.challenge, id: "hook" }
    expectIssue(l, { path: "hook.type", message: /choice|compare/ })
  })

  it("only allows question bricks as the challenge", () => {
    const l = buttons()
    l.challenge = { ...l.bricks[0], id: "ch" }
    expectIssue(l, { path: "challenge.type", message: /concept|choice/ })
  })

  it("requires the current spec version", () => {
    const l = buttons()
    l.spec = "0.1"
    expectIssue(l, { path: "spec", message: /0\.8/ })
  })

  it("requires a subject from the list, and names every subject when it's wrong or missing", () => {
    const l = buttons()
    l.subject = "coding"
    const all = new RegExp(SUBJECTS.join(", "))
    expectIssue(l, { path: "subject", message: all })
    delete l.subject
    expectIssue(l, { path: "subject", message: all })
  })

  it("no longer knows the topic field", () => {
    const l = buttons()
    l.topic = "UI design"
    expectIssue(l, { message: /topic/ })
  })
})

describe("tags", () => {
  it("allows up to five, each 2–30 characters in the tag shape", () => {
    const l = buttons()
    l.tags = ["a", "b"]
    expectIssue(l, { path: "tags[0]", message: />=2/ })
    l.tags = ["x".repeat(31)]
    expectIssue(l, { path: "tags[0]", message: /<=30/ })
    l.tags = ["one", "two", "three", "four", "five", "six"]
    expectIssue(l, { path: "tags", message: /<=5/ })
    // Labels keep their punctuation where it means something; the key folds it.
    l.tags = ["C++", "C#", "Node.js", "A/B testing", "Ohm's law"]
    expect(validateLesson(l).ok).toBe(true)
    l.tags = ["claude_code"]
    expectIssue(l, { path: "tags[0]", message: /short label/ })
    l.tags = ["Buttons!"]
    expectIssue(l, { path: "tags[0]", message: /short label/ })
    l.tags = ["Buttons", "Call to action", "User interface", "Forms", "UI kit"]
    expect(validateLesson(l).ok).toBe(true)
    // At least one: the first tag is the lesson's label.
    l.tags = []
    expectIssue(l, { path: "tags", message: />=1/ })
    delete l.tags
    expectIssue(l, { path: "tags", message: /expected array/ })
  })

  it("tidies labels, keeps the result, and says so in a note, but leaves casing alone", () => {
    const l = buttons()
    l.tags = ["  Claude  Code ", "#Git", "forms"]
    const result = validateLesson(l)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.lesson.tags).toEqual(["Claude Code", "Git", "forms"])
    expect(result.notes).toEqual([
      {
        path: "tags[0]",
        message: 'Kept the tag "  Claude  Code " as "Claude Code".',
      },
      { path: "tags[1]", message: 'Kept the tag "#Git" as "Git".' },
    ])
    expect(validateLesson(buttons()).notes).toEqual([])
  })

  it("rejects a tag whose key repeats the subject, a level, or a language", () => {
    const l = buttons()
    l.tags = ["Design"]
    expectIssue(l, {
      path: "tags[0]",
      message: /The tag "Design" repeats the subject/,
    })
    l.tags = ["Beginner"]
    expectIssue(l, { path: "tags[0]", message: /is a level/ })
    l.tags = ["English"]
    expectIssue(l, { path: "tags[0]", message: /names a language.*"language"/ })
    l.tags = ["en"]
    expectIssue(l, { path: "tags[0]", message: /language code/ })
    const greetings = loadExample("spanish-greetings.json")
    greetings.tags = ["Spanish"]
    expectIssue(greetings, { path: "tags[0]", message: /"targetLanguage"/ })
    // Another subject's name is fine: that's where a lesson's second subject goes.
    l.tags = ["Marketing"]
    expect(validateLesson(l).ok).toBe(true)
  })

  it("rejects duplicates by key, including ones the synonym table folds together", () => {
    const l = buttons()
    l.tags = ["JavaScript", "JS"]
    expectIssue(l, {
      path: "tags",
      message:
        /The tags "JavaScript" and "JS" are the same tag \("javascript"\)/,
    })
    l.tags = ["Forms", "forms"]
    expectIssue(l, {
      path: "tags",
      message: /The tags "Forms" and "forms" are the same tag \("forms"\)/,
    })
    l.tags = ["Forms", "Forms"]
    expectIssue(l, { path: "tags", message: /"Forms" appears more than once/ })
  })
})

describe("chart visuals", () => {
  const chart = (over: Record<string, unknown>) => ({
    kind: "chart",
    type: "scatter",
    alt: "A chart.",
    data: [
      { x: 1, y: 2 },
      { x: 2, y: 3 },
    ],
    ...over,
  })
  function withChart(over: Record<string, unknown>) {
    const l = buttons()
    l.bricks[0].visual = chart(over)
    return l
  }

  it("accepts a scatter, a bar, and a line", () => {
    expect(validateLesson(withChart({})).ok).toBe(true)
    expect(
      validateLesson(
        withChart({
          type: "bar",
          data: [
            { x: "A", y: 1 },
            { x: "B", y: 2 },
          ],
        })
      ).ok
    ).toBe(true)
    expect(
      validateLesson(
        withChart({
          type: "line",
          data: [
            { x: "Jan", y: 1, series: "a" },
            { x: "Jan", y: 2, series: "b" },
          ],
        })
      ).ok
    ).toBe(true)
  })

  it("wants alt text, like an HTML visual", () => {
    const l = withChart({})
    delete l.bricks[0].visual.alt
    expectIssue(l, { path: "bricks[0].visual", message: /chart has no "alt"/ })
  })

  it("wants numbers on a scatter's x axis", () => {
    expectIssue(
      withChart({
        data: [
          { x: "A", y: 1 },
          { x: 2, y: 2 },
        ],
      }),
      { path: "bricks[0].visual", message: /number for every point/ }
    )
  })

  it("keeps bars and lines to one kind of x, one point per x, and bars to one series", () => {
    expectIssue(
      withChart({
        type: "bar",
        data: [
          { x: "A", y: 1 },
          { x: 2, y: 2 },
        ],
      }),
      { message: /same kind of "x"/ }
    )
    expectIssue(
      withChart({
        type: "line",
        data: [
          { x: "A", y: 1 },
          { x: "A", y: 2 },
        ],
      }),
      { message: /"A" appears more than once/ }
    )
    expectIssue(
      withChart({
        type: "bar",
        data: [
          { x: "A", y: 1, series: "s" },
          { x: "B", y: 2 },
        ],
      }),
      { message: /one series/ }
    )
  })

  it("keeps labels and the trend line to scatters, and series to three", () => {
    expectIssue(
      withChart({
        type: "line",
        data: [
          { x: 1, y: 1, label: "a" },
          { x: 2, y: 2 },
        ],
      }),
      { message: /labels are only for scatter/ }
    )
    expectIssue(
      withChart({
        type: "bar",
        trend: true,
        data: [
          { x: "A", y: 1 },
          { x: "B", y: 2 },
        ],
      }),
      { message: /"trend" is only for scatter/ }
    )
    expectIssue(
      withChart({
        data: ["a", "b", "c", "d"].map((s, i) => ({ x: i, y: i, series: s })),
      }),
      { message: /at most 3 series/ }
    )
  })

  it("checks charts on options too", () => {
    const l = buttons()
    l.bricks[1].options[0].visual = chart({
      data: [
        { x: "A", y: 1 },
        { x: 2, y: 2 },
      ],
    })
    expectIssue(l, {
      path: "bricks[1].options[0].visual",
      message: /number for every point/,
    })
  })
})

describe("function charts", () => {
  const curve = (over: Record<string, unknown> = {}) => ({
    kind: "chart",
    type: "function",
    alt: "A sine wave.",
    x: { label: "x", min: -6, max: 6 },
    series: [{ expression: "sin(x)" }],
    ...over,
  })
  function withCurve(over: Record<string, unknown> = {}) {
    const l = buttons()
    l.bricks[0].visual = curve(over)
    return l
  }

  it("accepts up to three curves over an x range, with an optional y range", () => {
    expect(validateLesson(withCurve()).ok).toBe(true)
    expect(
      validateLesson(
        withCurve({
          y: { label: "y", min: -2, max: 2 },
          series: [
            { expression: "sin(x)", label: "sine" },
            { expression: "cos(x)", label: "cosine" },
            { expression: "x / 3" },
          ],
        })
      ).ok
    ).toBe(true)
    expect(
      validateLesson(
        withCurve({
          series: ["a", "b", "c", "d"].map((label) => ({
            expression: "x",
            label,
          })),
        })
      ).ok
    ).toBe(false)
  })

  it("wants alt text and an x range that goes up", () => {
    const l = withCurve()
    delete l.bricks[0].visual.alt
    expectIssue(l, { path: "bricks[0].visual", message: /chart has no "alt"/ })
    expectIssue(withCurve({ x: { min: 3, max: 3 } }), {
      path: "bricks[0].visual",
      message: /"x.min" \(3\) must be less than its "x.max" \(3\)/,
    })
    expectIssue(withCurve({ y: { min: 2, max: -2 } }), {
      path: "bricks[0].visual",
      message: /"y.min" \(2\) must be less than its "y.max" \(-2\)/,
    })
  })

  it("wants a label of its own for each curve", () => {
    expectIssue(
      withCurve({
        series: [
          { expression: "x", label: "f" },
          { expression: "2x", label: "f" },
        ],
      }),
      { path: "bricks[0].visual", message: /"f" is used twice/ }
    )
    expectIssue(
      withCurve({ series: [{ expression: "x" }, { expression: "x" }] }),
      { message: /"x" is used twice/ }
    )
  })

  it("rejects the fields of a data chart on a function chart", () => {
    expect(
      validateLesson(
        withCurve({
          data: [
            { x: 1, y: 1 },
            { x: 2, y: 2 },
          ],
        })
      ).ok
    ).toBe(false)
    expect(validateLesson(withCurve({ x: { label: "x" } })).ok).toBe(false)
  })
})

describe("diagram visuals", () => {
  function withDiagram(over: Record<string, unknown> = {}) {
    const l = buttons()
    l.bricks[0].visual = {
      kind: "diagram",
      d2: "request -> server -> response",
      alt: "A request goes to the server, which sends a response.",
      ...over,
    }
    return l
  }

  it("accepts a diagram", () => {
    expect(validateLesson(withDiagram()).ok).toBe(true)
  })

  it("wants alt text, like an HTML visual", () => {
    const l = withDiagram()
    delete l.bricks[0].visual.alt
    expectIssue(l, {
      path: "bricks[0].visual",
      message: /diagram has no "alt"/,
    })
  })

  it("keeps the source short", () => {
    expect(validateLesson(withDiagram({ d2: "a -> b\n".repeat(600) })).ok).toBe(
      false
    )
  })
})

describe("function chart points", () => {
  function withChart(over: Record<string, unknown> = {}) {
    const l = buttons()
    l.bricks[0].visual = {
      kind: "chart",
      type: "function",
      alt: "Three points on a plane.",
      x: { min: -5, max: 5 },
      points: [{ x: 2, y: 3, label: "A" }],
      ...over,
    }
    return l
  }

  it("accepts points with or without curves", () => {
    expect(validateLesson(withChart()).ok).toBe(true)
    expect(
      validateLesson(withChart({ series: [{ expression: "x^2 - 4" }] })).ok
    ).toBe(true)
  })

  it("needs curves or points", () => {
    expectIssue(withChart({ points: undefined }), {
      path: "bricks[0].visual",
      message: /needs curves in "series", points in "points", or both/,
    })
  })

  it("rejects a point outside the axes", () => {
    expectIssue(withChart({ points: [{ x: 6, y: 0 }] }), {
      path: "bricks[0].visual.points[0]",
      message: /\(6, 0\) is outside/,
    })
    expectIssue(withChart({ y: { max: 2 } }), {
      path: "bricks[0].visual.points[0]",
      message: /\(2, 3\) is outside/,
    })
  })
})

describe("number lines", () => {
  function withLine(over: Record<string, unknown> = {}) {
    const l = buttons()
    l.bricks[0].visual = {
      kind: "numberline",
      alt: "A hop of 4 from 3 lands on 7.",
      min: 0,
      max: 10,
      jumps: [{ from: 3, to: 7, label: "+4" }],
      points: [{ value: 7 }],
      ...over,
    }
    return l
  }

  it("accepts points, ranges, rays, and jumps on the line", () => {
    expect(validateLesson(withLine()).ok).toBe(true)
    expect(
      validateLesson(
        withLine({
          min: -5,
          max: 5,
          ranges: [{ from: -2, fromOpen: true }, { to: -4 }],
          jumps: undefined,
          points: undefined,
        })
      ).ok
    ).toBe(true)
    expect(
      validateLesson(withLine({ max: 2, step: 0.25, fractions: true })).ok
    ).toBe(false) // the jump to 7 is off this shorter line
  })

  it("wants alt text, named as a number line", () => {
    const l = withLine()
    delete l.bricks[0].visual.alt
    expectIssue(l, { message: /This number line has no "alt"/ })
  })

  it("keeps the ticks few enough to read", () => {
    expectIssue(withLine({ max: 100, jumps: undefined, points: undefined }), {
      path: "bricks[0].visual",
      message: /101 ticks; keep it to 21/,
    })
    expect(
      validateLesson(
        withLine({ max: 100, step: 10, jumps: undefined, points: undefined })
      ).ok
    ).toBe(true)
    expectIssue(withLine({ min: 3, max: 3 }), {
      message: /"min" \(3\) must be less/,
    })
  })

  it("needs a 1/n step for fraction ticks", () => {
    expect(
      validateLesson(
        withLine({
          max: 2,
          step: 0.25,
          fractions: true,
          jumps: undefined,
          points: undefined,
        })
      ).ok
    ).toBe(true)
    expectIssue(
      withLine({
        max: 2,
        step: 0.4,
        fractions: true,
        jumps: undefined,
        points: undefined,
      }),
      { path: "bricks[0].visual.step", message: /a "step" of 1\/2, 1\/3/ }
    )
  })

  it("keeps points, ranges, and jumps on the line", () => {
    expectIssue(withLine({ points: [{ value: 11 }] }), {
      path: "bricks[0].visual.points[0]",
      message: /11 is off the line/,
    })
    expectIssue(withLine({ ranges: [{}] }), {
      path: "bricks[0].visual.ranges[0]",
      message: /needs "from", "to", or both/,
    })
    expectIssue(withLine({ ranges: [{ from: 5, to: 2 }] }), {
      message: /"from" \(5\) must be less than its "to" \(2\)/,
    })
    expectIssue(withLine({ ranges: [{ from: -1 }] }), {
      message: /ends must be on the line/,
    })
    expectIssue(withLine({ jumps: [{ from: 3, to: 3 }] }), {
      message: /starts and lands on 3/,
    })
    expectIssue(withLine({ jumps: [{ from: 8, to: 12 }] }), {
      path: "bricks[0].visual.jumps[0]",
      message: /start and land on the line/,
    })
  })
})

describe("fractions and clocks", () => {
  function withVisual(visual: Record<string, unknown>) {
    const l = buttons()
    l.bricks[0].visual = visual
    return l
  }
  const wall = {
    kind: "fraction",
    alt: "One half is two quarters.",
    fractions: [
      { parts: 2, shaded: 1 },
      { parts: 4, shaded: 2 },
    ],
  }

  it("accepts fractions as bars or circles", () => {
    expect(validateLesson(withVisual(wall)).ok).toBe(true)
    expect(validateLesson(withVisual({ ...wall, shape: "circle" })).ok).toBe(
      true
    )
  })

  it("shades no more parts than the whole has", () => {
    expectIssue(withVisual({ ...wall, fractions: [{ parts: 4, shaded: 5 }] }), {
      path: "bricks[0].visual.fractions[0]",
      message: /5 shaded parts is more than the 4/,
    })
  })

  it("reads a clock's time in 12- or 24-hour form", () => {
    const clock = { kind: "clock", alt: "A quarter to four.", time: "3:45" }
    expect(validateLesson(withVisual(clock)).ok).toBe(true)
    expect(validateLesson(withVisual({ ...clock, time: "15:45" })).ok).toBe(
      true
    )
    for (const time of ["3.45", "25:00", "3:5", "quarter to four"])
      expectIssue(withVisual({ ...clock, time }), {
        message: /hours and minutes, like "3:45"/,
      })
  })
})

describe("chess visuals", () => {
  // After 1. e4 e5 2. Nf3: the knight attacks the pawn on e5.
  const AFTER_NF3 =
    "rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2"
  function withChess(over: Record<string, unknown> = {}) {
    const l = buttons()
    l.bricks[0].visual = {
      kind: "chess",
      fen: AFTER_NF3,
      alt: "After 1. e4 e5 2. Nf3, the white knight attacks the pawn on e5.",
      highlight: ["e5"],
      arrows: [{ from: "f3", to: "e5" }],
      ...over,
    }
    return l
  }

  it("accepts a position, with or without the FEN's other fields", () => {
    expect(validateLesson(withChess()).ok).toBe(true)
    expect(
      validateLesson(withChess({ fen: AFTER_NF3.split(" ")[0], flip: true })).ok
    ).toBe(true)
  })

  it("wants alt text", () => {
    const l = withChess()
    delete l.bricks[0].visual.alt
    expectIssue(l, {
      path: "bricks[0].visual",
      message: /chess position has no "alt"/,
    })
  })

  it("names the rank that doesn't add up to 8 squares", () => {
    expectIssue(
      withChess({ fen: "rnbqkbnr/pppp1ppp/8/4p3/4P4/5N2/PPPP1PPP/RNBQKB1R" }),
      { path: "bricks[0].visual.fen", message: /Rank 4 \("4P4"\) covers 9/ }
    )
    expectIssue(withChess({ fen: "8/8/8/8/8/8/8" }), {
      path: "bricks[0].visual.fen",
      message: /has 7/,
    })
    expectIssue(withChess({ fen: "8/8/8/8/8/8/8/4X3" }), {
      path: "bricks[0].visual.fen",
      message: /"X", which isn't a piece/,
    })
    expectIssue(withChess({ fen: "8/8/8/8/8/8/8/K6K" }), {
      path: "bricks[0].visual.fen",
      message: /at most one king/,
    })
  })

  it("rejects an arrow from an empty square, unless an arrow brought a piece there", () => {
    expectIssue(withChess({ arrows: [{ from: "g5", to: "e6" }] }), {
      path: "bricks[0].visual.arrows[0]",
      message: /starts on g5, which is empty/,
    })
    expect(
      validateLesson(
        withChess({
          arrows: [
            { from: "f3", to: "g5" },
            { from: "g5", to: "e6" },
          ],
        })
      ).ok
    ).toBe(true)
    expectIssue(withChess({ arrows: [{ from: "f3", to: "f3" }] }), {
      message: /starts and ends on f3/,
    })
  })

  it("checks squares and highlights", () => {
    expectIssue(withChess({ highlight: ["e9"] }), { message: /like "e4"/ })
    expectIssue(withChess({ highlight: ["e5", "e5"] }), {
      path: "bricks[0].visual.highlight",
      message: /"e5" is listed twice/,
    })
  })

  describe("as a hotspot", () => {
    // Black to move: which square does the knight on f3 attack?
    function chessHotspot(over: Record<string, unknown> = {}) {
      const l = buttons()
      l.bricks[2].visual = {
        kind: "chess",
        fen: AFTER_NF3,
        alt: "After 1. e4 e5 2. Nf3, with Black to move.",
        highlight: ["f3"],
      }
      l.bricks[2].correct = ["e5"]
      Object.assign(l.bricks[2], over)
      return l
    }

    it("takes squares as answers", () => {
      expect(validateLesson(chessHotspot()).ok).toBe(true)
      expect(
        validateLesson(chessHotspot({ correct: ["e5", "d4"], multiple: true }))
          .ok
      ).toBe(true)
      expectIssue(chessHotspot({ correct: ["create"] }), {
        path: "bricks[2].correct",
        message: /"create" isn't a square/,
      })
    })

    it("wants alt text, since the squares are only names", () => {
      const l = chessHotspot()
      delete l.bricks[2].visual.alt
      expectIssue(l, {
        path: "bricks[2].visual",
        message: /chess position has no "alt"/,
      })
    })

    it("doesn't let a highlight or an arrow give the answer away", () => {
      const highlighted = chessHotspot()
      highlighted.bricks[2].visual.highlight = ["f3", "e5"]
      expectIssue(highlighted, {
        path: "bricks[2].visual.highlight",
        message: /e5 is an answer and it's highlighted/,
      })
      const arrow = chessHotspot()
      arrow.bricks[2].visual.arrows = [{ from: "f3", to: "e5" }]
      expectIssue(arrow, {
        path: "bricks[2].visual.arrows",
        message: /An arrow ends on e5/,
      })
    })
  })
})

describe("map visuals", () => {
  function withMap(over: Record<string, unknown> = {}) {
    const l = buttons()
    l.bricks[0].visual = {
      kind: "map",
      region: "europe",
      alt: "The six founders of the European Coal and Steel Community.",
      countries: ["FR", "DE", "IT", "BE", "NL", "LU"].map((code) => ({
        code,
      })),
      points: [{ lat: 50.85, lon: 4.35, label: "Brussels" }],
      ...over,
    }
    return l
  }

  it("accepts countries and points on the region, and a world map by default", () => {
    expect(validateLesson(withMap()).ok).toBe(true)
    expect(
      validateLesson(
        withMap({
          region: undefined,
          countries: [{ code: "JP", label: "Japan" }],
          points: [{ lat: -33.87, lon: 151.21 }],
        })
      ).ok
    ).toBe(true)
  })

  it("wants alt text, and something on the map", () => {
    const l = withMap()
    delete l.bricks[0].visual.alt
    expectIssue(l, {
      path: "bricks[0].visual",
      message: /This map has no "alt"/,
    })
    expectIssue(withMap({ countries: undefined, points: undefined }), {
      path: "bricks[0].visual",
      message: /shade "countries", mark "points"/,
    })
  })

  it("names the code to use for one the map doesn't know", () => {
    const code = (c: string) => withMap({ countries: [{ code: c }] })
    const at = { path: "bricks[0].visual.countries[0]" }
    expectIssue(code("UK"), { ...at, message: /United Kingdom is "GB"/ })
    expectIssue(code("FRA"), { ...at, message: /"FR" for France/ })
    expectIssue(code("fr"), { ...at, message: /capital letters: "FR"/ })
    expectIssue(code("GF"), {
      ...at,
      message: /French Guiana \("GF"\) is drawn as part of France/,
    })
    expectIssue(code("GI"), { ...at, message: /Gibraltar .* too small/ })
    expectIssue(code("ZZ"), { ...at, message: /isn't a country code/ })
  })

  it("keeps countries on the region and lists each once", () => {
    expectIssue(withMap({ countries: [{ code: "JP" }] }), {
      path: "bricks[0].visual.countries[0]",
      message:
        /Japan \("JP"\) isn't on the "europe" map\. .*"asia", "east-asia"/,
    })
    // Russia reaches into Europe, and Fiji sits across the 180th meridian in Oceania.
    expect(validateLesson(withMap({ countries: [{ code: "RU" }] })).ok).toBe(
      true
    )
    expect(
      validateLesson(
        withMap({
          region: "oceania",
          countries: [{ code: "FJ" }],
          points: undefined,
        })
      ).ok
    ).toBe(true)
    expectIssue(withMap({ countries: [{ code: "FR" }, { code: "FR" }] }), {
      path: "bricks[0].visual.countries",
      message: /"FR" is listed twice/,
    })
  })

  it("rejects a point outside the region, and says the signs are the usual slip", () => {
    // New York with its longitude's sign dropped lands in Kazakhstan.
    expectIssue(
      withMap({ points: [{ lat: 40.71, lon: 74.01, label: "NYC" }] }),
      {
        path: "bricks[0].visual.points[0]",
        message:
          /"NYC" \(lat 40\.71, lon 74\.01\) is outside the "europe" map \(34°N to 71°N, 25°W to 45°E\)\. Check its signs/,
      }
    )
    expect(
      validateLesson(
        withMap({
          region: "oceania",
          countries: undefined,
          points: [{ lat: -13.83, lon: -171.76 }],
        })
      ).ok
    ).toBe(true)
  })

  it("wants a group on every country or none, and at most 3", () => {
    expectIssue(
      withMap({ countries: [{ code: "FR", group: "Allies" }, { code: "DE" }] }),
      { path: "bricks[0].visual.countries[1]", message: /"DE" has none/ }
    )
    expectIssue(
      withMap({
        countries: ["FR", "DE", "IT", "ES"].map((code) => ({
          code,
          group: code,
        })),
      }),
      { path: "bricks[0].visual.countries", message: /at most 3 groups/ }
    )
  })
  describe("as a hotspot", () => {
    // Where did the Hittites live? Five countries of the eastern Mediterranean shaded, none named.
    function mapHotspot(over: Record<string, unknown> = {}) {
      const l = buttons()
      l.bricks[2].visual = {
        kind: "map",
        region: "eastern-mediterranean",
        alt: "The eastern Mediterranean, with Greece, Turkey, Cyprus, Syria, and Egypt shaded.",
        countries: ["GR", "TR", "CY", "SY", "EG"].map((code) => ({ code })),
      }
      l.bricks[2].correct = ["TR"]
      Object.assign(l.bricks[2], over)
      return l
    }

    it("takes countries on the region as answers", () => {
      expect(validateLesson(mapHotspot()).ok).toBe(true)
      expect(
        validateLesson(mapHotspot({ correct: ["TR", "SY"], multiple: true })).ok
      ).toBe(true)
      // Any country the region draws can be tapped, shaded or not.
      expect(validateLesson(mapHotspot({ correct: ["IQ"] })).ok).toBe(true)
    })

    it("rejects an answer that isn't a two-letter code, with the format", () => {
      expectIssue(mapHotspot({ correct: ["Turkey"] }), {
        path: "bricks[2].correct",
        message:
          /"Turkey" isn't a country code\. .*two capital letters, like "FR"/,
      })
      expectIssue(mapHotspot({ correct: ["TUR"] }), {
        path: "bricks[2].correct",
        message: /"TR" for Türkiye/,
      })
      expectIssue(mapHotspot({ correct: ["tr"] }), {
        path: "bricks[2].correct",
        message: /capital letters: "TR"/,
      })
    })

    it("rejects an answer off the region, naming one that shows it", () => {
      expectIssue(mapHotspot({ correct: ["FR"] }), {
        path: "bricks[2].correct",
        message:
          /France \("FR"\) isn't on the "eastern-mediterranean" map, so it can't be tapped\. Pick a region that shows it: .*"europe"/,
      })
    })

    it("wants alt text, since the countries are only names", () => {
      const l = mapHotspot()
      delete l.bricks[2].visual.alt
      expectIssue(l, {
        path: "bricks[2].visual",
        message: /This map has no "alt"/,
      })
    })

    it("doesn't let a label or a lone shading give the answer away", () => {
      const labeled = mapHotspot()
      labeled.bricks[2].visual.countries[1].label = "Anatolia"
      expectIssue(labeled, {
        path: "bricks[2].visual.countries[1].label",
        message: /Türkiye \("TR"\) is an answer and it's labeled/,
      })
      expectIssue(
        mapHotspot({
          visual: {
            kind: "map",
            region: "eastern-mediterranean",
            alt: "The eastern Mediterranean, with Turkey shaded.",
            countries: [{ code: "TR" }],
          },
        }),
        {
          path: "bricks[2].visual.countries[0]",
          message: /the only country shaded, which gives it away/,
        }
      )
      // A label on another country is fine: it names a landmark, not the answer.
      const other = mapHotspot()
      other.bricks[2].visual.countries[4].label = "Egypt"
      expect(validateLesson(other).ok).toBe(true)
    })

    it("rejects an answer too small to tap, suggesting a tighter region", () => {
      expectIssue(
        mapHotspot({
          visual: {
            kind: "map",
            region: "world",
            alt: "A map of the world.",
            points: [{ lat: 37, lon: 35 }],
          },
          correct: ["CY"],
        }),
        {
          path: "bricks[2].visual.region",
          message:
            /Cyprus \("CY"\) is too small to find and tap on the "world" map\. Pick a tighter region: .*"eastern-mediterranean"/,
        }
      )
      // Lebanon is small but fine on the eastern Mediterranean, the region drawn closest.
      expect(validateLesson(mapHotspot({ correct: ["LB"] })).ok).toBe(true)
    })
  })
})

describe("molecule visuals", () => {
  function withMolecule(over: Record<string, unknown> = {}) {
    const l = buttons()
    l.bricks[0].visual = {
      kind: "molecule",
      smiles: "CC(=O)O",
      alt: "Acetic acid, with its carboxyl group marked.",
      highlight: ["C(=O)[OH]"],
      ...over,
    }
    return l
  }

  it("accepts a molecule, skeletal or full", () => {
    expect(validateLesson(withMolecule()).ok).toBe(true)
    expect(validateLesson(withMolecule({ style: "full" })).ok).toBe(true)
  })

  it("wants alt text", () => {
    const l = withMolecule()
    delete l.bricks[0].visual.alt
    expectIssue(l, {
      path: "bricks[0].visual",
      message: /molecule has no "alt"/,
    })
  })

  it("rejects a SMILES with spaces, pointing to the dot", () => {
    expectIssue(withMolecule({ smiles: "[Na+] [Cl-]" }), {
      path: "bricks[0].visual.smiles",
      message: /separate them with "\."/,
    })
  })

  it("wants each highlight once", () => {
    expectIssue(withMolecule({ highlight: ["C=O", "C=O"] }), {
      path: "bricks[0].visual.highlight",
      message: /"C=O" is listed twice/,
    })
  })

  it("doesn't read a SMILES as a formula", () => {
    expect(validateLesson(withMolecule({ smiles: "F/C=C\\(F)" })).ok).toBe(true)
  })
})

describe("structure rules", () => {
  it("starts the bricks with a concept brick", () => {
    const l = buttons()
    l.bricks = [l.bricks[1], l.bricks[0], ...l.bricks.slice(2)]
    expectIssue(l, { path: "bricks[0]", message: /must be a concept brick/ })
  })

  it("requires at least 2 question bricks after each concept brick", () => {
    const l = buttons()
    l.bricks.splice(2, 1)
    expectIssue(l, {
      path: "bricks[0]",
      message: /"c1" is followed by 1 question bricks; it needs 2–4/,
    })
  })

  it("allows at most 4 question bricks after a concept brick", () => {
    const l = buttons()
    const extra = [0, 1, 2].map((n) => ({ ...l.bricks[1], id: `x${n}` }))
    l.bricks = [l.bricks[0], ...extra, ...l.bricks.slice(1, 3)]
    expectIssue(l, {
      path: "bricks[0]",
      message: /"c1" is followed by 5 question bricks; it needs 2–4/,
    })
  })

  it("allows at most 4 concept bricks", () => {
    const l = buttons()
    const loop = l.bricks.slice(0, 2)
    l.bricks = [0, 1, 2, 3, 4].flatMap((n) =>
      loop.map((b: { id: string }) => ({ ...b, id: `${b.id}-${n}` }))
    )
    expectIssue(l, {
      path: "bricks",
      message: /5 concept bricks; it needs 1–4/,
    })
  })

  it("requires 3–12 practice bricks in total", () => {
    const l = buttons()
    l.bricks = l.bricks.slice(0, 3)
    expectIssue(l, {
      path: "bricks",
      message: /2 practice bricks in total; it needs 3–12/,
    })
  })

  it("rejects duplicate brick ids", () => {
    const l = buttons()
    l.bricks[2].id = "p1"
    expectIssue(l, { message: /"p1" is used more than once/ })
  })

  it("checks that correct answers point to real options", () => {
    const l = buttons()
    l.bricks[1].correct = ["z"]
    expectIssue(l, {
      path: "bricks[1].correct",
      message: /"z" isn't one of this brick's option ids/,
    })
  })

  it("checks that sort items point to real groups", () => {
    const l = buttons()
    l.bricks[4].items[0].group = "nope"
    expectIssue(l, {
      path: "bricks[4].items[0].group",
      message: /"nope" isn't one of this brick's group ids/,
    })
  })

  it("checks that template gaps and blanks match", () => {
    const l = compound()
    l.bricks[2].template = "$1,000 × [[x]] = $1,050"
    expectIssue(l, { message: /\[\[x\]\] has no matching entry/ })
    expectIssue(l, { message: /Blank "g" doesn't appear in the template/ })
  })

  it("requires a blank's accepted answer to be among its chips", () => {
    const l = compound()
    l.bricks[2].blanks[0].choices = ["0.05", "1.5"]
    expectIssue(l, {
      path: "bricks[2].blanks[0].choices",
      message: /can't be answered/,
    })
  })

  it("checks that hotspot answers exist in the visual", () => {
    const l = buttons()
    l.bricks[2].correct = ["missing"]
    expectIssue(l, {
      path: "bricks[2].correct",
      message: /isn't one of this visual's hotspot ids \(create, learn\)/,
    })
  })

  it("checks that code hotspots point to real lines", () => {
    const l = loadExample("map-vs-foreach.json")
    l.bricks[5].visual.hotspots[2].line = 9
    expectIssue(l, { message: /Line 9 doesn't exist; the code has 3 lines/ })
  })

  it("checks alternative orders list every item once", () => {
    const l = buttons()
    l.bricks[5].alsoAccept = [["a", "b"]]
    expectIssue(l, {
      path: "bricks[5].alsoAccept[0]",
      message: /every item id exactly once/,
    })
  })

  it("rejects invalid language codes", () => {
    const l = loadExample("spanish-greetings.json")
    l.hook.options[0].lang = "not a language"
    expectIssue(l, {
      path: "hook.options[0].lang",
      message: /isn't a valid BCP 47 language code/,
    })
  })

  it("rejects unbalanced inline formulas", () => {
    const l = compound()
    l.challenge.explanation = "\\( 5000 \\times 1.08^3 is about 6298.56."
    expectIssue(l, {
      path: "challenge.explanation",
      message: /Unbalanced inline formula/,
    })
  })

  it("rejects formulas KaTeX can't render", () => {
    const l = compound()
    l.bricks[0].visual.tex = "\\frac{1}{"
    expectIssue(l, {
      path: "bricks[0].visual.tex",
      message: /doesn't render/,
    })
  })

  it("treats a dollar sign as plain text", () => {
    const l = compound()
    l.hook.prompt = "Is $5 or $10 more?"
    expect(validateLesson(l).ok).toBe(true)
  })
})

describe("v1 rules", () => {
  it("rejects number bricks", () => {
    const l = compound()
    l.challenge = {
      id: "ch",
      type: "number",
      prompt: "How much?",
      answer: 6298.56,
      explanation: "Compound it.",
    }
    expectIssue(l, {
      path: "challenge",
      kind: "v1",
      message: /Number bricks aren't supported in v1/,
    })
  })

  it("rejects blanks without word chips", () => {
    const l = compound()
    delete l.bricks[2].blanks[0].choices
    expectIssue(l, {
      path: "bricks[2].blanks[0]",
      kind: "v1",
      message: /add a "choices" word bank/,
    })
  })
})

describe("teaching rules", () => {
  it("requires feedback on every wrong option", () => {
    const l = buttons()
    delete l.bricks[1].options[1].feedback
    expectIssue(l, {
      path: "bricks[1].options[1]",
      message: /Wrong option "b" has no feedback/,
    })
  })

  it("lets a lesson repeat one brick type when that's what fits", () => {
    const l = compound()
    l.bricks[2] = { ...l.bricks[1], id: "p2" }
    expect(validateLesson(l).ok).toBe(true)
  })

  it("keeps prompts to 40 words", () => {
    const l = buttons()
    l.bricks[1].prompt = Array(45).fill("word").join(" ")
    expectIssue(l, { path: "bricks[1].prompt", message: /45 words/ })
  })

  it("requires at least one wrong option", () => {
    const l = buttons()
    l.bricks[1].correct = ["a", "b", "c"]
    l.bricks[1].multiple = true
    expectIssue(l, { message: /At least one option must be wrong/ })
  })

  it("requires a best option in a scenario", () => {
    const l = buttons()
    l.challenge.options[0].quality = "okay"
    expectIssue(l, { path: "challenge.options", message: /"quality": "best"/ })
  })
})

describe("safety rules", () => {
  it.each([
    ["<script>alert(1)</script>", /can't contain <script>/],
    ["<button onclick='x()'>Go</button>", /event handlers/],
    ["<iframe></iframe>", /iframes/],
    ["<img src='https://evil.example/x.png'>", /external URLs/],
    ["<a href='javascript:alert(1)'>x</a>", /javascript: URLs/],
  ])("rejects %s in a visual", (html, message) => {
    const l = buttons()
    l.bricks[0].visual.html = html
    expectIssue(l, { kind: "safety", message })
  })

  it("limits each HTML visual to 20 KB", () => {
    const l = buttons()
    l.bricks[0].visual.html = `<div>${"x".repeat(21 * 1024)}</div>`
    expectIssue(l, {
      kind: "safety",
      message: /keep each HTML visual under 20 KB/,
    })
  })
})

describe("answers named by their place", () => {
  it("rejects an explanation that points at a shuffled option by position", () => {
    const lesson = loadExample("writing-a-prd.json") as {
      bricks: { type: string; explanation: string }[]
    }
    const compare = lesson.bricks.find((b) => b.type === "compare")!
    compare.explanation = "The second statement names who is hurting."
    const issues = issuesFor(lesson)
    expect(issues.map((i) => i.message).join(" ")).toContain(
      '"The second statement" points at an option by its place'
    )
  })

  it("only flags positions, not ordinary ordinals", () => {
    expect(positionalReference("Pick option B next time.")).toBe("option B")
    expect(positionalReference("That's the right answer.")).toBeNull()
    expect(positionalReference("A third one pushes both.")).toBeNull()
    expect(positionalReference("It comes in the third step.")).toBeNull()
    expect(positionalReference("Plot B measures it first.")).toBe("Plot B")
    expect(positionalReference("Answer a question with a question.")).toBeNull()
  })
})

describe("code outside backticks", () => {
  it("rejects a match pair that writes a command as plain text", () => {
    const lesson = loadExample("spanish-greetings.json") as {
      bricks: { type: string; pairs: { left: string; right: string }[] }[]
    }
    const match = lesson.bricks.find((b) => b.type === "match")!
    match.pairs[0]!.left = "git push"
    expectIssue(lesson, {
      path: "bricks[1].pairs[0].left",
      message: /"git push" looks like code, but it isn't in backticks/,
      kind: "teaching",
    })
  })

  it("accepts the same command in backticks", () => {
    const lesson = loadExample("spanish-greetings.json") as {
      bricks: { type: string; pairs: { left: string; right: string }[] }[]
    }
    const match = lesson.bricks.find((b) => b.type === "match")!
    match.pairs[0]!.left = "`git push`"
    expect(validateLesson(lesson).ok).toBe(true)
  })

  it("spots commands, flags, calls, files, paths, and tags, but not prose", () => {
    expect(bareCode("Send your commits up with git push")).toBe("git push")
    expect(bareCode("Run `git push` now")).toBeNull()
    expect(bareCode("the git history of a repo")).toBeNull()
    expect(bareCode("npm install it first")).toBe("npm install")
    expect(bareCode("add the --force flag")).toBe("--force")
    expect(bareCode("arr.map() returns a new array")).toBe("arr.map()")
    expect(bareCode("open package.json")).toBe("package.json")
    expect(bareCode("Node.js is a runtime")).toBeNull()
    expect(bareCode("the .env file")).toBe(".env")
    expect(bareCode("edit ~/.zshrc")).toBe("~/.zshrc")
    expect(bareCode("look in src/app/page.tsx")).toBe("src/app/page.tsx")
    expect(bareCode("a <div> element")).toBe("<div>")
    expect(bareCode("cd ../app")).toBe("cd ../app")
    expect(bareCode("cd into the folder")).toBeNull()
    expect(bareCode("and/or, 3/4 cup, 24/7")).toBeNull()
    expect(bareCode("see https://learn.ninja/docs")).toBeNull()
    expect(bareCode("In \\( x^2 \\) terms, e.g. U.S. history")).toBeNull()
    expect(bareCode("python code costs 2.50 in v1.2.3")).toBeNull()
  })
})

describe("markdown in lesson text", () => {
  const withBody = (body: string) => {
    const lesson = buttons()
    lesson.bricks[0].body = body
    return lesson
  }

  it("accepts paragraphs and lists in a concept body", () => {
    const body =
      "Famous openings:\n- **Italian Game**: e4 e5, Nf3 Nc6, Bc4\n- **Sicilian Defense**: e4 c5\n\nThen:\n1. Develop\n2. Castle"
    expect(validateLesson(withBody(body)).issues).toEqual([])
  })

  it("keeps a lone numbered line as text", () => {
    expect(validateLesson(withBody("1. e4 e5 2. Nf3 Nc6")).issues).toEqual([])
  })

  it("rejects a list with one item", () => {
    expectIssue(withBody("Openings:\n- Italian Game"), {
      path: "bricks[0].body",
      message: /two or more items/,
    })
  })

  it("rejects a list outside a concept body", () => {
    const lesson = buttons()
    lesson.hook.explanation = "Two reasons:\n- One stands out\n- It reads fast"
    expectIssue(lesson, {
      path: "hook.explanation",
      message: /on its own line, without a marker/,
    })
  })

  it("rejects headings, links, tables, and code blocks", () => {
    expectIssue(withBody("## Openings\nPush a centre pawn."), {
      message: /Headings don't show/,
    })
    expectIssue(withBody("See [the rules](https://fide.com)."), {
      message: /Links and images/,
    })
    expectIssue(
      withBody("| Opening | Moves |\n| --- | --- |\n| Italian | e4 |"),
      {
        message: /Tables don't show/,
      }
    )
    expectIssue(withBody("Run this:\n```\ngit push\n```"), {
      message: /Code blocks/,
    })
  })

  it("leaves # and | inside code and formulas alone", () => {
    expect(
      validateLesson(withBody("Write `# done` and \\( |x| \\) here.")).issues
    ).toEqual([])
  })
})

describe("explanation length", () => {
  it("rejects an explanation over the word limit", () => {
    const lesson = loadExample("writing-a-prd.json") as {
      hook: { explanation: string }
    }
    lesson.hook.explanation = Array(31).fill("word").join(" ")
    expect(
      issuesFor(lesson)
        .map((i) => i.message)
        .join(" ")
    ).toContain("The explanation has 31 words")
  })
})
