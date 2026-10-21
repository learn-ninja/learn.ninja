---
title: Connect an MCP client
description: Make lessons from Claude, ChatGPT, Cursor, VS Code, and any other app that speaks MCP, with no install.
---

Apps that can't run the skill's commands, like Claude.ai or ChatGPT, can still make lessons: learn.ninja is also an [MCP](https://modelcontextprotocol.io) server. Add it once, then ask for a lesson the way you would in any chat. There's nothing to install and no account to make; when you want to keep a lesson, the app asks you to sign in to learn.ninja, once.

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
| `update_lesson`   | Replaces a published lesson at the same link, with the edit token from publishing (or none, for a lesson in your account once signed in)     |
| `keep_lesson`     | Saves a published lesson to your account, given the edit token. Needs you signed in: the app asks, then retries the call                       |

Writing out the lesson is the slow part of a chat, so the model sends it only once. When a check fails, the tools return the issues and a `draftId`, and the model sends small `patches` against that draft instead of the whole lesson again; `update_lesson` takes patches against the published lesson too. A patch is `set`, `insert`, or `remove` at a path like `bricks[2].options[0].feedback`, the same paths the checker reports. Drafts last a day. When a check passes but the checker tidied something (a tag label it trimmed, say), `validate_lesson`, `publish_lesson`, and `update_lesson` add `notes` to their reply, in the same `{ path, message }` shape as issues, as the [API](/docs/reference/api#publish-a-lesson) does.

Lessons made this way last 7 days; the agent says so once, after the link. The [limits](/docs/reference/api#limits) are the same as the API's.

## Connect with your account

Nothing to set up: the first time you tell the app to keep a lesson, it asks you to sign in to learn.ninja. The server refuses `keep_lesson` from an app that isn't signed in, and apps that speak MCP (Claude.ai, Claude Desktop, Claude Code, ChatGPT) answer that by showing a sign-in prompt in the conversation. It opens learn.ninja in a popup: sign in with GitHub or an email code, allow the app to publish lessons to your account, and the popup closes. The app retries the call on its own, and the lesson is saved and listed in Explore under your handle (see [Keep a lesson](/docs/keep)).

That's a standard OAuth sign-in, and it sticks: the app keeps a token for your account, so in every later chat its lessons are saved as they're published. They start **unlisted**, so a half-finished draft doesn't land in Explore under your name; the agent says "Saved to @handle; list it in Explore at learn.ninja/settings", and the switch is under **Your lessons**. `update_lesson` needs no edit token for a lesson in your account, so "edit https://learn.ninja/l/…" works in a new chat, and `keep_lesson` moves a lesson published anonymously elsewhere into your account when given its edit token.

The token can only publish and keep lessons as you: it can't read your email, change your handle, make API keys, or sign in on the website. Every app that signed in is listed under **Connected apps** at [learn.ninja/settings](https://learn.ninja/settings), with when you allowed it and when it last used the account; **Disconnect** ends its token at once, and learn.ninja asks you to sign in again the next time you keep a lesson from it. If you'd rather not sign in from a chat app at all, ask the agent for the lesson's keep link and open it in your browser.

### Apps that can't sign in

An app that only takes a URL, with no sign-in step, can still publish to your account through a personal URL. Open [learn.ninja/settings](https://learn.ninja/settings), open **Apps that can't sign in** under **Connected apps**, and choose **Make my URL**. It looks like this, and you paste it wherever the instructions below say `https://learn.ninja/mcp`:

```text
https://learn.ninja/mcp/learn_mcp_…
```

**The URL is a secret.** The key at its end stands for your account: anyone who has it can publish and edit lessons as you, from any app, until you rotate or revoke it. It's shown once when made (copy it then); afterwards the settings show only its start and when it was last used. It can leak through a screenshot of your connector settings, a shared config file like `mcp.json`, or a request log on a proxy between the app and learn.ninja, so treat it like a password, and rotate it from the settings if in doubt. The key is scoped like the token: sent anywhere but its own URL it's refused. Prefer signing in whenever the app offers it.

## Connect your app

### Claude Code

```bash
claude mcp add --transport http learn https://learn.ninja/mcp
```

### Claude.ai and Claude Desktop

1. [Open the Add custom connector dialog](https://claude.ai/customize/connectors?modal=add-custom-connector&connectorName=learn.ninja&connectorUrl=https%3A%2F%2Flearn.ninja%2Fmcp) with the name and URL filled in, or go to **Settings → Connectors**, choose **Add custom connector**, name it `learn.ninja`, and paste `https://learn.ninja/mcp` as the URL.
2. Under **Authentication**, pick **Sign in when needed**, not the detected "No sign-in": Claude connects without an account and asks you to sign in the first time you keep a lesson. With "No sign-in", that prompt can't appear, and keeping fails.
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

Where ChatGPT lets you add an MCP connector (which plans can, and where the setting lives, change over time), add one with the URL `https://learn.ninja/mcp` and the authentication choice **OAuth or no authentication**, so lessons work right away and ChatGPT asks you to sign in only when you keep one.

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

Use the [skill](/docs#install) when your agent has a terminal, as Claude Code, Codex, and Cursor's agent do. It saves the edit token for each lesson in your project, so later changes update the same link even in a new chat, and one login (an email code in the terminal) keeps every lesson from then on. Use MCP everywhere else: chat apps, and agents that can't run commands; there, one sign-in in the app does the same. Before you sign in, the edit token lives only in the conversation, so ask for changes in the same chat; [signed in](#connect-with-your-account), your account is the proof, and any chat can edit your lessons.
