# Claude Connectors Directory submission

Everything the developer portal (https://claude.ai/directory/manage → **Submit new** → **MCP connector**) asks for, step by step, so the form can be filled in one sitting. Review the copy before pasting; the slug is permanent.

## Before opening the portal

- Production serves the server at `https://learn.ninja/mcp`, with OAuth discovery at `/.well-known/oauth-protected-resource/mcp` and `/.well-known/oauth-authorization-server/api/auth`.
- Set the reviewers' test account in Vercel (Production environment) and redeploy: `REVIEW_SIGN_IN_EMAIL=reviewer@learn.ninja` and `REVIEW_SIGN_IN_CODE=<six digits>`. That address then signs in with the fixed code and gets no email. Sign in once yourself as that address, pick the handle `reviewer`, and keep two or three lessons so the account is populated. Unset both variables when the review is over.
- Have `brand/icon-1024.png` at hand.

## 1. Connection

- Server URL: `https://learn.ninja/mcp`
- Users connect to the same URL (no multiple URLs, no URL pattern).

## 2. Tools

Synced from the server. All five have a title and annotations:

| Tool | Title | Annotations |
| --- | --- | --- |
| `get_guide` | Read the lesson guide | read-only |
| `validate_lesson` | Check a lesson | write (keeps a draft), not destructive |
| `publish_lesson` | Publish a lesson | write, not destructive |
| `update_lesson` | Update a published lesson | write, not destructive, idempotent |
| `keep_lesson` | Keep a lesson in an account | write, not destructive, idempotent; needs sign-in |

## 3. Listing

**Name** (≤100): `learn.ninja`

**One-liner** (≤200):

> Turn any topic, article, notes, or code into a short interactive lesson with a link to share. Free, no account needed; sign in once to keep lessons.

**Description** (≤2,000):

> learn.ninja turns anything you give Claude into one short, interactive lesson, Duolingo-style: a hook, a few concept screens, questions with instant feedback (multiple choice, compare, hotspot, sort, order, match, fill the blank, scenarios), and a wrap-up. Give it a topic, an article, meeting notes, docs, a transcript, or code, and it writes, checks, and publishes the lesson, then hands back a link anyone can open in a browser. Lessons work on phones, in 20+ languages including right-to-left ones, with no sign-up to play.
>
> Making lessons needs no account. A published lesson lasts 7 days; say "keep it" and Claude asks you to sign in to learn.ninja once, after which that lesson and every later one are saved to your account, can be listed in Explore under your handle, and can be edited from any chat. Lessons are built from a checked, open lesson format, so every one has the same quality bar, and the guide Claude follows is the same one the learn.ninja skill uses in Claude Code.
>
> Tools: read the lesson guide, check a lesson, publish a lesson, update a published lesson, and keep a lesson in your account. Lesson visuals are plain HTML with no scripts, and the server only ever calls learn.ninja's own API.
>
> Free and open source. Built by @cmicpace and @gkamenz.

**Categories** (1–5, pick from the portal's list): Education, Productivity, Content creation. Add Developer tools if the list has it, since many users come from Claude Code.

**Documentation URL**: `https://learn.ninja/docs/reference/mcp`

**Privacy policy URL**: `https://learn.ninja/privacy`

**Support contact**: `sensei@learn.ninja`

**Icon**: `brand/icon-1024.png`

**Slug**: `learn-ninja` (permanent)

## 4. Use cases

**Primary use cases**:

- Turn an article, notes, or a document into a lesson to share with a team, a class, or friends.
- Teach yourself a concept: ask for a lesson on any topic and play it on your phone.
- Make onboarding or training material from internal docs, as a link rather than a deck.
- Learn vocabulary or a language skill in a few minutes a day.

**What users need before connecting**: nothing. No account, plan, or setup. Keeping lessons beyond 7 days takes a free learn.ninja account, created on first sign-in (email code or GitHub).

**Reads or writes**: both. Reads the lesson guide; writes lessons to learn.ninja (publishes, updates, keeps).

## 5. Company

- Company name: learn.ninja
- Website: `https://learn.ninja`
- Primary contact for review updates: Colin Pace (your claude.ai email)

## 6. Authentication

- The server starts **without authentication**, and one tool (`keep_lesson`) prompts for sign-in on demand: flag that option.
- OAuth 2.0 with **Client ID Metadata Documents** (Claude's published identity). Dynamic Client Registration is also supported as a fallback. No Anthropic-held credentials, no custom connection.
- Authorization server: `https://learn.ninja/api/auth` (discovery at `/.well-known/oauth-authorization-server/api/auth`). PKCE S256 required. Redirect URI `https://claude.ai/api/mcp/auth_callback` and loopback redirects for Claude Code are accepted.
- Scope requested: `lessons` (publish and keep lessons as the user), plus `offline_access` for refresh tokens. Tokens can't read email, change the handle, or sign in on the website.

## 7. Data handling

- The underlying API is **our own**, first party, at learn.ninja.
- No personal health data.
- No sponsored content.
- Data the server stores: the lessons users publish (content, title, tags), who owns them, and OAuth grants. No conversation data beyond the lesson text sent to the tools. See the privacy policy.

## 8. Test & launch

**Test account** (set the two variables above first):

- Email: `reviewer@learn.ninja`
- Sign-in code: the value of `REVIEW_SIGN_IN_CODE` (six digits; the address always accepts it and gets no email)
- Handle: `reviewer`

**Steps for a reviewer**:

1. Add `https://learn.ninja/mcp` as a custom connector with **Sign in when needed** (or connect from the listing once it's live).
2. In a chat: "Make a short lesson about why the sky is blue." Claude calls `get_guide`, then `publish_lesson`, and replies with a link that opens in any browser. No sign-in.
3. "Change the title to 'Blue skies'." Claude calls `update_lesson` with the edit token from publishing; the same link now shows the new title.
4. "Keep it." Claude calls `keep_lesson`; a Connect card appears. Sign in with the email above and the code; allow the app. Claude retries and replies "Saved to @reviewer and listed in Explore."
5. "Make a lesson about compound interest." Published straight to the account (unlisted), no prompt.
6. Optional: "Check this lesson without publishing it" with any lesson JSON calls `validate_lesson`.

**Confirmation**: every tool was run as a custom connector in Claude.ai and Claude Code on the release day, and the server's own test suite exercises each tool with and without a token.

## 9. Compliance

Seven acknowledgments, all required: directory guidelines, first-party API usage (yes, our own), financial transactions (none), AI media generation (none; lessons are text and HTML), prompt injection (tool descriptions describe the tools; the lesson guide is returned as tool content and tells Claude how to write a lesson), conversation data collection (only the lesson text sent to the tools), public documentation (https://learn.ninja/docs).

## 10. Review and submit

Check for quality warnings about short answers, then submit. The status shows in the portal; escalations go to mcp-review@anthropic.com.

## After publishing

- The listing URL is `https://claude.ai/directory/connectors/learn-ninja`: add it to the docs and the home page next to the custom-connector link.
- Unset `REVIEW_SIGN_IN_EMAIL` and `REVIEW_SIGN_IN_CODE` once the review closes.
- Also submit a plugin bundle that points at the same server and bundles the skill, so Claude Code users get one set of tools.
