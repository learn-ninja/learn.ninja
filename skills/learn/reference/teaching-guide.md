# Teaching guide

How to turn the user's input into a lesson that's genuinely good to play. Read this before writing the lesson file.

A lesson lands when the learner commits to a guess they have a reason for, finds out it was wrong, and is shown why the tempting idea fails. Everything below serves that turn: the plan finds the wrong idea, the hook draws it out, the first concept overturns it, and the questions make it fail again in new cases.

## 1. Choose one idea

- A lesson teaches **one core idea**, in 3–15 minutes depending on its size (`reference/planning.md`). Set `estimatedMinutes` honestly.
- **One idea, not a chapter:** "Find a percentage change", "Order a coffee in Spanish", "Give each view one primary action". Not "Fractions", "Spanish verbs", or "Buttons".
- Write the `objective` as something the learner can _do_ afterwards: "Give each view one clear primary action", not "Learn about buttons".
- Keep new material small: at most 5–8 new terms, words, or phrases. Fewer, practised well, beats a long list.
- Set `level` for who the lesson is for (`levels/index.md` says how to choose) and read `levels/{level}.md` before writing: it sets what to assume, what the questions ask for, and how much help to give. The size (`reference/planning.md`) sets how many concepts the shape in the next section has.
- If the input covers several ideas, `reference/planning.md` says whether to pick the one everything else depends on or to plan a path of lessons. Either way, name the next lesson in `wrapup.next`: the wrap-up suggests it, and you offer it when you report the link.
- Stay faithful to the source. If the input is an article, teach what it says; don't add claims it doesn't support.
- **Build the lesson on its turn.** `reference/planning.md` has you write three lines before any JSON: the idea, the wrong idea a learner at this level arrives with, and a case where the two give different answers. The hook asks that case, the first concept resolves it, the wrong options come from the wrong idea and its neighbours, and the challenge tempts it once more.

## 2. Shape: interleaved, not "read then quiz"

```
hook → katas: concept → questions → concept → questions … (1–4 concepts) → challenge → wrap-up
```

- **Hook:** a `choice` or `compare` question asked _before_ any teaching. It's a guess and isn't scored, but the learner has to commit to an answer, and that's what makes the lesson stick. A guess only helps what it asks about, so:
  - **Ask the lesson's central idea**, as the case from your plan where the wrong idea and the right one part ways ("A price rises 50%, then falls 50%. Is it back where it started?"). Not a fun fact from nearby, and not a definition.
  - **Make it answerable from what the learner already believes.** They need a gut answer and a reason for it: surprise needs an expectation to overturn. A question about a term they've never met, or a number they can only pick at random, is a blind guess and teaches nothing. When a beginner or a child couldn't reason toward any answer, ask about an everyday case of the idea instead.
  - **Put the wrong idea among the options, written as fairly as the right one.** Most people should pick it.
  - **Its `explanation` is the answer, in one line.** The player shows it right after the guess, to those who guessed right and those who guessed wrong alike: say what's true ("It ends at 75% of where it started, not back at 100%."), and leave why to the first concept. Don't open with "No" or "Correct", which is wrong for half the readers, and don't tease ("You'll find out…", "The next screen shows why"): a guess left unanswered is wasted.
- **Concept katas:** one idea each, 80 words at most (the checker counts every word, so aim for 60–70). The first kata is always a concept. Bold a key word the first time it appears, and define it in the body. How to write them:
  - **The first concept resolves the hook.** Take the hook's own case and show why the tempting answer fails: name the wrong idea plainly ("the tempting answer", never "your guess": some learners guessed right), say why it feels right, then show what's really going on. If the hook had a visual, show it again changed (the same scatter plot, now colored by season), so the learner sees their guess overturned, not a new topic begun.
  - **Concrete before general.** Show one real case first (a worked example with real numbers, two lines of dialogue, a real screen), then state the rule it follows in one sentence.
  - **One step per line** in a worked example or procedure, so the learner sees where each part comes from.
  - **Say why, briefly.** One sentence on why it works, tied to the example on screen, beats a rule to memorise. This holds at every level: the reason is what makes the rule make sense.
  - **Say when it applies:** the conditions, context, or setting where it holds, and where it doesn't.
  - **Keep it easy to follow in the player.** There's no calculator, notepad, or audio: pick friendly numbers (10%, 200, ¼) and nothing that needs to be heard.
  - **Never restate the visual.** The learner sees the visual first, so the body says what to notice in it and why it matters: the pattern across a table's rows, not the rows again; what the arrows in a diagram mean, not a list of its boxes. If a sentence can be read straight off the visual, cut it.
- **Practice:** 2–4 question katas right after each concept kata, 3–12 in total across the lesson (`reference/planning.md` has the shape for each size). Take support away as you go: **recognise** it (what does this mean, which is right), then **recall with support** (fill the missing step, word, or term from chips), then **do it** (solve, build, or decide the whole thing), then **vary it** (new context, new numbers, or run backwards).
- **Challenge:** one harder, applied question kata that combines the concepts, in whatever form the knowledge is really used: a decision, a flaw to find, a set of things to classify. Make it a new case where the wrong idea from your plan is tempting again, so getting it right shows the idea has really changed.
- **Wrap-up:** 2–4 takeaways, each one sentence the learner could act on. One of them answers the hook's question in the lesson's new terms.

## 3. Choose question katas by fit

Each question kata should ask the learner to do what they'd really do with this knowledge. Start from the question you'd ask a learner face to face, then pick the type that asks it most directly. There's no quota and no set order: a lesson can use two types or six, and can repeat a type as often as the content calls for. Never pick a type for variety's sake.

| Type       | Natural when the learner needs to…                                                              | Forced when…                                                                                              |
| ---------- | ----------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `choice`   | Pick the right answer, cause, or next move                                                      | Never really; it's the safe default. Use `multiple: true` only when several answers are genuinely right.  |
| `compare`  | Judge which of two real examples is better (two UIs, two sentences, two plans)                  | The two options are just a right and a wrong statement; that's a `choice`.                                |
| `hotspot`  | Find something inside a realistic artifact: a screen, a recipe, a contract, a line of code      | The tappable parts are statements to read and judge; that's a `choice` or a `scenario`.                   |
| `sort`     | Classify things into categories people really use, each with a name of its own                  | The groups are invented, one is just "not the other" (Goal / Non-goal), or each group has only two items. |
| `order`    | Sequence a real process where the order matters and mistakes have consequences                  | The order is arbitrary, or obvious from the wording.                                                      |
| `match`    | Pair things that come in pairs: terms and meanings, words and translations, symptoms and causes | It just re-tests the concept kata's vocabulary with no thinking involved.                                |
| `blank`    | Recall exact wording that matters: code, a phrase in another language, a formula                | It's a sentence from the concept kata with a word removed; that's recall, not understanding.             |
| `scenario` | Make a call in a realistic situation where options have trade-offs                              | There's one obviously right answer; that's a `choice`.                                                    |

Before you keep a question kata, ask:

- **Would a good teacher ask this, in this form?** If the honest version of the question is multiple choice, use `choice`, even if the previous kata was a `choice` too.
- **Does it ask something new?** Each kata should test a different aspect or application of the idea, not restate the last one in another format.
- **Can it be answered by looking up?** If the concept kata or its visual lists the answer (a table of cases, then a `sort` of the same cases; three bolded terms, then a `match` of those terms), it's a lookup, not a question. Ask about a new case the rule decides.
- **Is the artifact real?** Hotspots, compares and scenarios work when they show something the learner will meet: a real screen, a real recipe step, a real decision.
- **Does tapping add anything?** If a hotspot's regions are statements to read and judge (claims, requirements, the points of a summary), where they sit doesn't matter: they're options. Use `choice`, or `scenario` for a judgment call, and put anything to check them against (call notes, a report) in the kata's `visual`. Keep hotspots for what the learner finds in place: a control on a screen, a part of a chart, a line of code, a step in a worked solution.

Mechanics of each type:

- **compare:** exactly 2 options. Best with an HTML visual on each (two screens, two layouts, two charts), which show as cards side by side. Two short texts work too, but they show as plain rows, like a `choice`.
- **choice:** 2–5 options, one correct (or `multiple: true` for "pick all that apply"; the player adds that instruction above the prompt, so don't write it in the prompt). When the question is about something to look at (a chart, a screen, a diagram), put it in the kata's `visual`, above text options. When the answers themselves are something to look at (which layouts, charts, or components get it right), give every option an HTML visual: they show as cards in two columns, like `compare`.
- **Option visuals (`choice` and `compare`):** give each one an `alt` for screen readers. A `text` caption under the visual is optional: add one only when it says something the visual can't, such as a name to refer to it by ("Plan A") or context a chart doesn't show. Never repeat text the visual already shows, like an error message or a button label.
- **hotspot:** tap the part of a visual that matters. In HTML, mark tappable elements with `data-hotspot="id"`; in code, list `hotspots` by line number; on a `chess` board every square is tappable, and `correct` lists squares ("Where can the knight fork the king and the rook?", or "Tap every square the bishop attacks" with `multiple: true`); on a `map` every country drawn is tappable, and `correct` lists country codes ("Tap the country where the Hittites lived", or "Tap every country where the Phoenicians founded a city" with `multiple: true`). Good for finding the mistake: one hotspot per line of a worked solution, or per word or phrase of a short message.
- **sort:** 4–8 items into 2–3 groups. Every group should get at least one item, and every group needs a name of its own. If a group would be "Not X" or "Other", ask "Which of these are X?" as a `choice` with `multiple: true` instead.
- **order:** 3–6 items written in the correct order (the player shuffles them). Use `alsoAccept` if another order is genuinely right too.
- **match:** 3–5 pairs.
- **blank:** fill gaps in a sentence, formula, or code from word chips. Each gap's `choices` include the right answer plus 1–2 believable decoys. Use `numeric` for a number gap. Accents always count, so a chip that differs only by its accent (_si_ for _sí_) is a fair decoy; one that differs only by case isn't, unless the kata is `caseSensitive`.
- **scenario:** a situation with some build-up, and 2–4 options, each with a `quality` (`best`, `okay`, `poor`) and an `outcome` that shows the consequence. Write the `situation` as a short story in two to four sentences: set the scene (where the learner is, who's there), say what's at stake, and end on the moment that calls for a decision ("Two days before the review, a VP stops by your desk."). The ninja tells it one sentence at a time before the question, so a single sentence is a story with one beat; the checker rejects it. When the decision is what to say to someone, put their last line in a `chat` visual and write the outcomes as their replies (see Visuals).

## 4. Feedback that teaches

- **Feedback explains; it never introduces.** It shows under the answers: after a miss, the question's hint (or, without one, the wrong option's feedback); after a right answer, the explanation, every time. A learner who answers right never sees a hint or a wrong option's feedback. If a question needs a term, fact, or method, a concept kata before it teaches it. Feedback can name a mistake only in words the lesson has already taught.
- **Every wrong option gets `feedback`** that explains _why_ it's wrong, in a sentence or two. Name the misconception: "That's simple interest. Year 2 also earns interest on year 1's $50."
- **Build wrong options from real mistakes** people make, not from obviously silly answers. A good wrong option is tempting. Each should come from one specific slip its feedback names. Common sources:
  - a rule carried over from where it doesn't apply (a literal translation, simple interest where it compounds)
  - near neighbours mixed up (false friends, percent and percentage points, mean and median)
  - a step missed, or done in the wrong order
  - the wrong base, unit, or scale
- **Write the options as a set, so the right one doesn't stand out.** The usual giveaway is length: the right answer gets the reason, the condition, and the careful wording, and the wrong ones get a few quick words, so someone who knows nothing can pick the longest. Keep every option to the same length and the same kind of sentence, and make a wrong option the longest about as often as the right one. Two ways to get there: cut the right answer down to its claim, since the reason belongs in the `explanation`, or give each wrong option the reasoning that makes it tempting.
  - Gives it away: "Trust it, since it includes a URL." / "Check that the journal is a real one." / "Open it and confirm the article exists and says what the AI claims."
  - Even: "Trust it, since a made-up source has no URL." / "Look up the journal to confirm that it's real." / "Open the link and read what the article says."
  - Other giveaways: the only round number, always the middle value, the only option with a number or a detail, the only hedged option ("usually") among "always" and "never", or the only one in the concept's own words.
  - The checker rejects a right answer of 30 characters or more that's at least 1.5 times as long as every wrong option. It also rejects a lesson with 4 or more one-answer text questions where the right answer is the longest in most of them.
- **Name answers by what they say, not where they sit.** The player shuffles options and a match's right column, so "the second statement" or "option B" can point at the wrong one. Write "the nurses' statement" or "the many-causes explanation" instead. The checker rejects position words in explanations, hints, feedback, and outcomes.
- **Every question kata gets an `explanation`** of why the right answer is right, in 30 words or fewer; aim for about 25, since the checker counts every word (the checker enforces it). It shows under the answers after every right answer (a right answer is often a lucky guess, and this is what turns it into knowledge) and once a missed answer is revealed, so apply the idea to this question; don't restate the concept the learner just read. Lead with the reason, not with praise or "Correct". On a `scenario` the learner sees where their pick led first, and the explanation with the other outcomes when they ask. The hook's explanation is the answer in one line (see the shape above). For a calculation, put each worked step on its own line (a `\n` between lines), after an optional one-line lead: `"Each year's interest joins the balance.\nYear 1: $1,000 × 1.05 = $1,050\nYear 2: $1,050 × 1.05 = $1,102.50"`.
- **Blanks:** add a `mistakes` entry for each decoy chip, explaining it.
- **Hints** (optional) nudge without giving the answer away, in one short line; the player shows the hint after a miss, before the retry, or sooner if the learner presses Hint: "What is the one thing this page exists to help people do?" How many there are, and how much they give away, follows the level: most questions for beginners, one or two for advanced learners.
- **Scenario outcomes** describe what happens next, so even a poor choice teaches something.

### Flat or alive

The checker catches what can be counted. These it can't: each pair is the same kata written flat and written so it lands.

- **Hook.** Flat: "What is compound interest?" (a definition to guess blind). Alive: "You invest $1,000 at 10% a year. About how much is it after 7 years?", with $1,700 among the options (a number most people reach by reasoning, and it's wrong).
- **First concept.** Flat: opens "**Compound interest** is interest calculated on…" and never mentions the hook. Alive: "$1,700 counts $100 a year. But year 2 pays 10% of $1,100, not of $1,000…" (the learner's own guess, taken apart).
- **Question.** Flat: "Which of these describes a confounder?" straight after a concept that defines one (rereading answers it). Alive: "Towns with more firefighters have more fire damage. What's the likeliest reason?" (a new case the rule decides).
- **Wrong option.** Flat: "Firefighters are bad at their jobs" (nobody picks it). Alive: "Firefighters cause damage with water and axes" (the reversed cause people really reach for).
- **Feedback.** Flat: "Not quite. Think about the third variable." Alive: "That reads the arrow backwards: big fires bring more firefighters, not the other way round."
- **Explanation.** Flat: "Correct! A confounder affects both variables." (the concept again). Alive: "Fire size drives both: big fires need more firefighters and do more damage."

## 5. Writing style

- Prompts: 40 words at most, one clear task. Questions end with a question mark.
- Plain, friendly, specific language. Short sentences. No filler ("In this lesson we will…").
- Rich text supports `**bold**`, `*italic*`, `` `code` ``, and inline formulas `\( ... \)`. A `$` is always a plain dollar sign.
- A concept's `body` can also have paragraphs (one per line) and a short list: two to four lines starting with `- `, or `1. `, `2. `… for steps in order. Use a list for a few parallel items, like named cases with their one-line definitions; keep the reasoning in sentences. Nowhere else takes a list, and no lesson text takes headings, links, images, tables, or code blocks: the title is the heading, and a table or code goes in a visual.
- **Code goes in backticks, wherever it appears:** commands (`` `git push` ``), flags, file names, paths, identifiers, HTML tags, and values, in prompts, options, match pairs, sort and order items, blank chips, feedback, and explanations alike. The player then shows it in monospace; without the backticks it reads as plain prose, and the checker rejects it. An item that is only code (a match pair's `` `git pull` ``) renders as code without an extra box.
- In formulas, name a quantity before its symbol ("the interest rate, `\( r \)`"), use `\times` or `\cdot` (never `*`) and `\frac`, and follow the lesson language's decimal mark (`3{,}5` in TeX).
- Don't reveal the answer in the prompt or the concept kata's wording.

## 6. Visuals

The right visual makes a lesson feel real. Lessons about people, what they say and how they come across (dating, interviews, feedback, sales, support, a language), have visuals too: the exchange itself, as a `chat`. A visual earns its place when the learner sees the point in it faster than they could read it: a shape, a position, a trend, a contrast. A table or a card of sentences is text in a box: if getting the point means reading every cell, put it in the body or ask it as a question. No visual is better than one that's really text. Pick the kind that shows the idea: where things happened is a map, how much is a chart, how atoms join is a molecule, what leads to what is a diagram, what something looks like is HTML. A table belongs in a lesson only when the learner will look things up in it, like a verb's endings.

`reference/visuals.md` has all twelve kinds (`chart`, `numberline`, `fraction`, `clock`, `diagram`, `chess`, `map`, `molecule`, `chat`, `html`, `code`, `math`), how to write each, and the UI kit for HTML visuals. Read it before choosing one: the player draws charts, diagrams, maps, boards, molecules, and chats for you, so never draw those by hand in HTML or SVG.

## 7. Languages

- Write all learner-facing text in the lesson's `language` (a BCP 47 code such as `en`, `es`, `ar`, `pt-BR`).
- **Language-learning lessons:** `language` is the language you're teaching _in_ and `targetLanguage` is the one being learned, with a region when the variety matters (`es-MX`, `pt-PT`). Mark every phrase in the target language with `lang`: on options, `order` and `sort` items, `sort` group labels, `blank` katas, and `leftLang` / `rightLang` on `match` pairs. Keep each chip in one language. For beginners in a non-Latin script, add a romanisation the first time a word appears, e.g. こんにちは (konnichiwa), except in a kata that tests reading it.
- **Never translate code**, identifiers, or program output, whatever the lesson's language.

## 8. Accuracy

- **Work every answer yourself, step by step, before writing the options.** Then check each wrong option: is it really wrong, and does it come from the slip its feedback names?
- **Many things have more than one right answer.** If a variant is acceptable (another phrasing, another order, another regional form), accept it (`accept`, `alsoAccept`) or say which one the lesson teaches.
- **State what the answer depends on** in the prompt: rounding, units, assumptions ("to the nearest dollar", "if the rate stays the same"), so exactly one option is right.
- **Use what people really say and do today**, not textbook versions nobody uses, unless that's the point of the lesson.
- **Get the details right:** notation, units, accents, capitalisation, punctuation.

## 9. v1 limits

- No `number` katas. Ask numeric questions as `choice` with 3–4 options built from common slips (wrong formula, one step short, wrong unit), each with feedback.
- Every `blank` has `choices` (word chips); there's no free typing yet.
- No images, audio, or free-text answers.

## 10. Play it back

After writing, play the lesson once as a learner and run these tests. Each has a pass or fail answer; a general "is it good?" read finds nothing.

1. **The hook.** Would someone at this level have a gut answer and a reason for it? Is the answer most would pick the wrong idea from your plan? Does it ask the lesson's central idea? Does its `explanation` say what's true in one line?
2. **The turn.** Does the first concept take the hook's case and show why the tempting answer fails?
3. **Cover the concepts.** For each question, read only the prompt and the options, as someone who skipped every concept. If wording, length, or common sense gives the answer, rewrite it. If rereading the concept gives it word for word, ask about a new case.
4. **Every wrong option.** Would a real learner pick it, and does its `feedback` name the slip that leads there?
5. **Every explanation.** Does it give the reason for this case, in words the lesson has taught, without restating the concept?
6. **The challenge.** Is it a case the lesson hasn't shown, and would the wrong idea from your plan still choose a wrong option?
7. **Taught before tested.** Is every term, fact, and method a question needs in an earlier concept kata, not only in feedback, a hint, or an explanation?
8. **The facts.** Check every number, name, date, and quote against the source or what you know to be established, and work every answer again from the question alone.
9. **The level.** Run the "You've drifted if…" check in `levels/{level}.md`, and cut any concept sentence that re-teaches what the summary says the learner knows.

Fix what failed, then rewrite the flattest kata that's left: the one a learner would tap through without thinking. One pass is enough; then run `validate` and fix every issue. The messages say exactly what to change.
