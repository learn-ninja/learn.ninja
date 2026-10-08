# Teaching guide

How to turn the user's input into a lesson that's genuinely good to play. Read this before writing the lesson file.

## 1. Choose one idea

- A lesson teaches **one core idea** in **5–10 minutes**. Set `estimatedMinutes` honestly (5–10).
- Write the `objective` as something the learner can _do_ afterwards: "Give each view one clear primary action", not "Learn about buttons".
- If the input covers several ideas, pick the one everything else depends on. Mention the others to the user as follow-up lessons, and you can suggest one in `wrapup.next`.
- Stay faithful to the source. If the input is an article, teach what it says; don't add claims it doesn't support.

## 2. Shape: interleaved, not "read then quiz"

```
hook → bricks: concept → 2–4 questions → concept → 2–4 questions … (1–3 concepts) → challenge → wrap-up
```

- **Hook:** a `choice` or `compare` question asked _before_ any teaching. It's a guess and isn't scored. Pick something intriguing whose answer the first concept explains. Its `explanation` should make the learner want to know why.
- **Concept bricks:** one idea each, 80 words at most. The first brick is always a concept. Give a concrete example or a visual. Add a `term` when there's a key word to remember.
- **Practice:** 2–4 question bricks right after each concept brick, 4–8 in total across the lesson.
- **Challenge:** one harder, applied question brick that combines the concepts, in whatever form the knowledge is really used: a decision, a flaw to find, a set of things to classify.
- **Wrap-up:** 2–4 takeaways, each one sentence the learner could act on.

## 3. Choose question bricks by fit

Each question brick should ask the learner to do what they'd really do with this knowledge. Start from the question you'd ask a learner face to face, then pick the type that asks it most directly. There's no quota and no set order: a lesson can use two types or six, and can repeat a type as often as the content calls for. Never pick a type for variety's sake.

| Type       | Natural when the learner needs to…                                                              | Forced when…                                                                                             |
| ---------- | ----------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `choice`   | Pick the right answer, cause, or next move                                                      | Never really; it's the safe default. Use `multiple: true` only when several answers are genuinely right. |
| `compare`  | Judge which of two real examples is better (two UIs, two sentences, two plans)                  | The two options are just a right and a wrong statement; that's a `choice`.                               |
| `hotspot`  | Find something inside a realistic artifact: a screen, a recipe, a contract, a line of code      | The "artifact" is a list you built only so there's something to tap.                                     |
| `sort`     | Classify things into categories people really use                                               | The groups are invented for the brick, or there are only two items per group.                            |
| `order`    | Sequence a real process where the order matters and mistakes have consequences                  | The order is arbitrary, or obvious from the wording.                                                     |
| `match`    | Pair things that come in pairs: terms and meanings, words and translations, symptoms and causes | It just re-tests the concept brick's vocabulary with no thinking involved.                               |
| `blank`    | Recall exact wording that matters: code, a phrase in another language, a formula                | It's a sentence from the concept brick with a word removed; that's recall, not understanding.            |
| `scenario` | Make a call in a realistic situation where options have trade-offs                              | There's one obviously right answer; that's a `choice`.                                                   |

Before you keep a question brick, ask:

- **Would a good teacher ask this, in this form?** If the honest version of the question is multiple choice, use `choice`, even if the previous brick was a `choice` too.
- **Does it ask something new?** Each brick should test a different aspect or application of the idea, not restate the last one in another format.
- **Is the artifact real?** Hotspots, compares and scenarios work when they show something the learner will meet: a real screen, a real recipe step, a real decision.

Mechanics of each type:

- **compare:** exactly 2 options. Great with HTML visuals (two UIs) or two short texts.
- **choice:** 2–5 options, one correct (or `multiple: true` for "pick all that apply"). When the question is about something to look at (a chart, a screen, a diagram), put it in the brick's `visual`, above text options. When the answers themselves are something to look at (which layouts, charts, or components get it right), give every option an HTML visual and a short `text` caption: they show as cards in two columns, like `compare`.
- **hotspot:** tap the part of a visual that matters. In HTML, mark tappable elements with `data-hotspot="id"`; in code, list `hotspots` by line number.
- **sort:** 4–8 items into 2–3 groups. Every group should get at least one item.
- **order:** 3–6 items written in the correct order (the player shuffles them). Use `alsoAccept` if another order is genuinely right too.
- **match:** 3–5 pairs.
- **blank:** fill gaps in a sentence or code from word chips. Each gap's `choices` include the right answer plus 1–2 believable decoys.
- **scenario:** a short situation and 2–4 options, each with a `quality` (`best`, `okay`, `poor`) and an `outcome` that shows the consequence.

## 4. Feedback that teaches

- **Every wrong option gets `feedback`** that explains _why_ it's wrong, in a sentence or two. Name the misconception: "That's simple interest. Year 2 also earns interest on year 1's $50."
- **Build wrong options from real mistakes** people make, not from obviously silly answers. A good wrong option is tempting.
- **Every question brick gets an `explanation`** of why the right answer is right. It's shown after the learner answers.
- **Blanks:** add a `mistakes` entry for each decoy chip, explaining it.
- **Hints** (optional) nudge without giving the answer away: "What is the one thing this page exists to help people do?"
- **Scenario outcomes** describe what happens next, so even a poor choice teaches something.

## 5. Writing style

- Prompts: 40 words at most, one clear task. Questions end with a question mark.
- Plain, friendly, specific language. Short sentences. No filler ("In this lesson we will…").
- Rich text supports `**bold**`, `*italic*`, `` `code` ``, and inline formulas `\( ... \)`. A `$` is always a plain dollar sign.
- Don't reveal the answer in the prompt or the concept brick's wording.

## 6. Visuals

Visuals make lessons feel real. There are three kinds:

- **`html`**: UI examples, diagrams, simple charts, layouts. It runs in a sandbox with no scripts.
- **`code`**: code with syntax highlighting. Give the `language` (e.g. `javascript`, `python`, `css`).
- **`math`**: a formula on its own line, in TeX: `{ "kind": "math", "tex": "A = P(1 + r)^n" }`.

### The built-in UI kit for HTML visuals

HTML visuals use **Basecoat** (shadcn/ui's design system as plain HTML) plus **Tailwind utility classes** for layout. They match the player's look automatically.

| Component    | Markup                                                                                                                                                      |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Button       | `<button class="btn">Save</button>`; add `data-variant="secondary"`, `"outline"`, `"ghost"`, `"link"`, or `"destructive"`; `data-size="sm"`, `"lg"`, `"xs"` |
| Input        | `<input class="input" placeholder="Email">`, with `<label class="label">Email</label>`                                                                      |
| Textarea     | `<textarea class="textarea"></textarea>`                                                                                                                    |
| Checkbox     | `<input type="checkbox" class="input" checked>`                                                                                                             |
| Switch       | `<input type="checkbox" role="switch" class="input">`                                                                                                       |
| Badge        | `<span class="badge">New</span>`; `data-variant="secondary"`, `"outline"`, `"destructive"`                                                                  |
| Alert        | `<div class="alert"><h2>Heads up</h2><section>Your trial ends soon.</section></div>`; `data-variant="destructive"`                                          |
| Card         | `<div class="card"><header><h2>Title</h2><p>Description</p></header><section>Body</section><footer>…</footer></div>`                                        |
| Table        | `<table class="table">…</table>`                                                                                                                            |
| Keyboard key | `<kbd class="kbd">⌘K</kbd>`                                                                                                                                 |

- **Layout:** Tailwind utilities like `flex gap-2 flex-wrap`, `grid grid-cols-2 gap-4`, `p-4`, `rounded-lg`, `border`, `text-sm`, `font-medium`, `text-muted-foreground`, `bg-muted`.
- **Theme colors:** use the theme's color names (`bg-primary`, `text-primary-foreground`, `bg-muted`, `border-border`, `text-destructive`) rather than fixed colors, so visuals work in light and dark mode.
- **Right-to-left:** use direction-aware spacing (`ms-2`, `me-2`, `ps-4`, `pe-4`, `start-0`, `end-0`), not left/right ones.
- **Keep visuals small and focused:** show just enough to make the point. Each visual must be under 20 KB.
- **Not allowed** (the checker rejects them): `<script>`, event handlers like `onclick`, `<iframe>`, `<form>`, `<object>`, `<embed>`, `javascript:` links, and anything loaded from an external URL (images, fonts, stylesheets). Interactive components (dropdowns, tabs, dialogs) can be shown in a fixed state but can't be operated.
- **No images or photos in v1.** Draw what you need with HTML/CSS or inline SVG.
- **Charts in inline SVG:** color strokes and text with theme classes (`stroke-primary`, `stroke-muted-foreground`, `fill-muted-foreground`, `stroke-border`) so they work in both themes, and add `direction='ltr'` to the `<svg>` so axis labels don't flip when the player is right to left (SVG ignores `dir`).

## 7. Languages

- Write all learner-facing text in the lesson's `language` (a BCP 47 code such as `en`, `es`, `ar`, `pt-BR`).
- **Language-learning lessons:** `language` is the language you're teaching _in_ and `targetLanguage` is the one being learned. Mark every phrase in the target language with `lang`: on options, `order` and `sort` items, `sort` group labels, `blank` bricks, and `leftLang` / `rightLang` on `match` pairs.
- **Never translate code**, identifiers, or program output, whatever the lesson's language.

## 8. v1 limits

- No `number` bricks. Ask numeric questions as `choice` with 3–4 options built from common slips (wrong formula, one step short, wrong unit), each with feedback.
- Every `blank` has `choices` (word chips); there's no free typing yet.
- No images, audio, or free-text answers.

## 9. Before you publish

- Run `validate` and fix every issue. The messages say exactly what to change.
- Read the lesson once as a learner: is the hook intriguing? Does every question brick feel like the natural way to ask its question? Does each concept explain the practice that follows? Is every wrong option's feedback specific? Is the challenge harder than the practice?
