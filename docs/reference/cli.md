---
title: CLI
description: The learn command the skill uses to check and publish lessons.
---

The skill ships with a small command-line tool, `scripts/learn.mjs`, in the skill's folder. Your agent runs it for you. It needs Node.js 18 or newer and nothing else.

```bash
node <skill-folder>/scripts/learn.mjs <command>
```

## Commands

### `sync`

Downloads the current steps, guides, and schema from learn.ninja into `.learn/skill/` in the current folder. The agent runs it before each lesson, so a change on learn.ninja reaches every install without reinstalling. It downloads only when something changed, and only text: the tool itself never updates this way.

```bash
node scripts/learn.mjs sync
```

If learn.ninja can't be reached, it names the copy to use instead: the last sync's, or the one that came with the install. If the installed tool is too old for the current guides, it prints the install command to run first.

### `validate`

Checks a lesson against the [lesson format](/docs/lessons/lesson-format) and prints every issue, with the path to the field.

```bash
node scripts/learn.mjs validate lesson.json
```

The check runs on learn.ninja with the same rules as publishing, so it's always current. The lesson is sent to the server and not stored. Offline, the check falls back to the rules that came with the install and says so.

### `publish`

Checks the lesson, then publishes it and prints the link. If this lesson was published before from the same folder, it updates the same link instead.

```bash
node scripts/learn.mjs publish lesson.json
```

The edit token for each published lesson is saved in `.learn/state.json` next to where you run it. Don't delete or share that file. The tool adds a `.gitignore` to `.learn/` so none of it gets committed.

Add `--new` to publish a separate copy with a new link:

```bash
node scripts/learn.mjs publish lesson.json --new
```

### `schema`

Prints the path to the lesson JSON Schema: the synced copy in `.learn/skill/` when there is one, otherwise the one bundled with the skill.

```bash
node scripts/learn.mjs schema
```

## Command options

| Option        | Description                                                                                    |
| ------------- | ---------------------------------------------------------------------------------------------- |
| `--json`      | Print machine-readable JSON instead of text                                                    |
| `--api <url>` | Use another server for every command. Defaults to `$LEARN_API_URL`, then `https://learn.ninja` |
| `--version`   | Print the skill version                                                                        |
| `--help`      | Print the help text                                                                            |
