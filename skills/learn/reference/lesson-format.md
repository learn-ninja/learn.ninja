# Lesson format (spec 0.3)

A lesson is one JSON file with four slots: `hook`, `bricks`, `challenge`, `wrapup`. A brick is one screen: either a `concept` brick (theory) or a question brick (`choice`, `compare`, `hotspot`, `sort`, `order`, `match`, `blank`, `scenario`). `schema/lesson.schema.json` is the formal definition; the checker (`scripts/learn.mjs validate`) also enforces the cross-field rules listed at the end.

## Lesson

| Field              | Required | Description                                                                                                                                                         |
| ------------------ | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `spec`             | yes      | Always `"0.3"`                                                                                                                                                      |
| `title`            | yes      | Up to 60 characters; also used in the link                                                                                                                          |
| `summary`          | yes      | One sentence shown before starting, up to 160 characters                                                                                                            |
| `objective`        | yes      | What the learner can do afterwards                                                                                                                                  |
| `language`         | yes      | Language of all learner-facing text (BCP 47: `en`, `es`, `ar`, `pt-BR`…)                                                                                            |
| `targetLanguage`   | no       | The language being taught, for language lessons                                                                                                                     |
| `level`            | yes      | `beginner`, `intermediate`, or `advanced`                                                                                                                           |
| `estimatedMinutes` | yes      | 5–10                                                                                                                                                                |
| `topic`            | no       | A short label, e.g. "UI design"                                                                                                                                     |
| `source`           | no       | `{ "title": "…", "url": "https://…" }` credit for the material                                                                                                      |
| `hook`             | yes      | One `choice` or `compare` brick; not scored                                                                                                                         |
| `bricks`           | yes      | The lesson in play order: 1–3 `concept` bricks, each followed by 2–4 question bricks that practise it; 4–8 question bricks in total. The first brick is a `concept` |
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

## Concept bricks

`{ "id", "type": "concept", "title" (≤60 chars), "body" (rich text, ≤80 words), "visual"?, "term"?: { "word", "definition" } }`

```json
{
  "id": "c1",
  "type": "concept",
  "title": "Buttons do, links go",
  "body": "Ask whether the action **does** something or **goes** somewhere.",
  "term": {
    "word": "Link",
    "definition": "An element with an address (href) that takes people somewhere."
  }
}
```

## Every question brick

`{ "id", "type", "prompt" (rich text, ≤40 words), "visual"?, "hint"?, "explanation" }` plus the fields for its type.

## Visuals

```json
{ "kind": "html", "html": "<div class='flex gap-2'><button class='btn'>Save</button></div>", "css": "optional extra CSS", "height": 200 }
{ "kind": "code", "language": "javascript", "code": "const x = 1;\nconsole.log(x);", "highlight": [2], "hotspots": [{ "id": "l2", "line": 2 }] }
{ "kind": "math", "tex": "A = P(1 + r)^n" }
```

`height` is optional (the player sizes HTML visuals to their content). `hotspots` on code are only for `hotspot` bricks.

## Options

Used by `choice` and `compare`: `{ "id", "text"? (rich text), "visual"?, "feedback"? (required on wrong options), "lang"? }`. Give each option text or a visual. Options with visuals show as cards in two columns, with `text` as a caption under the visual; in a `choice`, give either every option a visual or none, and give each visual option a short `text` caption (screen readers announce the caption, not the visual).

## The question bricks

```json
{ "id": "p1", "type": "choice", "prompt": "…", "options": [ … 2–5 … ], "correct": ["a"], "multiple": false, "explanation": "…" }

{ "id": "p2", "type": "compare", "prompt": "Which … is clearer?", "options": [ … exactly 2 … ], "correct": "b", "explanation": "…" }

{ "id": "p3", "type": "hotspot", "prompt": "Tap the …",
  "visual": { "kind": "html", "html": "<button data-hotspot='save' class='btn'>Save</button><button data-hotspot='more' class='btn'>More</button>" },
  "correct": ["more"], "multiple": false, "explanation": "…" }

{ "id": "p4", "type": "sort", "prompt": "Sort each …",
  "groups": [ { "id": "g1", "label": "Goal" }, { "id": "g2", "label": "Non-goal", "lang": "en" } ],
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

- Hook is `choice` or `compare`; the first brick is a `concept`; 1–3 concept bricks; 2–4 question bricks after each concept brick; 4–8 question bricks in `bricks` in total; the challenge is a question brick.
- Unique ids; every reference points to something real (`correct`, `group`, `alsoAccept`, `[[gap]]` ids, hotspot ids, code hotspot lines).
- Every wrong `choice`/`compare` option has `feedback`; every question brick has an `explanation`; a `choice` has at least one wrong option; a `scenario` has a `best` option.
- Prompts ≤40 words; concept bodies ≤80 words.
- No `number` bricks; every `blank` has `choices` that include an accepted answer.
- Formulas in `\( … \)` are balanced and render; language codes are valid BCP 47.
- HTML visuals: no scripts, event handlers, iframes, forms, objects, embeds, `javascript:` links, or external URLs; each under 20 KB; the whole file under 500 KB.
