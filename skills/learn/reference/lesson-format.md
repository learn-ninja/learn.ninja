# Lesson format (spec 0.6)

A lesson is one JSON file with four slots: `hook`, `bricks`, `challenge`, `wrapup`. A brick is one screen: either a `concept` brick (theory) or a question brick (`choice`, `compare`, `hotspot`, `sort`, `order`, `match`, `blank`, `scenario`). `schema/lesson.schema.json` is the formal definition; the checker (`scripts/learn.mjs validate`) also enforces the cross-field rules listed at the end.

## Lesson

| Field              | Required | Description                                                                                                                                                         |
| ------------------ | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `spec`             | yes      | Always `"0.6"`                                                                                                                                                      |
| `title`            | yes      | Up to 60 characters; also used in the link                                                                                                                          |
| `summary`          | yes      | One sentence shown before starting, up to 160 characters                                                                                                            |
| `objective`        | yes      | What the learner can do afterwards                                                                                                                                  |
| `language`         | yes      | Language of all learner-facing text (BCP 47: `en`, `es`, `ar`, `pt-BR`…)                                                                                            |
| `targetLanguage`   | no       | The language being taught, for language lessons                                                                                                                     |
| `level`            | yes      | Who it's for: `beginner`, `intermediate`, or `advanced` (`levels/index.md` says how to choose)                                                                      |
| `estimatedMinutes` | yes      | 3–15, by size: short 3–5, standard 5–10, long 10–15 (`reference/planning.md`)                                                                                       |
| `subject`          | yes      | One of the 16 subjects below, by what the learner will do afterwards. The checker refuses anything else                                                           |
| `tags`             | no       | Up to 5 specifics: lowercase words joined by single hyphens (`compound-interest`), 2–30 characters each; see Subjects and tags below                                |
| `source`           | no       | `{ "title": "…", "url": "https://…" }` credit for the material                                                                                                      |
| `hook`             | yes      | One `choice` or `compare` brick; not scored                                                                                                                         |
| `bricks`           | yes      | The lesson in play order: 1–4 `concept` bricks, each followed by 2–4 question bricks that practise it; 3–12 question bricks in total, at most 20 bricks. The first brick is a `concept` |
| `challenge`        | yes      | One question brick of any type except `number`                                                                                                                      |
| `wrapup`           | yes      | `{ "takeaways": [2–4 strings], "next": "suggested next lesson" }` (`next` is optional)                                                                              |

```json
"bricks": [
  { "id": "c1", "type": "concept", … },
  { "id": "p1", "type": "choice", … },
  { "id": "p2", "type": "sort", … },
  { "id": "c2", "type": "concept", … },
  { "id": "p3", "type": "hotspot", … },
  { "id": "p4", "type": "order", … }
]
```

Brick ids are unique across the whole lesson, including the hook and the challenge.

## Subjects and tags

`subject` is the lesson's category: where it sits in Explore, its label on the title screen (translated to the reader's language), and the colour of its light. Pick one from this table by what the learner will **do afterwards**, not by the nouns in the title: a Git lesson for people who will type Git commands is `tools`; a lesson on how Git stores objects is `programming`. The "Not this" column settles the ties. There is no "other": `life` and `society` are wide on purpose.

| Slug | Name | Covers | Not this (goes to) |
|---|---|---|---|
| `programming` | Programming | Languages, frameworks, algorithms, software design, databases, testing, version control | Using a developer tool as a user without code (→ `tools`); AI as a subject (→ `ai`) |
| `ai` | AI | How models work, prompting, agents, machine learning concepts, working with AI tools | Writing code that calls an API, where the lesson is about the code (→ `programming`) |
| `tools` | Tools & productivity | How to use a specific app, product, or workflow: Git as a tool, spreadsheets, note apps, keyboard habits, personal productivity systems | Programming in that tool's language (→ `programming`); a tool used for design (→ `design`) |
| `design` | Design | UI, UX, visual and graphic design, typography, product design, design systems | Art appreciation and art history (→ `arts`) |
| `business` | Business & startups | Strategy, startups, management, operations, entrepreneurship, product management, economics as it applies to firms | Personal money (→ `money`); the macroeconomics of nations (→ `society`) |
| `marketing` | Marketing & writing | Marketing, sales, copywriting, content, social media, public speaking, professional writing | Creative writing (→ `arts`); grammar of a language being learned (→ `languages`) |
| `money` | Money & finance | Personal finance, investing, accounting, economics for individuals | Running a company's finances (→ `business`) |
| `science` | Science | Physics, chemistry, biology, earth and space science, scientific method | Human health (→ `health`); maths on its own (→ `math`) |
| `math` | Math & data | Arithmetic through calculus, statistics, probability, data literacy, data analysis | Programming a data pipeline (→ `programming`); machine learning (→ `ai`) |
| `health` | Health & fitness | Medicine for lay readers, nutrition, exercise, sleep, mental health, first aid | Biology for its own sake (→ `science`) |
| `history` | History | Any period, place, or theme in history; archaeology | Current politics and institutions (→ `society`) |
| `society` | Society & ideas | Politics, law, philosophy, religion, psychology, sociology, geography, current affairs, civics | Historical events (→ `history`); personal habits (→ `life`) |
| `languages` | Languages | Learning a language: vocabulary, grammar, phrases, pronunciation. Set `targetLanguage` | Writing well in your own language (→ `marketing`) |
| `arts` | Arts & culture | Music, film, literature, visual art, creative writing, photography, games as culture, pop culture | Making a UI (→ `design`); the history of an art movement when the lesson is history first (→ `history`) |
| `life` | Everyday life | Cooking, gardening, home, parenting, travel, pets, hobbies, crafts, DIY, relationships, study skills | Health and fitness (→ `health`); personal finance (→ `money`) |
| `careers` | Careers & learning | Job search, interviews, workplace skills, leadership as a skill, teaching, how to learn, exam prep | Running a business (→ `business`); a specific tool (→ `tools`) |

`tags` say what the lesson is specifically about, for people browsing within a subject later (they're stored, not shown yet). Write 2–5, in this order: the specific thing taught (`git`, `compound-interest`), then the product or field if there is one (`claude-code`, `javascript`), then at most one angle (`beginners`, `history-of`). Nouns, singular, in the lesson's language or English.

- Lowercase letters (any script), digits, and single hyphens between words: `claude-code`, not `Claude Code` or `claude_code`. The checker fixes spelling like that itself and tells you in a note; it also folds known variants (`js` → `javascript`, `ux` → `user-experience`) to one tag.
- Don't repeat what the fields say: no tag equal to the subject (`programming` on a `programming` lesson), a level (`beginner`), or a language the lesson sets (`spanish` when `targetLanguage` is `es`). A second subject's slug is fine as a tag: that's where a lesson that straddles two goes.
- No duplicates, including ones that fold to the same tag.

## Concept bricks

`{ "id", "type": "concept", "title" (≤60 chars), "body" (rich text, ≤80 words), "visual"? }`

```json
{
  "id": "c1",
  "type": "concept",
  "title": "Buttons do, links go",
  "body": "Ask whether the action **does** something or **goes** somewhere."
}
```

## Every question brick

`{ "id", "type", "prompt" (rich text, ≤40 words), "visual"?, "hint"?, "explanation" }` plus the fields for its type.

## Visuals

```json
{ "kind": "html", "html": "<div class='flex gap-2'><button class='btn'>Save</button></div>", "alt": "A single filled Save button.", "css": "optional extra CSS", "height": 200 }
{ "kind": "code", "language": "javascript", "code": "const x = 1;\nconsole.log(x);", "highlight": [2], "hotspots": [{ "id": "l2", "line": 2 }] }
{ "kind": "math", "tex": "A = P(1 + r)^n" }
{ "kind": "chart", "type": "scatter", "alt": "Drownings rise with ice cream sales.", "x": { "label": "Ice cream sales (thousands)" }, "y": { "label": "Drownings" }, "data": [{ "x": 15, "y": 4, "label": "Jan" }, { "x": 22, "y": 6, "label": "Feb" }], "trend": true }
{ "kind": "chart", "type": "line", "alt": "Sales peak in July.", "y": { "label": "Sales" }, "data": [{ "x": "Jan", "y": 10, "series": "2024" }, { "x": "Feb", "y": 12, "series": "2024" }, { "x": "Jan", "y": 14, "series": "2025" }, { "x": "Feb", "y": 18, "series": "2025" }] }
{ "kind": "diagram", "alt": "The browser asks the server, which reads the database and answers.", "d2": "browser: Browser\nserver: Server\ndb: Database {shape: cylinder}\nbrowser -> server: request\nserver -> db: query\nserver -> browser: page" }
```

`alt` is one sentence saying what the visual shows, for screen readers, at most 200 characters; it's required on a concept's or question's HTML, chart, or diagram visual, and on an option's HTML, chart, or diagram visual that has no caption (hotspot visuals are read through their regions, item visuals through their captions). `height` is optional (the player sizes HTML visuals to their content). `hotspots` on code are only for `hotspot` bricks.

A chart is drawn by the player from its `data` (2 to 60 points, in the order given): `type` is `scatter` (numbers on both axes; `label` names a point, `trend: true` fits a line), `bar`, or `line` (`x` is a category name or a number, one point per `x`). Axis labels are optional (`x.label`, `y.label`, at most 60 characters). `series` on a point groups points into up to 3 lines or colors, named in the chart; bars have no series. Colors, sizes, and fonts are the player's.

A diagram is laid out and drawn from its `d2` source, in [D2](https://d2lang.com) (at most 4,000 characters; in JSON, each line break is `\n`). The parts you need:

```text
direction: right                      # down (the default), right, left, or up
api: API server                       # a box: id, then its label
db: Users {shape: cylinder}           # also: oval, circle, diamond, hexagon, queue, page, person, text
api -> db: reads                      # an arrow with a label; also <-, <->, and -- (a plain line)
cloud: Cloud {                        # a container: the boxes inside it belong together
  web: Web
  worker: Worker
}
cloud.web -> api                      # reach inside a container with a dot
api.style.bold: true                  # emphasis: style.bold, style.stroke-width, style.stroke-dash, style.multiple
```

Colors and fonts are the player's: don't set `style.fill`, `style.stroke`, or `style.font-color`. Icons, images, links, and tooltips aren't allowed, and Markdown labels (`|md ... |`) can't contain HTML or images. Publishing compiles the D2 and reports the line of any error.

## Options

Used by `choice` and `compare`: `{ "id", "text"? (rich text), "visual"?, "feedback"? (required on wrong options), "lang"? }`. Give each option text or a visual. Options with visuals show as cards in two columns; in a `choice`, give either every option a visual or none. Give each option visual an `alt` (screen readers announce it). `text` under a visual is a caption: add one only for what the visual can't show, like a name to refer to it by, never text the visual already shows.

## The question bricks

```json
{ "id": "p1", "type": "choice", "prompt": "…", "options": [ … 2–5 … ], "correct": ["a"], "multiple": false, "explanation": "…" }

{ "id": "p2", "type": "compare", "prompt": "Which … is clearer?", "options": [ … exactly 2 … ], "correct": "b", "explanation": "…" }

{ "id": "p3", "type": "hotspot", "prompt": "Tap the …",
  "visual": { "kind": "html", "html": "<button data-hotspot='save' class='btn'>Save</button><button data-hotspot='more' class='btn'>More</button>" },
  "correct": ["more"], "multiple": false, "explanation": "…" }

{ "id": "p4", "type": "sort", "prompt": "Sort each …",
  "groups": [ { "id": "g1", "label": "Buenos días", "lang": "es" }, { "id": "g2", "label": "Buenas noches", "lang": "es" } ],
  "items": [ { "id": "a", "text": "…", "group": "g1" }, … 4–8 … ], "explanation": "…" }

{ "id": "p5", "type": "order", "prompt": "Put … in order.",
  "items": [ { "id": "a", "text": "First" }, { "id": "b", "text": "Second" }, { "id": "c", "text": "Third" } ],
  "alsoAccept": [ ["b", "a", "c"] ], "explanation": "…" }

{ "id": "p6", "type": "match", "prompt": "Match each …", "leftLang": "es",
  "pairs": [ { "left": "Hola", "right": "Hello" }, … 3–5 … ], "explanation": "…" }

{ "id": "p7", "type": "blank", "prompt": "Complete the sentence.", "format": "text", "lang": "es",
  "template": "—Bien, [[g]]. ¿Y tú?",
  "blanks": [ { "id": "g", "accept": ["gracias"], "choices": ["gracias", "adiós", "hola"],
                "mistakes": [ { "answer": "adiós", "feedback": "Adiós means goodbye." } ] } ],
  "explanation": "…" }

{ "id": "ch", "type": "scenario", "prompt": "What do you do?", "situation": "…",
  "options": [ { "id": "a", "text": "…", "quality": "best", "outcome": "…" },
               { "id": "b", "text": "…", "quality": "okay", "outcome": "…" },
               { "id": "c", "text": "…", "quality": "poor", "outcome": "…" } ],
  "explanation": "…" }
```

- `blank` with `"format": "code"` takes a `language` and is usually `"caseSensitive": true`.
- `blank` options: `numeric` and `tolerance` (for numbers in gaps), `strictAccents` (when accents change meaning, like _si_ and _sí_).
- `number` bricks exist in the spec but aren't allowed in v1.

## Rules the checker enforces

- Hook is `choice` or `compare`; the first brick is a `concept`; 1–4 concept bricks; 2–4 question bricks after each concept brick; 3–12 question bricks in `bricks` in total; at most 20 bricks; the challenge is a question brick.
- Unique ids; every reference points to something real (`correct`, `group`, `alsoAccept`, `[[gap]]` ids, hotspot ids, code hotspot lines).
- Every `choice` has `multiple`, even when it's `false`; every wrong `choice`/`compare` option has `feedback`; every question brick has an `explanation`; a `choice` has at least one wrong option; a `scenario` has a `best` option.
- Prompts ≤40 words; concept bodies ≤80 words.
- No `number` bricks; every `blank` has `choices` that include an accepted answer.
- Formulas in `\( … \)` are balanced and render; language codes are valid BCP 47.
- `subject` is one of the 16 slugs above; at most 5 `tags`, each 2–30 characters of lowercase words and single hyphens, none repeating the subject, a level, or a language the lesson sets, none twice.
- HTML visuals: no scripts, event handlers, iframes, forms, objects, embeds, `javascript:` links, or external URLs; each under 20 KB; the whole file under 500 KB. A concept's or question's HTML visual has `alt`.
- Diagram visuals: the D2 compiles, with no colors, icons, images, links, tooltips, or HTML of its own; a concept's or question's diagram has `alt`.
