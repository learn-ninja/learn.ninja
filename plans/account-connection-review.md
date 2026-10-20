# How a lesson reaches an account: review and recommendation

Design review, 2026-10-19, against `origin/main` with PR learn-ninja/learn.ninja#28 (`auto-list-saved`) assumed merged. No code changed in the review itself; phases 0 and 1 shipped in #30 and phases 2 and 3 in #31 on 2026-10-20. The local branch `claude/d2-diagrams-and-centered-svg` predates accounts, so every path below was read from `origin/main`.

## 1. Current behavior

| Path | Owned? | What the person sees | How it's lost |
|---|---|---|---|
| **CLI, not logged in** (`learn publish`) | No. Edit and claim tokens go to `.learn/state.json`. Becomes owned only when `learn login` runs in that folder (`claimAll`), or when the same file is published again after a login elsewhere (`claimOne`). | "Lasts 7 days, until … To keep it for good, run `learn login`." Agent adds the keep sentence once. | Expires after 7 days. If `.learn/` is deleted the claim token is gone and the lesson can never be kept. |
| **CLI, logged in** (`~/.config/learn/credentials` or `LEARN_API_KEY`) | Yes, at publish. Never expires. With #28, **public in Explore at once**. | "Saved to your account: it doesn't expire." Nothing says it's listed under their handle. | Not lost. Website session is irrelevant either way. |
| **MCP** (Claude.ai, Desktop, ChatGPT, Cursor, VS Code) | **Never.** `server.ts` hardcodes `ownerId: null`; `app/mcp/route.ts` builds no actor. | Tool result carries `editToken` and `claimUrl` (the model sees them; the person sees a collapsed tool call). Agent says the keep sentence once and gives the link only if asked. | Expires after 7 days. Once the chat is closed or compacted, `claimUrl` and `editToken` are both gone, and neither can be re-issued. |
| **Keep link** `/keep/{token}` | Yes, when clicked: signed in → title + "Keep it" → owned and public. Signed out → sign-in form (GitHub or code) → back → button. | "Kept. … saved to your account and won't expire." Doesn't mention Explore. "Nothing to keep here" once spent or expired. | Works once. Only reaches the person if the agent pastes it or they ask. |
| **Claim API** `POST /api/lessons/{id}/claim` | Yes: cookie or `x-api-key` plus `claimToken`. | Only the CLI calls it. | n/a |
| **Signed in on learn.ninja** | Nothing published anywhere reaches the account by itself. | Explore "Mine" and Settings → Your lessons stay empty. | This is the flower-anatomy case. |

**Expectation gaps** (signed in on the site, lesson not saved): every MCP publish, every CLI publish without `learn login`, and the keep link when it's never shown. The site session is a separate world from both agent surfaces.

## 2. Gaps, ranked by how much they hurt

1. **MCP lessons can't be owned and the keep flow is invisible.** Hardcoded anonymous publish, plus a guide rule that hides the one link that would save it. Most chat-app lessons expire unnoticed. (The reported bug.)
2. **Keeping is unrecoverable once the chat or folder is gone.** The claim token is minted once (`publishLesson`) and never again; the edit token can't claim; older CLIs saved no claim token. A person holding the edit token, which proves authorship as well as anything does, still can't keep their lesson.
3. **Ownership doesn't travel between surfaces.** `updateLesson` accepts only the edit token, even from the owner. A lesson started in Claude.ai can't be edited from Claude Code (no `state.json` entry), and one started in Claude Code can't be edited from Claude.ai (no edit token in that chat).
4. **Nobody is told "listed in Explore".** After #28 an owned publish or a keep is public under the handle. The CLI output, `keep-form.tsx`, the MCP tool description, `steps.md` step 6, and `docs/keep.md` all still say "saved, won't expire".
5. **Smaller:** MCP rate limits key on the client IP (`clientOf` → `clientKey`); Claude.ai connectors call from Anthropic's egress, so all Claude.ai users likely share one 20-an-hour bucket (check the logs). There's no `learn keep`: claiming lessons from a second folder means `learn login` again, which sends another code. The edit token sits in the chat transcript as a tool result (acceptable, but worth knowing).

## 3. MCP auth: the options

Constraints from the clients: Claude.ai and Claude Desktop custom connectors take a URL and, optionally, an OAuth client id and secret; there is no header field ([Claude help center](https://support.claude.com/en/articles/11175166)). ChatGPT connectors take OAuth (dynamic registration or client-id metadata) or no auth ([Auth0's walkthrough](https://auth0.com/blog/add-remote-mcp-server-chatgpt/)). Claude Code, Cursor, and VS Code accept headers in config. So a credential that must work everywhere is either OAuth or part of the URL.

| Option | Works in | Security | Work |
|---|---|---|---|
| **A. OAuth** (`@better-auth/mcp` on the OAuth provider plugin, plus `jwt`, consent and login pages, `cimd`; [plugin docs](https://better-auth.com/docs/plugins/mcp.md)) | Every client. The only option Anthropic's connector directory is likely to want. | Best: standard tokens, scopes, revocation, no secret in a URL. | Largest: new tables, two pages, a sign-in flow inside the OAuth login page (email OTP there is unconfirmed). Also makes auth mandatory at connect time, so `/mcp` must stay anonymous and a second URL carries the authenticated server, or "no account needed" is gone. |
| **B. Per-user MCP URL** `https://learn.ninja/mcp/{learn_mcp_…}` from Settings | Every client, including Claude.ai Free and ChatGPT: it's just a URL. Zapier and Composio ship MCP this way. | The URL is a bearer secret: screenshots, shared configs, and request logs leak it. Mitigate: a scoped key (publish, update, claim, list; refused on `/api/keys` and `/api/account`), distinct prefix, rotate and revoke in Settings, last-used shown, rate limit per key. | About a day. |
| **C. Email code in the chat** (`keep_lesson` tool: email → code → claim) | Every client. Same words as `learn login`, so one guide for both surfaces. | No secret to paste; the code travels through the model to our server over TLS, as it already does through the CLI. Existing per-email and per-IP limits apply. One code per lesson unless a scoped token is returned for the rest of the chat (I'd skip that: a secret in the transcript the model must carry). | About a day. |
| **D. Device code** (chat shows a code, person types it on the site) | Every client. | Fine, but the server is stateless and has no connection identity to bind to, so it still has to hand the model a token. C with more steps. | Skip. |

**Recommendation:** C for keeping (it is the here.now model, in the chat, on both surfaces), B for people who want everything they make saved without asking, A only when a directory listing or a client demands it. Keep the current `/mcp` anonymous forever.

## 4. Cross-surface continuity

- **Ownership** is the durable thing; tokens are conveniences. Claiming should accept the claim token **or the edit token**: whoever can rewrite the lesson is its author in every sense that matters. The one new risk is attribution theft by someone who was handed an edit token, which the person already gave them.
- **Owners edit with their account.** `updateLesson` takes `actorId` and accepts it when it equals `ownerId`, as an alternative to the edit token. Over MCP with a per-user URL, `update_lesson({id, patches})` then needs no token, and the id is in the lesson URL, so "edit https://learn.ninja/l/flower-anatomy-k3x9a2mq" just works (the patches-only path already reads the stored lesson). In the CLI, `learn publish lesson.json --id <id or url>` records the id in `state.json` and updates; a `GET /api/lessons/{id}/source` for owners lets `learn pull <url>` fetch the JSON first.
- **Edit token after a claim:** keep it working. The chat that published the lesson still relies on it. Add "rotate edit token" in Settings → Your lessons later if anyone asks.
- **Claim token:** single use, cleared on claim (already). Re-mintable by the edit-token holder (`keep_lesson` over MCP, `learn keep` in the CLI), which fixes gap 2.

## 5. Guide and copy

Keep the once-only rule. Make the two surfaces say the same thing:

- Anonymous, both surfaces: "Published: {url}. It lasts 7 days. To keep it, say so and I'll save it under your email." (Needs phase 2 for MCP; until then: "…say so and I'll give you a link that saves it".)
- Owned, both surfaces: "Saved to @{handle} and listed in Explore. Say the word to unlist it." The handle and visibility come back in the publish reply (`owner: {handle}`, `visibility`). When the account has no handle yet: "…saved to your account; pick a handle at learn.ninja/settings and it'll show in Explore."
- Keep page and `learn login` output: add "and listed in Explore under @handle".
- `publish_lesson` description: replace "give it to the user only when they ask" with the keep sentence itself, so every MCP client's model has it without reading `steps.md`.

## 6. Rescue

Safe only with a token. Three cases:

- **The chat is still there** (MCP): ask the agent for the keep link, or after phase 1, "keep it". The edit token in the transcript is enough.
- **The folder is still there** (CLI): `learn login` in that folder keeps everything in `state.json`; after phase 1, `learn keep` without a new code.
- **Older CLI, no claim token saved:** claim by edit token (phase 1).

Not safe, don't build: matching by IP or time (Claude.ai's egress IP isn't the person's), an "Is this yours?" button on the lesson page (anyone with the link), or trusting the site session that happened to be open. Once the 7 days pass the cron deletes the row and nothing remains.

## 7. Recommended design, in phases

**Phase 0: words (hours).** `skills/learn/steps.md` steps 6–7, `apps/web/lib/mcp/server.ts` tool descriptions, `packages/cli/src/cli.ts` publish and login output, `apps/web/components/account/keep-form.tsx`, `docs/keep.md`, `docs/reference/mcp.md`, `docs/reference/api.md`. Return `owner.handle` and `visibility` from `publishLesson`/`updateLesson`/`claimLesson` in `handlers.ts` so the copy can name them. Guide and tool text need no version bump; the CLI text does.

**Phase 1: keep by edit token (a day).** `claimLesson` accepts `editToken` as proof; a new `reissueClaimToken` in `handlers.ts` with `LessonStore.setClaimToken` in `store.ts`; MCP tool `keep_lesson({id, editToken})` that returns a fresh `claimUrl`; CLI `learn keep` that claims with the edit token when logged in. Also `app/api/lessons/[id]/claim/route.ts`, `publish.test.ts`, `mcp.test.ts`, `docs/reference/api.md`. Tradeoff: an edit token now also grants ownership, which it already granted in substance.

**Phase 2: email code in the chat (a day).** `keep_lesson({id, editToken, email})` sends the code through Better Auth (`auth.api.sendVerificationOTP`); the same call with `code` signs in server-side (`auth.api.signInEmailOtp`), reads the user, calls `claimLesson`, and discards the session. New `apps/web/lib/mcp/keep.ts`, `server.ts`, `steps.md` step 7 (one text for both surfaces), `mcp.test.ts`. The "code" rate limiter already exists in `auth.ts`.

**Phase 3: per-user MCP URL (one to two days).** `app/mcp/[key]/route.ts` resolves the key through a `getActor` variant that reads it from the path, passes `actor` into `createLearnMcp`, and publishes with `ownerId`. Keys are Better Auth API keys with a `permissions` scope the account routes refuse (`auth.ts` already blocks key minting by key). Rate limits key on the key id. Settings gets a "Connect a chat app" section (`components/account/connect-chat.tsx`, `lib/auth/account.ts`) with copy, rotate, revoke. `docs/reference/mcp.md` gets "Connect with your account". Tradeoff: a secret in a URL, scoped and revocable; make sure Vercel's request logs don't keep the path, or hash it in a middleware before logging.

**Phase 4: owners edit anywhere.** `updateLesson` owner auth; `update_lesson` without a token when the key owns the lesson; `GET /api/lessons/{id}/source` for owners; `learn publish --id` and `learn pull`. Files: `handlers.ts`, `app/api/lessons/[id]/route.ts`, `server.ts`, `cli.ts`, `docs/reference/cli.md`.

**Phase 5: OAuth.** Only when applying to a connector directory or when ChatGPT stops taking no-auth connectors. Fable work, as the MCP plan already says.

## 8. Decisions that are yours

1. **Paste the keep link by default over MCP** until phase 2 lands? It's a one-shot secret, but a private chat is where it's going anyway, and hiding it is why lessons expire. I'd say yes, in the keep sentence.
2. **Auto-owned means auto-public.** With #28, a per-user MCP URL puts every half-finished lesson in Explore under your handle. Options: owned publishes start `unlisted` when they come through MCP, a `listed` parameter on `publish_lesson`, or accept it and rely on the "say the word to unlist it" sentence.
3. **Edit token as proof of authorship** for claiming (phase 1). Cheap and unlocks every rescue; the only cost is the attribution-theft edge case above.
4. **Order of phases 2 and 3.** Email-in-chat first keeps the "never pushed" rule and one guide; the URL first is what a creator who makes ten lessons a week will want.
5. **Edit token after a claim:** keep working (my pick) or revoke, which breaks the chat that made it.
6. **OAuth timing**, which is really "when do we apply to the connector directory".
