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
| `update_lesson`   | Replaces a published lesson at the same link, with the edit token from publishing                                                            |
| `keep_lesson`     | Returns a fresh link that saves a published lesson to an account, given the edit token. The agent calls it when you say you want to keep it  |

Writing out the lesson is the slow part of a chat, so the model sends it only once. When a check fails, the tools return the issues and a `draftId`, and the model sends small `patches` against that draft instead of the whole lesson again; `update_lesson` takes patches against the published lesson too. A patch is `set`, `insert`, or `remove` at a path like `bricks[2].options[0].feedback`, the same paths the checker reports. Drafts last a day.

Lessons made this way last 7 days; the agent says so once, after the link. To keep one, tell the app you want to keep it: it pastes a link, and opening it signs you in on learn.ninja and saves the lesson to your account (see [Keep a lesson](/docs/keep)). The link comes from `keep_lesson`, so it works as long as the chat still has the lesson's edit token, not only right after publishing. The [limits](/docs/reference/api#limits) are the same as the API's.

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

Use the [skill](/docs#install) when your agent has a terminal, as Claude Code, Codex, and Cursor's agent do. It saves the edit token for each lesson in your project, so later changes update the same link even in a new chat, and it keeps lessons by email code without leaving the chat. Use MCP everywhere else: chat apps, and agents that can't run commands. Over MCP, the edit token lives only in the conversation, so ask for changes in the same chat.
