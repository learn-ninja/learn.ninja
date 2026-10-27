---
title: Keep a lesson
description: Save a lesson to an account so it stops expiring, and publish it to Explore when it's ready. For people and for the agents that do it for them.
---

A lesson is published anonymously and lasts 7 days. **Keeping** it saves it to an account: it stops expiring, you can publish it to [Explore](/explore) under your handle when it's ready, and every lesson you publish from then on is saved too. There's no password: you log in once, with GitHub or an email code.

## Say keep

1. Your agent gives you the link and says the lesson lasts 7 days. Tell it you want to keep the lesson.
2. In a chat app connected over [MCP](/docs/reference/mcp) (Claude.ai, ChatGPT…), the app shows a log-in prompt in the conversation. It opens learn.ninja: log in with GitHub or an email code, allow the app to publish lessons to your account, and you're back in the chat. The app stays logged in, so this happens once.
3. The agent tells you where the lesson stands: saved to @handle, and private until you publish it. Every lesson that app publishes from now on is saved as it's published.

In a terminal, the agent logs you in with an email code instead: it asks for your address, sends a six-digit code, and you give it the code. Use the same email every time, so everything lands in one account. If you log in on learn.ninja with GitHub, that's the email on your GitHub account. Change your email, or connect GitHub to an account you made with a code, in [learn.ninja/settings](https://learn.ninja/settings).

## What the agent runs

The first command sends the code; the second logs in with it. `<skill-folder>` is the folder the skill is installed in.

```bash
node <skill-folder>/scripts/learn.mjs login --email you@example.com
node <skill-folder>/scripts/learn.mjs login --email you@example.com --code 123456
```

Logging in saves an API key for this machine (in `~/.config/learn/credentials`, readable only by you) and keeps every lesson published from the current folder. From then on `publish` sends the key: new lessons belong to the account from the start, never expire, and start private, and the agent stops offering to keep them. Already logged in, in a folder the login didn't cover? `keep` saves that folder's lessons without a new code. `whoami` prints the logged-in email and handle; `logout` forgets the key and revokes it. The [CLI reference](/docs/reference/cli#login) has the details.

Over MCP, the one call is `keep_lesson` with the lesson's `id` and its `editToken`. The server refuses it until the app has logged you in (a standard OAuth log-in, which the app runs itself), then the app retries it. No email or code passes through the chat.

Rules for agents, from the skill's own steps:

- Offer to keep a lesson once, in one sentence after the link, and don't bring it up again.
- In a terminal, send a code only when the user asks to keep a lesson, to the address they give. Never sign them in on your own, and never guess the address. Codes work for 5 minutes and three tries; if one fails, ask for the email again and send a new code.
- Over MCP, just call `keep_lesson`; the app handles the log-in.
- Don't paste the keep link into the chat unless the user asks for one, or would rather not log in from the app.
- Never send the user to look in `.learn/` or in the credentials file.

## Keep from the browser

Publishing also returns a keep link, `https://learn.ninja/keep/…`. Opening it logs you in, with GitHub or an email code, saves that lesson to your account, and opens it. Each keep link works once. This is the way to keep a lesson without logging in from the chat app at all.

## Publish it to Explore

Every lesson starts private: only people with the link can open it, and it's not in Explore or search results. When it's ready, publish it from **Your lessons** on your profile at `learn.ninja/u/{handle}` (you see that list only on your own): open a lesson's menu and choose **Publish**. It then shows in Explore and on your profile for everyone. **Unpublish** makes it private again; the link keeps working either way.

New accounts get a random handle, like `quiet-kitsune` (GitHub accounts get their GitHub username); change it any time in [learn.ninja/settings](https://learn.ninja/settings).

## When a lesson can't be kept

Keeping needs proof that the lesson is yours: the claim token from publishing, or the edit token, which the tool saves in `.learn/state.json` and a chat app keeps in the conversation. Whoever can rewrite a lesson is its author, so the edit token is enough.

- **The chat is still open** (MCP): say you want to keep the lesson; the agent calls `keep_lesson` with the edit token, and the app logs you in if it hasn't yet.
- **The folder is still there** (skill): `learn login` keeps everything published from it, or `learn keep` if you're already logged in. Lessons published by an older tool that saved no claim token are kept with the edit token.
- **Both are gone.** Nothing can prove the lesson is yours, so it can't be kept; publish a fresh copy with `publish lesson.json --new` and keep that one. The old link expires on its own.
- **The keep link says "Nothing to keep here".** The lesson was already saved to an account, it expired first, or a newer keep link replaced this one.
- **The lesson expired.** After 7 days it's gone. Ask your agent to make it again, then keep it.
