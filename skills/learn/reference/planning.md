# Planning

Before writing, read the user's input once for four choices: **scope** (one lesson or a path), **size**, **reading age**, and, from its own guide, **level** (`levels/index.md`). Usually the request says enough: decide from what they wrote and what they gave you, and tell them your choices after publishing, with an offer to remake. Then, before any JSON, find the lesson's **turn** (below): it decides the hook, the first concept, the wrong options, and the challenge.

## When to ask first

Ask only when the request is just a topic, with nothing else to go on: no audience, no level or background, no length, and no source material. "How vaccines work", "the Roman Empire", and "teach me budgeting" are just topics; "teach me" and "make a lesson on" only say that a lesson is wanted.

Then, before writing, ask up to two questions, each with the default you'd use.

**If you have a tool that asks the user to pick from options** (Claude's `ask_user_input` or `AskUserQuestion`, or a similar tool in other agents), use it so they can answer with a click instead of typing: one question per item, the default as the first option, marked "(default)". Who it's for: "Me", "A child", "A group". How long: "Standard (5–10 min)", "Quick (3–5 min)", "In depth (10–15 min)". Put the big-topic line below in the question's text or in your message.

**Otherwise**, send one short message so the user can answer in a few words or just say "go":

> Before I make it:
> 1. Who's it for: you, a child (what age?), or a group? (I'll assume you.)
> 2. How long: quick (3–5 min), standard (5–10), or in depth (10–15)? (I'll assume standard.)

If the topic holds several ideas (a whole period of history, a field, a long framework), add one line after the questions: "It's a big topic, so I'll make one lesson on its central idea; say if you'd rather have a short series."

- Ask who it's for, never "what's your level?": people rate their own level poorly, but they know who the lesson is for. If they say what they already know, use it for the level.
- Ask once. Anything the reply leaves open takes its default; "A child" with no age means about 8. If there's no one to answer, use the defaults without asking.
- Map the answers with the table below: "for me" is an adult reader, the length is the size, and "a series" is a path. Saying "go" gives the same lesson as not asking.
- One clear signal is enough to go without asking. "A quick one on vaccines" says how long; "quiz my 8-year-old on vaccines" says who. Fill the rest with defaults.

## Words people use

What people say, and what it sets. These are examples, not a closed list: read for the same meaning in other words and other languages.

| They say | It means | Sets |
| --- | --- | --- |
| quick, quick one, brief, short, in 5 minutes, TL;DR | They want it short | size `short` |
| deep dive, in depth, thorough, everything about, comprehensive, master | They want depth | size `long`, or a path if it's several ideas |
| refresher, brush up, remind me, review, revisit, I already know, I've used | They've met it before | level at least `intermediate`; often size `short` |
| basics, from scratch, 101, for beginners, I've never, in simple terms, ELI5, for a non-expert | They're new to it | level `beginner` |
| advanced, for experts, for senior …, terms of art from the field | They know the field | level `advanced` |
| my kid, my son, my daughter, for kids, a 9-year-old, third grade, my class | A child will read it | reading age `child` |


## Scope: one lesson or a path

A lesson teaches **one core idea**. Find it: the idea everything else in the input depends on.

- **One lesson** when the input is one idea, even one with several parts (a method and its exception, a rule and when it breaks).
- **A path** when the input holds several ideas that each deserve teaching and don't fit one long lesson: a list of principles (the SOLID principles, the 12 principles of animation), a long reference page with separate topics, a course outline, a whole field ("Italian", "statistics").
- If the user asks for one lesson on something big, make one lesson on its central idea and mention the rest as follow-ups.

Stay faithful to the source. If the input is an article, teach what it says; don't add claims it doesn't support.

## The turn

A lesson is remembered when it overturns something the learner believed. Before writing any JSON, write three lines for yourself (they're your plan, not part of the lesson file):

1. **The idea**, in one sentence the learner could say afterwards: "Interest earns interest, so growth speeds up."
2. **The wrong idea**: what someone at this level believes, or would guess, before the lesson, in their own words: "10% a year for 7 years is 70%." It has to be something people really think, and it should feel reasonable; a silly belief nobody holds overturns nothing. Look where wrong options come from: a rule carried over from where it doesn't apply, two neighbours mixed up, a step skipped, the everyday meaning of a word the field uses differently.
3. **The case**: one concrete situation where the idea and the wrong idea give different answers: "$1,000 at 10% for 7 years: about $1,700, or about $1,950?"

Then build on them:

- The **hook** asks the case, with the wrong idea among its options.
- The **first concept** takes the same case and shows why the wrong idea fails.
- **Wrong options** through the lesson come from the wrong idea and its neighbours, each with feedback that names it.
- The **challenge** is a new case where the wrong idea is tempting again.
- One **takeaway** answers the hook in the lesson's new terms.

Finding the wrong idea is the hardest part of the lesson and the one most worth your time. Don't settle for the first that comes to mind: list two or three things a newcomer would get wrong here, and pick the one the idea most directly corrects. If the source names a common mistake, use that.

Some lessons have no belief to overturn: a set of phrases, the steps of a procedure, a list of names. Then plan around the **key exercise** instead: the one thing the learner should be able to do at the end ("greet someone at 9 a.m. in Madrid"). The hook asks for a first try at it that everyday sense can reason about, and the challenge is that exercise done properly in a new setting.

## Size

Pick the size from how much the input covers, not from the level. Every size has the same rhythm: each concept kata is followed by 2–4 question katas.

| Size | When | Shape | `estimatedMinutes` |
| --- | --- | --- | --- |
| `short` | One term, rule, or fact; a refresher; the user asks for something quick | 1 concept × 3–4 questions | 3–5 |
| `standard` | One idea with two or three parts. **The default.** | 2–3 concepts × 2–4 (at most 8 questions) | 5–10 |
| `long` | One idea with four parts that only make sense together, or the user asks for depth | 4 concepts × 2–3 (at most 12) | 10–15 |

The checker's hard limits hold for every size: 1–4 concept katas, 2–4 question katas after each, 3–12 question katas in total, at most 20 katas in `katas`, 3–15 minutes. Anything bigger than a long lesson becomes a path. Set `estimatedMinutes` honestly.

## Paths

A path is 2–6 lessons, each a complete lesson of its own, ordered from simple to complex so each one needs only the lessons before it.

1. **Plan the whole path, then write only lesson 1.** Building every lesson up front takes a long time, and learners learn more from spreading lessons over several sessions than from doing them back to back.
2. **Keep a plan file.** Make a folder for the path with `path.md` in it: the path's title, one line on why it's in this order, and each lesson's number, title, its one idea, and its status (the link once published, or "not made yet"). Put each lesson in its own subfolder (`1-visibility/lesson.json`), so each keeps its own `.learn/state.json` and link.
3. **Link the lessons.** Set each lesson's `wrapup.next` to the next lesson's title. A later lesson can't assume the learner remembers an earlier one: if it needs an earlier idea, restate it in a sentence in its first concept kata.
4. **Report the path.** After publishing lesson 1, list the remaining lessons by title and offer to make the next one. When the user asks, read `path.md`, write and publish the next lesson, and update its status.

Each lesson's link expires 7 days after it's published, like any lesson.

## Reading age

Who reads the lesson is separate from how much they know.

- **Adult** is the default.
- **Child** when the user mentions a child or an age under about 13 ("for my kid", "my 7-year-old", "a class of third graders"). Then: beginner level unless they say otherwise; short sentences and everyday words; examples from a child's world (school, games, pets, food, sport); a hook about something the child has seen or done, so the guess is a real one and never a blind pick (young children learn little from guessing at what they can't reason about); no sarcasm, idioms, money, or workplace examples unless the topic is about them; visuals that are bright and simple. Fixed bright colours (`bg-amber-400`, `fill-sky-500`) are fine for filled shapes like pizza slices or counters, since they read on light and dark backgrounds; keep text, outlines, and backgrounds on theme colours (`text-foreground`, `border-border`, `bg-muted`).
- **"Explain like I'm 5", "in simple terms", "for a non-expert"** from an adult mean beginner level for an adult reader: plain words and everyday examples, with no talking down.

## The report line

After publishing, give the three choices in one line, then offer a remake: "Beginner · standard · adult. I can remake it at another level or size, or for a child." For a path, add the lessons still to make.
