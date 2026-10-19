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

An anonymous lesson lasts 7 days; the tool says so and how to keep it. Once you're signed in (`login`), every lesson you publish is saved to your account and never expires.

The edit token for each published lesson is saved in `.learn/state.json` next to where you run it, along with the claim token that `login` uses to keep it. Don't delete or share that file. The tool adds a `.gitignore` to `.learn/` so none of it gets committed.

Add `--new` to publish a separate copy with a new link:

```bash
node scripts/learn.mjs publish lesson.json --new
```

### `login`

Signs in with a six-digit code sent to your email, then keeps every lesson published from this folder, so they no longer expire. No password, no browser.

```bash
node scripts/learn.mjs login
```

At a terminal it asks for the email and the code. From an agent's shell, which can't ask, give the email first; it sends the code and says to run again with it:

```bash
node scripts/learn.mjs login --email you@example.com
node scripts/learn.mjs login --email you@example.com --code 123456
```

Codes work for 5 minutes and three tries. The tool saves an API key for this machine in `~/.config/learn/credentials` (readable only by you; `$XDG_CONFIG_HOME/learn/credentials` if that's set). From then on, `publish` sends the key and lessons are saved to your account. You can also set `LEARN_API_KEY` instead, with a key made at [learn.ninja/settings](https://learn.ninja/settings).

### `logout`

Forgets the saved key and revokes it on the server. Lessons already saved to your account stay there.

```bash
node scripts/learn.mjs logout
```

### `whoami`

Prints the signed-in email and handle, or says to sign in.

```bash
node scripts/learn.mjs whoami
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
