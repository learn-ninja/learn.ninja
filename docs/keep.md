---
title: Keep a lesson
description: Save a lesson to an account so it stops expiring, and list it in Explore. For people and for the agents that do it for them.
---

A lesson is published anonymously and lasts 7 days. **Keeping** it saves it to an account: it stops expiring, it can be listed in [Explore](/explore) under your handle, and every lesson you publish from then on is saved too. There's no password and no form to fill in; an email code is enough, and the agent does the typing.

## Say keep

1. Your agent gives you the link and says the lesson lasts 7 days. Tell it you want to keep the lesson.
2. It asks for your email address and sends a six-digit code there.
3. Give the agent the code. The lesson is saved, and the agent tells you which lessons it kept.

Use the same email every time, so everything lands in one account. If you sign in on learn.ninja with GitHub, that's the email on your GitHub account.

## What the agent runs

The first command sends the code; the second signs in with it. `<skill-folder>` is the folder the skill is installed in.

```bash
node <skill-folder>/scripts/learn.mjs login --email you@example.com
node <skill-folder>/scripts/learn.mjs login --email you@example.com --code 123456
```

Signing in saves an API key for this machine (in `~/.config/learn/credentials`, readable only by you) and keeps every lesson published from the current folder that still has a claim token. From then on `publish` sends the key: new lessons belong to the account from the start and never expire, and the agent stops offering to keep them. `whoami` prints the signed-in email and handle; `logout` forgets the key and revokes it. The [CLI reference](/docs/reference/cli#login) has the details.

Rules for agents, from the skill's own steps:

- Offer to keep a lesson once, in one sentence after the link, and don't bring it up again.
- Run `login` only when the user asks to keep a lesson. Never sign them in on your own.
- Don't paste the keep link into the chat unless the user asks for it.
- Never send the user to look in `.learn/` or in the credentials file.
- Codes work for 5 minutes and three tries. If one fails, ask for the email again and send a new code.

## Keep from the browser

Publishing also returns a keep link, `https://learn.ninja/keep/…`. Opening it signs you in, with GitHub or an email code, and one button saves that lesson. Each keep link works once. This is the way to keep a lesson in an account you already use on the website, without signing in from the terminal.

## Show it in Explore

A kept lesson is listed straight away: it shows in Explore and on your profile at `learn.ninja/u/{handle}`. Pick a handle in [learn.ninja/settings](https://learn.ninja/settings) if you haven't; Explore credits lessons by handle.

To keep a lesson link-only, switch it to **Unlisted** under **Your lessons** in your settings. Switch it back to **Listed** at any time: the link keeps working either way.

## When a lesson can't be kept

- **The claim token is gone.** It's issued once, when a lesson is first published, and saved by the tool next to the edit token. Updating a lesson doesn't issue a new one. If the lesson was published by a tool too old to save it, or the state file was deleted, publish a fresh copy with `publish lesson.json --new` and keep that one; the old link expires on its own.
- **The keep link says "Nothing to keep here".** The lesson was already saved to an account, or it expired first.
- **The lesson expired.** After 7 days it's gone. Ask your agent to make it again, then keep it.
