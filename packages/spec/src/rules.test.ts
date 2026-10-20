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
    expectIssue(l, { path: "spec", message: /0\.6/ })
  })

  it("requires a subject from the list, and names all 16 when it's wrong or missing", () => {
    const l = buttons()
    l.subject = "coding"
    const sixteen = new RegExp(SUBJECTS.join(", "))
    expectIssue(l, { path: "subject", message: sixteen })
    delete l.subject
    expectIssue(l, { path: "subject", message: sixteen })
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
    // Normalization folds symbols to hyphens first, so "c++" arrives as "c".
    l.tags = ["c++"]
    expectIssue(l, { path: "tags[0]", message: />=2/ })
    l.tags = ["buttons", "call-to-action", "user-interface", "forms", "ui-kit"]
    expect(validateLesson(l).ok).toBe(true)
    delete l.tags
    expect(validateLesson(l).ok).toBe(true)
  })

  it("normalizes spelling and synonyms, keeps the result, and says so in a note", () => {
    const l = buttons()
    l.tags = ["Buttons", "UX", "forms"]
    const result = validateLesson(l)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.lesson.tags).toEqual(["buttons", "user-experience", "forms"])
    expect(result.notes).toEqual([
      { path: "tags[0]", message: 'Kept the tag "Buttons" as "buttons".' },
      { path: "tags[1]", message: 'Kept the tag "UX" as "user-experience".' },
    ])
    expect(validateLesson(buttons()).notes).toEqual([])
  })

  it("rejects a tag that repeats the subject, a level, or a language", () => {
    const l = buttons()
    l.tags = ["design"]
    expectIssue(l, { path: "tags[0]", message: /repeats the subject/ })
    l.tags = ["beginner"]
    expectIssue(l, { path: "tags[0]", message: /is a level/ })
    l.tags = ["english"]
    expectIssue(l, { path: "tags[0]", message: /names a language.*"language"/ })
    l.tags = ["en"]
    expectIssue(l, { path: "tags[0]", message: /language code/ })
    const greetings = loadExample("spanish-greetings.json")
    greetings.tags = ["spanish"]
    expectIssue(greetings, { path: "tags[0]", message: /"targetLanguage"/ })
    // Another subject's slug is fine: that's where a lesson's second subject goes.
    l.tags = ["marketing"]
    expect(validateLesson(l).ok).toBe(true)
  })

  it("rejects duplicates, including ones the synonym table folds together", () => {
    const l = buttons()
    l.tags = ["javascript", "js"]
    expectIssue(l, {
      path: "tags",
      message: /"javascript" appears more than once/,
    })
    l.tags = ["forms", "forms"]
    expectIssue(l, { path: "tags", message: /"forms" appears more than once/ })
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
