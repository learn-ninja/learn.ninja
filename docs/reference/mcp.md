---
title: Connect an MCP client
description: Make lessons from Claude, ChatGPT, Cursor, VS Code, and any other app that speaks MCP, with no install.
---

Apps that can't run the skill's commands, like Claude.ai or ChatGPT, can still make lessons: learn.ninja is also an [MCP](https://modelcontextprotocol.io) server. Add it once, then ask for a lesson the way you would in any chat. There's nothing to install and no account to make.

```text
https://learn.ninja/mcp
```

## MCP tools

The server has five tools. The guide comes from the same files the skill uses, so both ways make the same lessons.

| Tool              | What it does                                                                                                                                 |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `get_guide`       | Returns the whole guide in one call: the steps, planning, teaching, the lesson format, and levels. The JSON Schema is a separate section     |
| `validate_lesson` | Checks a lesson with the rules publishing uses and lists every issue, without publishing it                                                  |
| `publish_lesson`  | Checks and publishes a lesson, and returns its link, an edit token, and a link that keeps it. A lesson that fails the checks isn't published |
| `update_lesson`   | Replaces a published lesson at the same link, with the edit token from publishing (or none, for a lesson in your account on your own URL)    |
| `keep_lesson`     | Saves a published lesson to an account with an email code, given the edit token; without an email, returns a keep link to paste instead      |

Writing out the lesson is the slow part of a chat, so the model sends it only once. When a check fails, the tools return the issues and a `draftId`, and the model sends small `patches` against that draft instead of the whole lesson again; `update_lesson` takes patches against the published lesson too. A patch is `set`, `insert`, or `remove` at a path like `bricks[2].options[0].feedback`, the same paths the checker reports. Drafts last a day.

Lessons made this way last 7 days; the agent says so once, after the link. To keep one, tell the app you want to keep it, give the agent your email, then the six-digit code it sends you: `keep_lesson` checks the code on learn.ninja, saves the lesson to that account (making the account if it's new), and lists it in Explore under your handle (see [Keep a lesson](/docs/keep)). The code is spent on the spot, and nothing that could sign in as you is left in the chat. It works as long as the chat still has the lesson's edit token, not only right after publishing. The [limits](/docs/reference/api#limits) are the same as the API's.

## Connect with your account

If you make lessons often, connect your own URL instead, and every lesson the chat app publishes is saved to your account from the start: no code, nothing to keep. Open [learn.ninja/settings](https://learn.ninja/settings), find **Connect a chat app**, and choose **Make my URL**. It looks like this, and you paste it wherever the instructions below say `https://learn.ninja/mcp`:

```text
https://learn.ninja/mcp/learn_mcp_…
```

Lessons published through it start **unlisted**, so a half-finished draft doesn't land in Explore under your name; the agent says "Saved to @handle; list it in Explore at learn.ninja/settings", and the switch is under **Your lessons**. `update_lesson` needs no edit token for a lesson in your account, so "edit https://learn.ninja/l/…" works in a new chat, and `keep_lesson` moves a lesson published anonymously elsewhere into the account when given its edit token.

**The URL is a secret.** The key at its end stands for your account: anyone who has it can publish and edit lessons as you, from any app, until you rotate or revoke it. It's shown once when made (copy it then); afterwards the settings show only its start and when it was last used. It can leak through a screenshot of your connector settings, a shared config file like `mcp.json`, or a request log on a proxy between the app and learn.ninja, so treat it like a password, and rotate it from the settings if in doubt. The key is scoped: sent anywhere but its own URL (as an `x-api-key` header, to the account API, or to the sign-in routes) it's refused, so it can't change your handle, read your email, make other keys, or sign you in on the website. The public `https://learn.ninja/mcp` stays open to everyone, with no account.

## Connect your app

### Claude Code

```bash
claude mcp add --transport http learn https://learn.ninja/mcp
```

### Claude.ai and Claude Desktop

1. Open **Settings → Connectors** and choose **Add custom connector**.
2. Name it `learn` and paste `https://learn.ninja/mcp` as the URL.
3. In a chat, turn the connector on from the tools menu if it isn't already.

The Free plan allows one custom connector.

### Cursor

[Add learn.ninja to Cursor](cursor://anysphere.cursor-deeplink/mcp/install?name=learn&config=eyJ1cmwiOiJodHRwczovL2xlYXJuLm5pbmphL21jcCJ9), or add it to `~/.cursor/mcp.json` yourself:

```json
{
  "mcpServers": {
    "learn": { "url": "https://learn.ninja/mcp" }
  }
}
```

### VS Code

[Add learn.ninja to VS Code](vscode:mcp/install?%7B%22name%22%3A%22learn%22%2C%22type%22%3A%22http%22%2C%22url%22%3A%22https%3A%2F%2Flearn.ninja%2Fmcp%22%7D), or run **MCP: Add Server** from the Command Palette, choose **HTTP**, and paste the URL.

### Gemini CLI

Add the server to `~/.gemini/settings.json`. Use `httpUrl`, not `url`: in Gemini CLI, `url` means the older SSE transport.

```json
{
  "mcpServers": {
    "learn": { "httpUrl": "https://learn.ninja/mcp" }
  }
}
```

### ChatGPT

Where ChatGPT lets you add an MCP connector (which plans can, and where the setting lives, change over time), add one with the URL `https://learn.ninja/mcp` and no authentication.

### Other apps

Any client that supports Streamable HTTP can connect to the URL directly. For one that only runs local (stdio) servers, bridge it with [`mcp-remote`](https://www.npmjs.com/package/mcp-remote):

```json
{
  "mcpServers": {
    "learn": {
      "command": "npx",
      "args": ["-y", "mcp-remote", "https://learn.ninja/mcp"]
    }
  }
}
```

## Skill or MCP?

Use the [skill](/docs#install) when your agent has a terminal, as Claude Code, Codex, and Cursor's agent do. It saves the edit token for each lesson in your project, so later changes update the same link even in a new chat, and one login keeps every lesson from then on. Use MCP everywhere else: chat apps, and agents that can't run commands. Both keep lessons by email code without leaving the chat. Over the public MCP URL, the edit token lives only in the conversation, so ask for changes in the same chat; on [your own URL](#connect-with-your-account), your account is the proof, and any chat can edit your lessons.
