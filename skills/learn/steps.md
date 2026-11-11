# Learn: the steps

You write one lesson as a JSON file that follows the lesson spec (v0.9), check it, and publish it. The learner opens the link and plays it: short katas, instant feedback, Duolingo/Brilliant style. Links last 7 days, or for good once the user keeps them in an account (step 8).

There are two ways to follow these steps. In a terminal with the skill installed, run the commands shown; every path below is relative to the folder this file is in (`.learn/skill/` after a sync, or the installed skill's folder), and `<skill-folder>` is the installed skill's folder, the one `SKILL.md` is in. Through the learn.ninja MCP server, there are no files or commands: call the tool named beside each one instead (`publish_lesson`, `update_lesson`). The one `get_guide` call you started with already returned every guide below but the schema, so don't call it again for them.

## Steps

1. **Plan the lesson.** Read what the user gave you, then read `reference/planning.md`. It sets the scope (one lesson, or a path of several), the size, and the reading age, and lists the words people use for each choice. Usually decide without asking, and say what you decided at the end. It also has you find the lesson's turn before you write anything: the idea, the wrong idea a learner arrives with, and a case where the two give different answers. Only when the request is just a bare topic ("how vaccines work") ask first: up to two questions with your defaults, as clickable options when you have a tool for that, as `reference/planning.md` describes.
2. **Read the guides before writing.** Read `reference/teaching-guide.md` (how to teach well, which kata to use when), `reference/visuals.md` (every kind of visual and how to write it), and `reference/lesson-format.md` (every field). Then:
   - **Level:** read `levels/index.md`, pick the level from its ranked signals, and read that level's file: it says what to assume, how hard to make the questions, and how much to help.

   Level guides add to this file and the teaching guide; where one disagrees, this file and the teaching guide win. Design the lesson for its topic from the guides; don't look for a lesson to copy.

3. **Write the lesson file**, e.g. `lesson.json` in the current folder, following the format exactly; over MCP, write it as JSON text to pass to the tools. Pick the `subject` from the format reference's table by what the learner will do afterwards (the "Not this" column settles ties), and write 1–5 `tags` as labels a reader should see (they're stored for browsing, not shown yet): first what you'd file it under, then the product or field if there is one (`"Compound interest"`, `"Investing"`; `"Git"`, `"Claude Code"`), proper nouns as they're written and common nouns in sentence case. `schema/lesson.schema.json` (`get_guide` with `schema`) is the formal JSON Schema, rarely needed. For a path, write only the first lesson, in its own folder, as `reference/planning.md` describes.
4. **Play it back.** Read the lesson once as a learner and run the tests in the teaching guide's last section ("Play it back"): the hook, the turn, each question with the concepts covered, each wrong option, the facts. Fix what fails. One pass.
5. **Check it** and fix every issue it reports, then check again until it passes:
   ```bash
   node <skill-folder>/scripts/learn.mjs validate lesson.json
   ```
   Either way it checks on learn.ninja with the current rules (nothing is stored). Offline, the command falls back to the rules bundled with the install and says so.

   Over MCP, skip this step: `publish_lesson` runs the same checks and publishes nothing if they fail. Writing out the lesson is the slow part, so send the whole lesson only once. When a check fails, the reply has the issues and a `draftId`: call `publish_lesson` again with that `draftId` and `patches` that fix every issue at once (each issue's `path` works as a patch path), never the whole lesson again.
6. **Publish it:**
   ```bash
   node <skill-folder>/scripts/learn.mjs publish lesson.json
   ```
   Over MCP, call `publish_lesson` with the lesson's JSON text as `lesson`. Publishing needs network access.
7. **Tell the user** the link and where the lesson stands, in one sentence, as `publish` printed it (over MCP, from the reply's `owned`, `owner`, and `visibility`):
   - Anonymous: "Published: {url}. It lasts 7 days. Say "keep it" and I'll save it to your learn.ninja account; you'll log in once."
   - Saved to an account (`owner.handle` set; `visibility` public, as every lesson published while logged in or kept starts): "Saved to @{handle} and published in Explore. Unpublish it any time at learn.ninja/u/{handle}." With no handle yet: "Saved to your account and published in Explore."
   - Saved but private (`visibility` unlisted, shown as Private: one the user unpublished): "Saved to @{handle}. It's private: only people with the link can open it. Publish it to Explore at learn.ninja/u/{handle} when you're ready." With no handle yet: "Saved to your account. It's private: only people with the link can open it. Pick a handle at learn.ninja/settings to publish it to Explore."

   Then, in one line, the three choices you made: level, size, and reading age (e.g. "Beginner · standard · adult"), and that you can remake it with any of them changed. End with one question that offers the next lesson: the one in `wrapup.next`, in a few words (e.g. "Want a follow-up on when a link beats a ghost button?"). For a path, list the lessons still to make instead and offer the next one. Make it only when the user asks. To change a lesson, edit the same file and run `publish` again: it updates the same link (the edit token is saved in `.learn/state.json`; don't delete or share that file). Use `publish lesson.json --new` only if the user wants a separate copy with a new link. Over MCP, call `update_lesson` with the `id` and `editToken` that `publish_lesson` returned and `patches` for just what changed (send the whole `lesson` only when most of it changed); it updates the same link. Keep that token to yourself, and call `publish_lesson` again only if the user wants a separate copy.
8. **Keep it, once.** The keep sentence in step 7 is said once per lesson; don't bring it up again, and never paste the keep link (`claimUrl`) into the chat on your own. Only when the user says they want to keep the lesson:

   In the terminal, sign them in with an email code, in two steps. Ask for their email address, then send the code:
   ```bash
   node <skill-folder>/scripts/learn.mjs login --email <address>
   ```
   Then ask for the six-digit code they got, and log in with it:
   ```bash
   node <skill-folder>/scripts/learn.mjs login --email <address> --code <code>
   ```
   Never guess the address. A wrong code fails with `sign_in_failed`: codes work for 5 minutes and three tries, so ask again, or send a new one. The login also saves a key on this machine and keeps every lesson published from this folder; tell the user which ones it kept, as the output says (saved to @handle and published in Explore, as in step 7). From now on, every lesson you publish here is saved to their account and published in Explore, so skip the keep sentence and say the saved sentence instead. Already logged in on this machine, but the lesson was published anonymously (an earlier folder, or before the login)? Run `learn keep`: it saves every lesson published from this folder without a new code. `learn whoami` says who's logged in; `learn logout` forgets the key. Never tell the user to look in `.learn/` or in the credentials file.

   Over MCP, call `keep_lesson` with the lesson's `id` and `editToken`. Nothing to ask for: if the user isn't logged in yet, the chat app itself asks them to (a log-in prompt in the conversation that opens learn.ninja), then retries the call on its own. Tell the user where the lesson stands, as the reply says. From then on the app stays logged in, every lesson you publish is saved to their account as it's published (the reply has an `owner`, and you say the saved sentence instead of the keep sentence), and `update_lesson` needs no `editToken` for their lessons. If the user would rather not log in from this app, give them the lesson's `claimUrl` to open in a browser: it saves that one lesson once they log in there.

If a command prints that a newer version of the skill is available, tell the user the update command it shows.

## Rules that matter most

- **Accuracy over flourish.** Teach only what's true and supported by the user's input or well-established knowledge. Don't invent statistics, quotes, studies, or examples presented as real. Work every answer yourself before writing the options.
- **Build it on one wrong idea.** Before writing, name the idea, the wrong idea a learner at this level arrives with, and a case where they give different answers (`reference/planning.md`). The hook asks that case, the first concept shows why the tempting answer fails, and the challenge tempts it again.
- **One idea, interleaved.** Hook (a guess the learner can reason about, on the lesson's central idea, answered in one line as soon as they commit) → `katas`: 1–4 short `concept` katas, each followed right away by 2–4 question katas that practise it (the size sets how many concepts; `reference/planning.md`) → one harder challenge → 2–4 takeaways.
- **Level changes content; size changes length.** The level file sets what the learner already knows, what the questions demand, how tempting the wrong options are, and how many hints there are. The size sets how many concepts there are. Neither changes the checker's limits.
- **Katas fit the content.** Pick each question kata's type by asking how a good teacher would test that point, not to fill a quota. Repeating a type is fine; a forced `order` or `match` isn't.
- **Teach before you test.** Every term, fact, or method a question or the challenge needs appears first in a concept kata: its body or visual. Only the hook comes before any teaching, so it has to be answerable from what the learner already believes. Feedback and hints explain the answer but never introduce anything new, because a learner who answers right never sees them.
- **Every wrong option teaches.** Each wrong option needs `feedback` that explains the misconception, and every question kata needs an `explanation`. Build wrong options from real, common mistakes. Name an option by what it says, never by its place ("the second statement", "option B"): the player shuffles options, and the checker rejects it.
- **v1 limits:** no `number` katas (ask numeric questions as `choice` with mistake-based options), every `blank` uses word chips (`choices`), no images or photos, no typed answers.
- **Visuals are plain HTML with the built-in UI kit** (Basecoat classes, Tailwind utilities, and icon classes like `icon-[lucide--git-branch]`). No scripts, event handlers, iframes, forms, media or meta tags, external URLs, or heights tied to the screen (`vh`, `h-screen`); the checker rejects them.
- **Language:** write all learner-facing text in the lesson's `language`. Never translate code.

## Files

- `reference/planning.md`: scope, size, paths of several lessons, and reading age
- `reference/teaching-guide.md`: how to design the lesson, choose katas, and write feedback, and the tests to run before publishing
- `reference/visuals.md`: every kind of visual, how to write each, and the UI kit for HTML visuals
- `reference/lesson-format.md`: every field of the lesson file, with short examples
- `levels/index.md`: how to pick the lesson's level; `levels/{level}.md` is each level's guide
- `schema/lesson.schema.json`: the formal JSON Schema (the checker also enforces cross-field rules it can't express)
- `<skill-folder>/scripts/learn.mjs`: the checker and publisher (`sync`, `validate`, `publish`, `login`, `keep`, `logout`, `whoami`, `schema`; add `--json` for machine-readable output)

Over MCP, `get_guide` returns all of these but the schema in one call (`all`, the default); one section at a time is `planning`, `teaching` (with the visuals reference), `format`, `levels` (the index and every level), or `schema`.
