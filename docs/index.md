---
title: Introduction
description: learn.ninja turns anything you give your agent into one short, interactive lesson, published as a link.
---

learn.ninja is a skill for AI agents. The agent turns a topic, an article, notes, docs, a transcript, or code into one short lesson: usually 5 to 10 minutes of small interactive screens called **bricks**, with feedback on every answer. It checks the lesson and publishes it to a link like `https://learn.ninja/l/how-compound-interest-works-k3x9a2mq`, which anyone can open in a browser. Free, no account. Links last 7 days, or for good once you [keep them](/docs/keep) in an account: say so, and your agent signs you in with an email code. Kept lessons are listed in [Explore](/explore), credited to you; unlist any of them from your settings.

## Install

```bash
npx skills add https://learn.ninja -g
```

Works with any agent that supports [skills](https://github.com/vercel-labs/skills): Claude Code, Codex, Cursor, Gemini CLI, GitHub Copilot, Windsurf, Cline, Roo Code, Kiro, Goose, Amp, OpenCode, Antigravity, Junie, and more. To install for one agent without being asked, name it and skip the prompts:

```bash
npx skills add https://learn.ninja -g -a claude-code -y
```

The agent names are `claude-code`, `codex`, `cursor`, `gemini-cli`, `github-copilot`, `windsurf`, `cline`, `roo`, `kiro-cli`, `goose`, `amp`, `opencode`, `antigravity`, and `junie` (the [full list](https://github.com/vercel-labs/skills#supported-agents)). Leave out `-g` to install only in the current project. Needs Node.js 18 or newer and network access.

You install once. The guides and the checks come from learn.ninja each time the agent makes a lesson, so changes reach you without reinstalling. The agent only asks you to run the install command again when the small command-line tool itself changes.

## If you're an agent

1. Install the skill with the command above.
2. Read its `SKILL.md`. It has you run `sync`, which downloads the current steps and guides into `.learn/skill/`, then follow `steps.md` there: the teaching guide, the [lesson format](/docs/lessons/lesson-format), and the [level](/docs/lessons/levels) the lesson is for.
3. Write the lesson, run `validate` until it passes, then `publish`, and give the user the link. To change the lesson, edit the same file and publish again: the link stays the same.

## Without a shell

An agent that can't run commands (a chat app, or an agent on a locked-down host) can skip the skill:

- **Connect the MCP server** at `https://learn.ninja/mcp` ([how, for each app](/docs/reference/mcp)). Its `get_guide` tool returns the same steps and guides the skill follows, and `publish_lesson` checks and publishes the lesson. This is the way for Claude.ai, Claude Desktop, ChatGPT, and other chat apps.
- **Or call the API** directly:
  1. Read the [lesson format](/docs/lessons/lesson-format.md) and the [JSON Schema](/schema/lesson.schema.json).
  2. Write the lesson as JSON.
  3. Publish it with the [API](/docs/reference/api): `POST https://learn.ninja/api/lessons`. The API runs the same checks as the skill and lists every issue, so fix them and post again.

## Plain text

Everything here is also plain text. Requests that don't ask for HTML get Markdown back, so `curl https://learn.ninja/docs` returns this page.

| URL                                                                | What it is                                                  |
| ------------------------------------------------------------------ | ----------------------------------------------------------- |
| [`/llms.txt`](/llms.txt)                                           | A short guide to learn.ninja, with links to every docs page |
| [`/llms-full.txt`](/llms-full.txt)                                 | Every docs page in one file                                 |
| `/docs/{page}.md`                                                  | Any docs page as Markdown                                   |
| [`/.well-known/skills/index.json`](/.well-known/skills/index.json) | The skill, for `npx skills add https://learn.ninja`         |
| [`/schema/lesson.schema.json`](/schema/lesson.schema.json)         | The lesson JSON Schema                                      |
