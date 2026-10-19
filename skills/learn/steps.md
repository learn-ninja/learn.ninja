# Learn: the steps

You write one lesson as a JSON file that follows the lesson spec (v0.5), check it, and publish it. The learner opens the link and plays it: short bricks, instant feedback, Duolingo/Brilliant style. Links expire after 24 hours.

Every path below is relative to the folder this file is in (`.learn/skill/` after a sync, or the installed skill's folder). `<skill-folder>` is the installed skill's folder, the one `SKILL.md` is in; the commands run from there.

## Steps

1. **Plan the lesson.** Read what the user gave you, then read `reference/planning.md`. It sets the scope (one lesson, or a path of several), the size, and the reading age, and lists the words people use for each choice. Usually decide without asking, and say what you decided at the end. Only when the request is just a bare topic ("how vaccines work") ask first: one short message with up to two questions and your defaults, as `reference/planning.md` describes.
2. **Read the guides before writing.** Read `reference/teaching-guide.md` (how to teach well, which brick to use when, visuals) and `reference/lesson-format.md` (every field). Then:
   - **Level:** read `levels/index.md`, pick the level from its ranked signals, and read that level's file: it says what to assume, how hard to make the questions, and how much to help.

   Level guides add to this file and the teaching guide; where one disagrees, this file and the teaching guide win. Design the lesson for its topic from the guides; don't look for a lesson to copy.

3. **Write the lesson file**, e.g. `lesson.json` in the current folder, following the format exactly. `schema/lesson.schema.json` is the formal JSON Schema. For a path, write only the first lesson, in its own folder, as `reference/planning.md` describes.
4. **Check it** and fix every issue it reports, then check again until it passes:
   ```bash
   node <skill-folder>/scripts/learn.mjs validate lesson.json
   ```
   It checks on learn.ninja with the current rules (nothing is stored). Offline, it falls back to the rules bundled with the install and says so.
5. **Publish it:**
   ```bash
   node <skill-folder>/scripts/learn.mjs publish lesson.json
   ```
   Publishing needs network access.
6. **Tell the user** the link and that it expires in 24 hours. Then, in one line, the three choices you made: level, size, and reading age (e.g. "Beginner · standard · adult"), and that you can remake it with any of them changed. For a path, list the lessons still to make and offer to make the next one; make it only when the user asks. To change a lesson, edit the same file and run `publish` again: it updates the same link (the edit token is saved in `.learn/state.json`; don't delete or share that file). Use `publish lesson.json --new` only if the user wants a separate copy with a new link.

If a command prints that a newer version of the skill is available, tell the user the update command it shows.

## Rules that matter most

- **Accuracy over flourish.** Teach only what's true and supported by the user's input or well-established knowledge. Don't invent statistics, quotes, studies, or examples presented as real. Work every answer yourself before writing the options.
- **One idea, interleaved.** Hook (a guess before any teaching) → `bricks`: 1–4 short `concept` bricks, each followed right away by 2–4 question bricks that practise it (the size sets how many concepts; `reference/planning.md`) → one harder challenge → 2–4 takeaways.
- **Level changes content; size changes length.** The level file sets what the learner already knows, what the questions demand, how tempting the wrong options are, and how many hints there are. The size sets how many concepts there are. Neither changes the checker's limits.
- **Bricks fit the content.** Pick each question brick's type by asking how a good teacher would test that point, not to fill a quota. Repeating a type is fine; a forced `order` or `match` isn't.
- **Teach before you test.** Every term, fact, or method a question or the challenge needs appears first in a concept brick: its body or visual. Feedback, hints, and explanations explain the answer but never introduce anything new, because a learner who answers right may never see them.
- **Every wrong option teaches.** Each wrong option needs `feedback` that explains the misconception, and every question brick needs an `explanation`. Build wrong options from real, common mistakes. Name an option by what it says, never by its place ("the second statement", "option B"): the player shuffles options, and the checker rejects it.
- **v1 limits:** no `number` bricks (ask numeric questions as `choice` with mistake-based options), every `blank` uses word chips (`choices`), no images or photos, no typed answers.
- **Visuals are plain HTML with the built-in UI kit** (Basecoat classes and Tailwind utilities). No scripts, event handlers, iframes, forms, or external URLs; the checker rejects them.
- **Language:** write all learner-facing text in the lesson's `language`. Never translate code.

## Files

- `reference/planning.md`: scope, size, paths of several lessons, and reading age
- `reference/teaching-guide.md`: how to design the lesson, choose bricks, write feedback, and build visuals
- `reference/lesson-format.md`: every field of the lesson file, with short examples
- `levels/index.md`: how to pick the lesson's level; `levels/{level}.md` is each level's guide
- `schema/lesson.schema.json`: the formal JSON Schema (the checker also enforces cross-field rules it can't express)
- `<skill-folder>/scripts/learn.mjs`: the checker and publisher (`sync`, `validate`, `publish`, `schema`; add `--json` for machine-readable output)
