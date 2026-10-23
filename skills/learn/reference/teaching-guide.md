# Teaching guide

How to turn the user's input into a lesson that's genuinely good to play. Read this before writing the lesson file.

## 1. Choose one idea

- A lesson teaches **one core idea**, in 3–15 minutes depending on its size (`reference/planning.md`). Set `estimatedMinutes` honestly.
- **One idea, not a chapter:** "Find a percentage change", "Order a coffee in Spanish", "Give each view one primary action". Not "Fractions", "Spanish verbs", or "Buttons".
- Write the `objective` as something the learner can _do_ afterwards: "Give each view one clear primary action", not "Learn about buttons".
- Keep new material small: at most 5–8 new terms, words, or phrases. Fewer, practised well, beats a long list.
- Set `level` for who the lesson is for (`levels/index.md` says how to choose) and read `levels/{level}.md` before writing: it sets what to assume, what the questions ask for, and how much help to give. The size (`reference/planning.md`) sets how many concepts the shape in the next section has.
- If the input covers several ideas, `reference/planning.md` says whether to pick the one everything else depends on or to plan a path of lessons. Either way, name the next lesson in `wrapup.next`: the wrap-up suggests it, and you offer it when you report the link.
- Stay faithful to the source. If the input is an article, teach what it says; don't add claims it doesn't support.

## 2. Shape: interleaved, not "read then quiz"

```
hook → bricks: concept → questions → concept → questions … (1–4 concepts) → challenge → wrap-up
```

- **Hook:** a `choice` or `compare` question asked _before_ any teaching. It's a guess and isn't scored. Pick something intriguing whose answer the first concept explains, ideally a gut answer most people get wrong ("A price rises 50%, then falls 50%. Is it back where it started?") or an assumption the learner brings with them. Its `explanation` should make the learner want to know why.
- **Concept bricks:** one idea each, 80 words at most (the checker counts every word, so aim for 60–70). The first brick is always a concept. Bold a key word the first time it appears, and define it in the body. How to write them:
  - **Concrete before general.** Show one real case first (a worked example with real numbers, two lines of dialogue, a real screen), then state the rule it follows in one sentence.
  - **One step per line** in a worked example or procedure, so the learner sees where each part comes from.
  - **Say why, briefly.** One sentence on why it works beats a rule to memorise.
  - **Say when it applies:** the conditions, context, or setting where it holds, and where it doesn't.
  - **Keep it easy to follow in the player.** There's no calculator, notepad, or audio: pick friendly numbers (10%, 200, ¼) and nothing that needs to be heard.
- **Practice:** 2–4 question bricks right after each concept brick, 3–12 in total across the lesson (`reference/planning.md` has the shape for each size). Take support away as you go: **recognise** it (what does this mean, which is right), then **recall with support** (fill the missing step, word, or term from chips), then **do it** (solve, build, or decide the whole thing), then **vary it** (new context, new numbers, or run backwards).
- **Challenge:** one harder, applied question brick that combines the concepts, in whatever form the knowledge is really used: a decision, a flaw to find, a set of things to classify.
- **Wrap-up:** 2–4 takeaways, each one sentence the learner could act on.

## 3. Choose question bricks by fit

Each question brick should ask the learner to do what they'd really do with this knowledge. Start from the question you'd ask a learner face to face, then pick the type that asks it most directly. There's no quota and no set order: a lesson can use two types or six, and can repeat a type as often as the content calls for. Never pick a type for variety's sake.

| Type       | Natural when the learner needs to…                                                              | Forced when…                                                                                              |
| ---------- | ----------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `choice`   | Pick the right answer, cause, or next move                                                      | Never really; it's the safe default. Use `multiple: true` only when several answers are genuinely right.  |
| `compare`  | Judge which of two real examples is better (two UIs, two sentences, two plans)                  | The two options are just a right and a wrong statement; that's a `choice`.                                |
| `hotspot`  | Find something inside a realistic artifact: a screen, a recipe, a contract, a line of code      | The "artifact" is a list you built only so there's something to tap.                                      |
| `sort`     | Classify things into categories people really use, each with a name of its own                  | The groups are invented, one is just "not the other" (Goal / Non-goal), or each group has only two items. |
| `order`    | Sequence a real process where the order matters and mistakes have consequences                  | The order is arbitrary, or obvious from the wording.                                                      |
| `match`    | Pair things that come in pairs: terms and meanings, words and translations, symptoms and causes | It just re-tests the concept brick's vocabulary with no thinking involved.                                |
| `blank`    | Recall exact wording that matters: code, a phrase in another language, a formula                | It's a sentence from the concept brick with a word removed; that's recall, not understanding.             |
| `scenario` | Make a call in a realistic situation where options have trade-offs                              | There's one obviously right answer; that's a `choice`.                                                    |

Before you keep a question brick, ask:

- **Would a good teacher ask this, in this form?** If the honest version of the question is multiple choice, use `choice`, even if the previous brick was a `choice` too.
- **Does it ask something new?** Each brick should test a different aspect or application of the idea, not restate the last one in another format.
- **Can it be answered by looking up?** If the concept brick or its visual lists the answer (a table of cases, then a `sort` of the same cases; three bolded terms, then a `match` of those terms), it's a lookup, not a question. Ask about a new case the rule decides.
- **Is the artifact real?** Hotspots, compares and scenarios work when they show something the learner will meet: a real screen, a real recipe step, a real decision.

Mechanics of each type:

- **compare:** exactly 2 options. Best with an HTML visual on each (two screens, two layouts, two charts), which show as cards side by side. Two short texts work too, but they show as plain rows, like a `choice`.
- **choice:** 2–5 options, one correct (or `multiple: true` for "pick all that apply"; the player adds that instruction under the prompt, so don't write it in the prompt). When the question is about something to look at (a chart, a screen, a diagram), put it in the brick's `visual`, above text options. When the answers themselves are something to look at (which layouts, charts, or components get it right), give every option an HTML visual: they show as cards in two columns, like `compare`.
- **Option visuals (`choice` and `compare`):** give each one an `alt` for screen readers. A `text` caption under the visual is optional: add one only when it says something the visual can't, such as a name to refer to it by ("Plan A") or context a chart doesn't show. Never repeat text the visual already shows, like an error message or a button label.
- **hotspot:** tap the part of a visual that matters. In HTML, mark tappable elements with `data-hotspot="id"`; in code, list `hotspots` by line number. Good for finding the mistake: one hotspot per line of a worked solution, or per word or phrase of a short message.
- **sort:** 4–8 items into 2–3 groups. Every group should get at least one item, and every group needs a name of its own. If a group would be "Not X" or "Other", ask "Which of these are X?" as a `choice` with `multiple: true` instead.
- **order:** 3–6 items written in the correct order (the player shuffles them). Use `alsoAccept` if another order is genuinely right too.
- **match:** 3–5 pairs.
- **blank:** fill gaps in a sentence, formula, or code from word chips. Each gap's `choices` include the right answer plus 1–2 believable decoys. Use `numeric` for a number gap and `strictAccents` when accents change the meaning (_si_ and _sí_).
- **scenario:** a short situation and 2–4 options, each with a `quality` (`best`, `okay`, `poor`) and an `outcome` that shows the consequence.

## 4. Feedback that teaches

- **Feedback explains; it never introduces.** All of it shows in the ninja's speech bubble: after a miss, the question's hint (or, without one, the wrong option's feedback); after a right answer, the explanation only if the learner taps Why?. A learner who answers right may never see any of it. If a question needs a term, fact, or method, a concept brick before it teaches it. Feedback can name a mistake only in words the lesson has already taught.
- **Every wrong option gets `feedback`** that explains _why_ it's wrong, in a sentence or two. Name the misconception: "That's simple interest. Year 2 also earns interest on year 1's $50."
- **Build wrong options from real mistakes** people make, not from obviously silly answers. A good wrong option is tempting. Each should come from one specific slip its feedback names. Common sources:
  - a rule carried over from where it doesn't apply (a literal translation, simple interest where it compounds)
  - near neighbours mixed up (false friends, percent and percentage points, mean and median)
  - a step missed, or done in the wrong order
  - the wrong base, unit, or scale
- **The right answer shouldn't stand out:** not the only round number, always the middle value, or the longest option.
- **Name answers by what they say, not where they sit.** The player shuffles options and a match's right column, so "the second statement" or "option B" can point at the wrong one. Write "the nurses' statement" or "the many-causes explanation" instead. The checker rejects position words in explanations, hints, feedback, and outcomes.
- **Every question brick gets an `explanation`** of why the right answer is right, in 30 words or fewer; aim for about 25, since the checker counts every word (the checker enforces it). It shows in the ninja's speech bubble, so apply the idea to this question; don't restate the concept the learner just read. It shows when the learner taps Why? after a right answer, and by itself once a missed answer is revealed. The warm-up shows no explanation: the concept after it does the explaining. For a calculation, put each worked step on its own line (a `\n` between lines), after an optional one-line lead: `"Each year's interest joins the balance.\nYear 1: $1,000 × 1.05 = $1,050\nYear 2: $1,050 × 1.05 = $1,102.50"`.
- **Blanks:** add a `mistakes` entry for each decoy chip, explaining it.
- **Hints** (optional) nudge without giving the answer away, in one short line; the player shows the hint after a miss, before the retry: "What is the one thing this page exists to help people do?" How many there are, and how much they give away, follows the level: most questions for beginners, one or two for advanced learners.
- **Scenario outcomes** describe what happens next, so even a poor choice teaches something.

## 5. Writing style

- Prompts: 40 words at most, one clear task. Questions end with a question mark.
- Plain, friendly, specific language. Short sentences. No filler ("In this lesson we will…").
- Rich text supports `**bold**`, `*italic*`, `` `code` ``, and inline formulas `\( ... \)`. A `$` is always a plain dollar sign.
- **Code goes in backticks, wherever it appears:** commands (`` `git push` ``), flags, file names, paths, identifiers, HTML tags, and values, in prompts, options, match pairs, sort and order items, blank chips, feedback, and explanations alike. The player then shows it in monospace; without the backticks it reads as plain prose, and the checker rejects it. An item that is only code (a match pair's `` `git pull` ``) renders as code without an extra box.
- In formulas, name a quantity before its symbol ("the interest rate, `\( r \)`"), use `\times` or `\cdot` (never `*`) and `\frac`, and follow the lesson language's decimal mark (`3{,}5` in TeX).
- Don't reveal the answer in the prompt or the concept brick's wording.

## 6. Visuals

Visuals make lessons feel real. There are five kinds:

- **`chart`**: any data with axes: a scatter, bar, or line chart drawn by the player from the points you give, in the lesson's own style. Give the points, axis labels, and an `alt`. Never draw a chart by hand in HTML or SVG.
- **`diagram`**: boxes and arrows, written in D2 and laid out for you: flows and processes, cause and effect, architecture (client, server, database), trees and hierarchies, state machines, any graph of things and how they connect. D2 also draws sequence diagrams (who sends what to whom, in order), grids (a timeline, a row of stages, a few cells side by side), and tables (a record's fields, a database table with its keys). Give the D2 and an `alt`. Never place the boxes of a flow by hand in HTML or SVG.
- **`html`**: UI examples, layouts, and pictures: an anatomy drawing, a map sketch, a geometry figure, anything whose layout is the point. It runs in a sandbox with no scripts. Give it an `alt`: one sentence of at most 200 characters saying what it shows, as you'd describe it to someone who can't see it ("Two buttons: a filled Place order and an outlined Back to cart").
- **`code`**: code with syntax highlighting. Give the `language` (e.g. `javascript`, `python`, `css`).
- **`math`**: a formula on its own line, in TeX: `{ "kind": "math", "tex": "A = P(1 + r)^n" }`.

### The built-in UI kit for HTML visuals

HTML visuals use **Basecoat** (shadcn/ui's design system as plain HTML, in shadcn's standard Vega style) plus **Tailwind utility classes** for layout. They match the player's look automatically.

| Component       | Markup                                                                                                                                                                       |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Button          | `<button class="btn">Save</button>`; add `data-variant="secondary"`, `"outline"`, `"ghost"`, `"link"`, or `"destructive"`; `data-size="sm"`, `"lg"`, `"xs"`                  |
| Field           | `<div class="field"><label class="label" for="email">Email</label><input class="input" id="email"></div>`                                                                    |
| Field error     | Add `data-invalid="true"` to the field and `aria-invalid="true"` to the input, then `<p role="alert">Enter a full email address.</p>`                                        |
| Textarea        | `<textarea class="textarea"></textarea>`                                                                                                                                     |
| Checkbox        | `<label class="label"><input type="checkbox" class="input" checked> Remember me</label>`                                                                                     |
| Switch          | `<input type="checkbox" role="switch" class="input">`                                                                                                                        |
| Radio           | `<input type="radio" name="plan" class="input" checked>`, one per option, each in a `label`                                                                                  |
| Select (closed) | `<select class="select"><option>Canada</option></select>`                                                                                                                    |
| Slider          | `<input type="range" class="input" value="40">`                                                                                                                              |
| Progress        | `<div class="progress"><span class="w-3/5"></span></div>`                                                                                                                    |
| Tabs            | `<div class="tabs"><nav role="tablist"><button role="tab" aria-selected="true">Account</button><button role="tab">Password</button></nav><div role="tabpanel">…</div></div>` |
| Accordion       | `<section class="accordion"><details open><summary>Is it free?</summary><section><p>Yes.</p></section></details></section>`                                                  |
| Badge           | `<span class="badge">New</span>`; `data-variant="secondary"`, `"outline"`, `"destructive"`                                                                                   |
| Alert           | `<div class="alert"><h2>Heads up</h2><section>Your trial ends soon.</section></div>`; `data-variant="destructive"`                                                           |
| Card            | `<div class="card"><header><h2>Title</h2><p>Description</p></header><section>Body</section><footer>…</footer></div>`                                                         |
| Table           | `<table class="table">…</table>`                                                                                                                                             |
| Avatar          | `<span class="avatar"><span>CP</span></span>`                                                                                                                                |
| Skeleton        | `<div class="skeleton h-4 w-40"></div>`                                                                                                                                      |
| Empty state     | `<div class="empty"><header><h3>No projects yet</h3><p>Create one to get started.</p></header><section><button class="btn">New project</button></section></div>`             |
| Keyboard key    | `<kbd class="kbd">⌘K</kbd>`                                                                                                                                                  |

Overlays render in place, sized to fit the visual, so you can show them open:

| Overlay     | Markup                                                                                                                                                                                                                             |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Dialog      | `<dialog class="dialog" open><div><header><h2>Rename project</h2><p>…</p></header><section>…</section><footer>buttons</footer></div></dialog>`; `class="alert-dialog"` for a confirmation                                          |
| Toast       | `<div class="toaster"><div class="toast" role="status"><div class="toast-content"><section><h2>Saved</h2><p>…</p></section><footer>…</footer></div></div></div>`                                                                   |
| Open menu   | `<div class="dropdown-menu"><button class="btn" data-variant="outline">Options</button><div data-popover aria-hidden="false"><div role="menu"><div role="menuitem">Edit</div><hr role="separator">…</div></div></div>`             |
| Open select | `<div class="select"><button class="btn" data-variant="outline">Apple</button><div data-popover aria-hidden="false"><div role="listbox"><div role="option" data-value="apple" aria-selected="true">Apple</div>…</div></div></div>` |
| Popover     | `<div class="popover"><button class="btn">Share</button><div data-popover aria-hidden="false">…</div></div>`; opens below, or above with `data-side="top"`                                                                         |
| Tooltip     | `data-tooltip="Copy link"` on any element; shows above it, or below with `data-side="bottom"`                                                                                                                                      |

- **Layout:** Tailwind utilities like `flex gap-2 flex-wrap`, `grid grid-cols-2 gap-4`, `p-4`, `rounded-lg`, `border`, `text-sm`, `font-medium`, `text-muted-foreground`, `bg-muted`.
- **Theme colors:** use the theme's color names (`bg-primary`, `text-primary-foreground`, `bg-muted`, `border-border`, `text-destructive`) rather than fixed colors, so visuals work in light and dark mode.
- **Right-to-left:** use direction-aware spacing (`ms-2`, `me-2`, `ps-4`, `pe-4`, `start-0`, `end-0`), not left/right ones.
- **Width:** the player centers a visual at its own width and never stretches it. When the visual is a surface (a card, dialog, screen, form, table, or chart), give its outer element `w-full` plus a cap, so it fills narrow spaces but stays a sensible size in wide ones: `max-w-xs` in option visuals, `max-w-sm` elsewhere. Leave small pieces (a few buttons, a badge, a single field) at their natural size.
- **Phones:** many learners play on a phone, where the lesson column is about 340px wide (option cards about 160px). Lay visuals out tall rather than wide: stack things instead of putting them side by side, keep tables to 3 columns (or turn rows into a list of small cards), and give nothing a fixed width over 320px. A wide picture still works (phones get a button to open it full screen), but one that reads at phone width doesn't need it.
- **Keep visuals small and focused:** show just enough to make the point. Each visual must be under 20 KB.
- **Not allowed** (the checker rejects them): `<script>`, event handlers like `onclick`, `<iframe>`, `<form>`, `<object>`, `<embed>`, `javascript:` links, and anything loaded from an external URL (images, fonts, stylesheets). A visual is a still picture: components show the state you write (open, checked, selected, invalid) and can't be operated.
- **No images or photos in v1.** Draw what you need with HTML/CSS or inline SVG.
- **Drawings in inline SVG** (pictures, not graphs: boxes and arrows are `diagram` visuals, charts are `chart` visuals): color strokes and text with theme classes (`stroke-primary`, `stroke-muted-foreground`, `fill-muted-foreground`, `stroke-border`) so they work in both themes, and add `direction='ltr'` to the `<svg>` so labels don't flip when the player is right to left (SVG ignores `dir`).
- **Icons** come from the built-in kit, never drawn by hand or loaded from a URL: `<span class="icon-[lucide--git-branch]"></span>`, with a set and an icon name joined by `--`. Sets: `lucide` (general interface icons, the player's own), `octicon` (GitHub's icons, so a GitHub lesson shows what the learner will see: `octicon--repo-16`, `octicon--git-pull-request-16`, `octicon--issue-opened-16`), `simple-icons` (brand marks in one color), `logos` (brand logos in their own colors) and `vscode-icons` (file and language icons in color: `vscode-icons--file-type-python`). One-color icons take the text color, so `text-primary`, `text-muted-foreground`, `text-destructive`, or `text-chart-2` colors them and they work in both themes; colored logos keep their colors, so a dark mark like `logos--github-icon` disappears on a dark screen: for a brand mark prefer `simple-icons`, and keep `logos` and `vscode-icons` for marks whose colors are the point (a language, a file type). An icon is 1em, the size of the text next to it (`<span class="inline-flex items-center gap-1.5"><span class="icon-[octicon--git-branch-16]"></span> main</span>`); for a bigger one, set a size (`size-8`, `text-3xl`). Icons decorate: a label always says what the thing is, the `alt` names what the icons show, and a question never asks the learner to recognise an icon they haven't been shown. Publishing rejects an icon name that doesn't exist and suggests the closest.

### Diagrams in D2

- **Pick D2 when the picture is a graph**: things, and arrows or lines between them. The layout engine places the boxes and routes the arrows, so nothing overlaps or drifts. Pick inline SVG in an `html` visual when the picture is a drawing whose shapes and positions carry the meaning (the parts of a cell, a triangle with its angles, a floor plan).
- **Sequence diagrams** (`shape: sequence_diagram` on the first line) show who sends what to whom, in order: a request through a system, a protocol, a handshake, a conversation. Declare the actors first, in the order they should appear, then the messages, one per line, in the order they happen (`browser -> server: GET /lessons`). `a -> a: thinks` is a message to oneself, `a.note: Waits for the reply` pins a note to an actor, and a container groups a run of messages under a label (`login: Login { a -> b: hello }`; the actors inside it must be declared above it). Keep to 2 to 4 actors (each adds a column, and phones are narrow) and 3 to 8 messages.
- **Grids** (`grid-rows` or `grid-columns` in a container) place things in rows and columns instead of a graph: a timeline, the stages of a process in a row, a few cells to compare, a layout. The cells are ordinary boxes; `grid-gap: 0` joins them into a strip, and a label with a line break (`"1200 BC\nTrade thrives"`) puts a date or name above its text. Keep a row to 3 cells, or use `grid-columns: 1` to stack them, so the grid reads on a phone. Arrows inside a grid draw as straight lines between centers, so use a grid for placement and a flow for what connects.
- **Tables** (`shape: sql_table`) show a record or a database table: each line is `name: type`, and `{constraint: primary_key}`, `foreign_key`, or `unique` marks a key (drawn as PK, FK, UNQ). An arrow from a column to another table's column (`users.team_id -> teams.id`) shows a relation. Keep to 3 to 6 columns per table and 2 or 3 tables.
- **Keep it small:** 3 to 8 boxes, labels of 1 to 4 words, an arrow label only where the arrow's meaning isn't obvious. A diagram wider than the lesson column is scaled down, and its text with it, most of all on a phone (about 340px): prefer `direction: down` (the default), and use `direction: right` only for a chain of 3 boxes or fewer. Split anything bigger into two bricks.
- **Show the point, not everything:** one container for things that belong together, `style.bold: true` or `style.stroke-width: 3` on the one box the brick is about, `style.stroke-dash: 4` for something hypothetical or optional.
- **Right-to-left lessons:** write `direction: left` for a flow that reads across, so it runs the way the text does.
- **Icons on boxes:** `icon: set/name` from the same kit as HTML visuals (`icon: octicon/repo-16`, `icon: lucide/database`, `icon: logos/github-icon`). Use them when the thing has a recognisable picture (a repo, a branch, a database, a browser, a language), on every box of a kind or none, not as decoration on one. The player draws the icon at 32px in the lesson's text color.
- **Where the icon goes:** the label sits at the top of the box and the icon under it, and that default is the one that reads well. `icon.near` can move the icon (`top-left` … `bottom-right`, or `outside-top-center` and the like for outside the box) and `label.near` the label, but a `top-*` icon lands on the label, and a side position (`center-left`, `center-right`) makes D2 widen every box so the whole drawing shrinks to fit. Use them only for one box that needs it, never as the house style.
- **The icon as the box:** `shape: image` with an icon draws only the icon, with the label under it, 56px wide unless you set `width` and `height` (48 to 80 reads well). Good for a few things in a row, like the steps of a flow; use labelled boxes when the name matters more than the picture.
- **Not allowed** (publishing rejects them): colors (the player draws every diagram in the lesson's colors, in light and dark), icons from a URL, `link`, `tooltip`, HTML or images in Markdown labels, and a box or container named with a D2 keyword: `steps`, `layers`, and `scenarios` move their contents to another page, so the lesson would show nothing (call it `stages`, `timeline`, or `phases`); `vars`, `classes`, `label`, `shape`, `style`, `near`, and `direction` are settings, not boxes.

## 7. Languages

- Write all learner-facing text in the lesson's `language` (a BCP 47 code such as `en`, `es`, `ar`, `pt-BR`).
- **Language-learning lessons:** `language` is the language you're teaching _in_ and `targetLanguage` is the one being learned, with a region when the variety matters (`es-MX`, `pt-PT`). Mark every phrase in the target language with `lang`: on options, `order` and `sort` items, `sort` group labels, `blank` bricks, and `leftLang` / `rightLang` on `match` pairs. Keep each chip in one language. For beginners in a non-Latin script, add a romanisation the first time a word appears, e.g. こんにちは (konnichiwa), except in a brick that tests reading it.
- **Never translate code**, identifiers, or program output, whatever the lesson's language.

## 8. Accuracy

- **Work every answer yourself, step by step, before writing the options.** Then check each wrong option: is it really wrong, and does it come from the slip its feedback names?
- **Many things have more than one right answer.** If a variant is acceptable (another phrasing, another order, another regional form), accept it (`accept`, `alsoAccept`) or say which one the lesson teaches.
- **State what the answer depends on** in the prompt: rounding, units, assumptions ("to the nearest dollar", "if the rate stays the same"), so exactly one option is right.
- **Use what people really say and do today**, not textbook versions nobody uses, unless that's the point of the lesson.
- **Get the details right:** notation, units, accents, capitalisation, punctuation.

## 9. v1 limits

- No `number` bricks. Ask numeric questions as `choice` with 3–4 options built from common slips (wrong formula, one step short, wrong unit), each with feedback.
- Every `blank` has `choices` (word chips); there's no free typing yet.
- No images, audio, or free-text answers.

## 10. Before you publish

- Run `validate` and fix every issue. The messages say exactly what to change.
- Read the lesson once as a learner: is the hook intriguing? Does every question brick feel like the natural way to ask its question? Does each concept explain the practice that follows? Is every wrong option's feedback specific? Is the challenge harder than the practice? Is every term, fact, and method each question needs taught in an earlier concept brick, not only in feedback, a hint, or an explanation? Does it hold its level? Run the "You've drifted if…" check in `levels/{level}.md`, and cut any concept sentence that re-teaches what the summary says the learner knows.
