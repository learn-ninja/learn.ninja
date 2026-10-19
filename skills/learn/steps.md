# Learn: the steps

You write one lesson as a JSON file that follows the lesson spec (v0.4), check it, and publish it. The learner opens the link and plays it: short bricks, instant feedback, Duolingo/Brilliant style. Links last 7 days, or for good once the user keeps them in an account (step 7).

There are two ways to follow these steps. In a terminal with the skill installed, run the commands shown; every path below is relative to the folder this file is in (`.learn/skill/` after a sync, or the installed skill's folder), and `<skill-folder>` is the installed skill's folder, the one `SKILL.md` is in. Through the learn.ninja MCP server, there are no files or commands: call the tool named beside each one instead (`publish_lesson`, `update_lesson`). The one `get_guide` call you started with already returned every guide below but the schema, so don't call it again for them.

## Steps

1. **Plan the lesson.** Read what the user gave you, then read `reference/planning.md`. It sets the scope (one lesson, or a path of several), the size, and the reading age, and lists the words people use for each choice. Usually decide without asking, and say what you decided at the end. Only when the request is just a bare topic ("how vaccines work") ask first: up to two questions with your defaults, as clickable options when you have a tool for that, as `reference/planning.md` describes.
2. **Read the guides before writing.** Read `reference/teaching-guide.md` (how to teach well, which brick to use when, visuals) and `reference/lesson-format.md` (every field). Then:
   - **Level:** read `levels/index.md`, pick the level from its ranked signals, and read that level's file: it says what to assume, how hard to make the questions, and how much to help.

   Level guides add to this file and the teaching guide; where one disagrees, this file and the teaching guide win. Design the lesson for its topic from the guides; don't look for a lesson to copy.

3. **Write the lesson file**, e.g. `lesson.json` in the current folder, following the format exactly; over MCP, write it as JSON text to pass to the tools. `schema/lesson.schema.json` (`get_guide` with `schema`) is the formal JSON Schema, rarely needed. For a path, write only the first lesson, in its own folder, as `reference/planning.md` describes.
4. **Check it** and fix every issue it reports, then check again until it passes:
   ```bash
   node <skill-folder>/scripts/learn.mjs validate lesson.json
   ```
   Either way it checks on learn.ninja with the current rules (nothing is stored). Offline, the command falls back to the rules bundled with the install and says so.

   Over MCP, skip this step: `publish_lesson` runs the same checks and publishes nothing if they fail. Writing out the lesson is the slow part, so send the whole lesson only once. When a check fails, the reply has the issues and a `draftId`: call `publish_lesson` again with that `draftId` and `patches` that fix every issue at once (each issue's `path` works as a patch path), never the whole lesson again.
5. **Publish it:**
   ```bash
   node <skill-folder>/scripts/learn.mjs publish lesson.json
   ```
   Over MCP, call `publish_lesson` with the lesson's JSON text as `lesson`. Publishing needs network access.
6. **Tell the user** the link, and how long it lasts, as `publish` printed it: 7 days for an anonymous lesson, or "saved to your account" once they're signed in. Then, in one line, the three choices you made: level, size, and reading age (e.g. "Beginner · standard · adult"), and that you can remake it with any of them changed. For a path, list the lessons still to make and offer to make the next one; make it only when the user asks. To change a lesson, edit the same file and run `publish` again: it updates the same link (the edit token is saved in `.learn/state.json`; don't delete or share that file). Use `publish lesson.json --new` only if the user wants a separate copy with a new link. Over MCP, call `update_lesson` with the `id` and `editToken` that `publish_lesson` returned and `patches` for just what changed (send the whole `lesson` only when most of it changed); it updates the same link. Keep that token to yourself, and call `publish_lesson` again only if the user wants a separate copy.
7. **Offer to keep it, once.** When a lesson is anonymous, add one sentence after the link: "It lasts 7 days. If you'd like to keep it, say so and I'll save it under your email." Say this once per lesson and don't bring it up again. Never paste the keep link (`claimUrl`) into the chat on your own; the user can ask for it. Only when the user says they want to keep it:
   1. Ask for their email address, then run:
      ```bash
      node <skill-folder>/scripts/learn.mjs login --email <address>
      ```
      It emails them a six-digit code.
   2. Ask the user for the code, then run:
      ```bash
      node <skill-folder>/scripts/learn.mjs login --email <address> --code <code>
      ```
      It saves a key on this machine and keeps every lesson published from this folder; tell the user which ones it kept. From now on, every lesson you publish here is saved to their account and never expires, so skip the keep sentence.

   `learn whoami` says who's signed in; `learn logout` forgets the key. Never tell the user to look in `.learn/` or in the credentials file.

   Over MCP there is no login: only when the user says they want to keep it, give them the `claimUrl` from `publish_lesson`. Opening it signs them in on learn.ninja and keeps the lesson. Say "I'll give you a link that saves it" in the keep sentence instead of "under your email".

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
- `<skill-folder>/scripts/learn.mjs`: the checker and publisher (`sync`, `validate`, `publish`, `login`, `logout`, `whoami`, `schema`; add `--json` for machine-readable output)

Over MCP, `get_guide` returns all of these but the schema in one call (`all`, the default); one section at a time is `planning`, `teaching`, `format`, `levels` (the index and every level), or `schema`.
