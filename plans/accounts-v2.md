# learn.ninja v2: optional accounts, keeping lessons, and Explore

Plan agreed on 2026-10-19. Nothing here is built yet. The product keeps its promise: free, no account, and nobody is pushed to make one. An account only exists so a lesson can be kept, and so creators can be credited.

## Principles

1. **Anonymous is the default and is never sold.** Publishing works with no account. The agent states the expiry once, offers to keep the lesson in one sentence, and never brings it up again for that lesson.
2. **Keeping is a minute of work in the terminal.** The model is here.now: the agent asks for an email, the user pastes the code they receive, the agent saves a key. No browser, no password, no profile form.
3. **Nothing is lost by not signing in.** An anonymous lesson simply disappears after 7 days. Every anonymous lesson can be claimed into an account later, as long as it still exists.
4. **Free accounts keep lessons forever.** Paid tiers, when they come, are about teams and capacity, never about keeping things.
5. **The agent is the first author, not the only one.** Courses, a web editor, and in-app generation come later and build on the same tables.

## Decisions

| Question | Decision |
|---|---|
| Sign-in methods | GitHub (website only) and a six-digit email code (website and terminal). No magic links, no passwords. |
| Anonymous expiry | 7 days, up from 24 hours. |
| Owned lessons | Never expire. |
| Explore | Lists signed-in users' public lessons only. Anonymous lessons stay link-only and unguessable. |
| Home page | Stays the install page: hero and install command, then a strip of recent lessons from Explore, then the existing sections. |
| Navigation | `Explore · Docs · Sign in`, or `Explore · Docs · avatar` when signed in. |
| Per-lesson visibility | `public` (in Explore), `unlisted` (link only), `team` (reserved for later). Anonymous lessons are always unlisted. |
| Social features | One like per user per lesson, and a total play count per lesson. Nothing else in v2. |
| Moderation at launch | A report button on listed lessons that emails the maker, and a hidden flag flipped by hand. |
| Profiles | A minimal `/u/{handle}` page ships with Explore: the person's public lessons with plays and likes. |
| Handles | Default to the GitHub username; email-code users choose one the first time they open the site signed in. |
| OAuth app and email domain | GitHub OAuth app under the learn-ninja org; email sent from sensei@learn.ninja (learn.ninja is a secondary domain in the Google Workspace, verified in Resend). |
| Hosting | Vercel plus managed services from its marketplace. Self-hosting stays possible through the same libraries, but isn't a v2 deliverable. |

## Flows

**Anonymous publish (unchanged for the user).** `learn publish` returns the link, the edit token, and now also a claim token. The CLI keeps both in `.learn/state.json`. The agent says: "Published: {url}. It lasts 7 days. If you'd like to keep it, say so and I'll save it under your email."

**Keep from the terminal.** The user says keep. The agent runs `learn login`, which asks for the email, requests a code, waits for the user to paste it, exchanges it for an API key, and saves the key in `~/.config/learn/credentials` (mode 0600). The CLI then claims every lesson in `.learn/state.json` that has a claim token, and tells the user which ones it kept. From then on every publish from that machine carries the key and is owned at once. Lost or shared keys are revoked from the website.

**Keep from the browser.** The publish reply also includes a claim link, `/keep/{claimToken}`, for people who prefer to click. It signs them in (GitHub or email code) and claims that one lesson.

**Website sign-in.** `/sign-in` offers GitHub and the email code. First sign-in through email asks for a handle. Signed-in users see Mine in Explore, their profile, their lessons' visibility switches, and their API keys.

**Explore.** `/explore` with New, Trending, and Top. Cards show title, topic, level, minutes, author handle, plays, and likes. Trending is plays and likes with a time decay, recomputed on read from the counters. Liking needs sign-in; the card says so in place, with no modal.

**Plays.** The lesson page counts a play once per browser per lesson per day, written after the response is sent so the page never waits on it.

**Reports.** Any listed lesson has a report control that emails the maker with the link and a reason. The maker sets a hidden flag in the database. Hidden lessons stay reachable by link for their owner.

## Stack

| Layer | Choice | Notes |
|---|---|---|
| Auth | Better Auth 1.7 with the GitHub provider, the `emailOTP` plugin, and the `apiKey` plugin | Users live in our Postgres. `emailOTP` sends six-digit codes with a five-minute expiry and three attempts; store them hashed. `apiKey` issues the terminal keys, with `enableSessionForAPIKeys` so publish routes resolve a key the same way as a cookie. The `organization` and Stripe plugins are there for teams later. Watch its security advisories; it has shipped several fixes this year. |
| Database | Neon Postgres from the Vercel Marketplace, Drizzle 0.45 over the HTTP driver | One database for users, sessions, lessons, likes, and later teams and courses. A preview branch per deployment. PGlite runs the same schema locally and in tests, replacing the file store. |
| Redis | Upstash, kept | Rate limits, play counters, and Better Auth's secondary session storage. Play counts flush to Postgres on a schedule. |
| Email | Resend, from sensei@learn.ninja | Sign-in codes and report emails. 3,000 a month free. |
| Next.js 16 | `proxy.ts` only redirects; pages and routes validate the session themselves. `after()` records plays. The Explore page is cached and revalidated on publish, like, and visibility changes; "liked by me" is a small dynamic island. |

New environment variables: `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `RESEND_API_KEY`, `REPORT_EMAIL`. All documented in `.env.example`.

## Data model

Better Auth owns `user`, `session`, `account`, `verification`, and `apikey`. We add `handle`, `bio`, and `banned` to `user`.

```
lesson        id, slug, spec, lesson (jsonb), prepared (jsonb), edit_token_hash,
              claim_token_hash (null once claimed), owner_id (null = anonymous),
              org_id (null, reserved), visibility (public | unlisted | team),
              hidden (bool), plays (int, flushed from Redis), likes (int, maintained),
              created_at, updated_at, expires_at (null = never)
like          user_id, lesson_id, created_at           primary key (user_id, lesson_id)
report        id, lesson_id, reason, reporter_ip_hash, created_at
```

Rules: an owned lesson has `expires_at` null; claiming sets `owner_id`, clears `claim_token_hash`, nulls `expires_at`, and leaves visibility `unlisted` until the owner lists it, so nothing appears in Explore that the author didn't choose to show. A scheduled job deletes rows whose `expires_at` has passed. Lesson size stays within the spec's limit, so a free database holds tens of thousands.

## API

- `POST /api/lessons` and `PUT /api/lessons/{id}`: unchanged for anonymous callers, plus `claimUrl` and `claimToken` in the reply. With a session cookie or `x-api-key`, the lesson is owned and `expiresAt` is null.
- `POST /api/lessons/{id}/claim`: body carries the claim token; needs a session or key.
- `PATCH /api/lessons/{id}`: visibility, owner only.
- `POST /api/lessons/{id}/like`, `DELETE` the same: signed-in only.
- `POST /api/lessons/{id}/report`: anyone, rate-limited.
- `POST /api/keys`: creates a named API key for the session; the only call that returns the raw key.
- Better Auth's own routes under `/api/auth/*`, including the email code endpoints the CLI calls.
- Explore and profiles read from the database directly in server components; no public listing API in v2.

## CLI and skill

- `learn login`: the email code flow above, then claims any lessons in the state file. `learn logout` deletes the credentials file. `learn whoami` prints the email and handle.
- `learn publish`: sends `x-api-key` when a credentials file exists; stores `claimToken` alongside `editToken` in `.learn/state.json`. The output for anonymous lessons becomes "Lasts 7 days" with the keep sentence; for owned lessons, "Saved to your account".
- `steps.md`: the agent tells the user the link and the expiry once, offers to keep it in one sentence, runs `learn login` only when asked, and never pastes the claim link into chat on its own. It never tells the user to look in `.learn/`.
- This changes the CLI and the installed skill, so `LATEST_SKILL_VERSION` and `SKILL_VERSION` bump together. `MIN_SKILL_VERSION` stays until a guide depends on the key.

## Site and docs

- Home: unchanged above the fold; a "Recent lessons" strip of six cards with an "Explore all" link; FAQ updated. "Do I need an account? No. Not to make lessons, and not to play them. Lessons last 7 days. If you'd like one to stay, your agent can save it to your email in a minute." "How long do lessons last? 7 days, or forever once saved to an account."
- `/explore`, `/u/{handle}`, `/sign-in`, `/keep/{token}`, `/settings` (handle, API keys).
- Lesson pages: owned public lessons drop `noindex` and show the author; anonymous ones stay as they are. The expired page says 7 days.
- Docs: `api.md` loses "there's no account or API key" and documents keys, claiming, and visibility; `cli.md` documents `login`; the Terms and Privacy pages cover accounts, GitHub profile data, email addresses, and the report process.
- Text for agents (`/index.md`, `llms.txt`) says the same as the FAQ.

## Phases

1. **Postgres.** Move `LessonStore` to Drizzle on Neon with the full `lesson` table above, PGlite for development and tests, the expiry sweep, and the 7-day expiry. No visible change except the FAQ and the CLI's "7 days" line. Done when every existing test passes against PGlite and production serves from Neon.
2. **Keep.** Better Auth with GitHub and the email code, handles, `/sign-in`, `/settings` with API keys, claim tokens in the publish reply, `/keep/{token}`, `learn login`, and the skill update. Done when a lesson published anonymously can be kept from the terminal and from the browser, and an owned publish never expires.
3. **Explore.** `/explore`, the home strip, likes, plays, visibility switches, profiles, and reports with the hidden flag. Done when a signed-in user's public lesson appears in Explore with live counts and can be hidden by the maker.
4. **Teams.** The organization plugin, invitations, `team` visibility, a team page, and a free member limit like here.now's Workspaces. Stripe per seat only once teams want something worth paying for.
5. **Courses and paths.** A course is an ordered list of lessons with its own title and owner, published by the CLI from a course file; the lesson spec stays as it is. Then the web editor, then in-app generation, which needs a paid tier to cover model costs.

## Bigger picture

- Customers in two years: creators and educators, and teams. Free for individuals, paid teams.
- Ownership, team, and visibility columns exist from phase 1 so no later phase migrates live data.
- Every service is a library or plain Postgres, so a fork can run on any host; the Vercel Marketplace is a convenience, not a dependency.

## Risks and open items

- Better Auth cold-start cost on Vercel is unmeasured; measure a cold `get-session` before phase 2 and lean on the cookie cache and Redis session storage.
- The email code is the one place spam can cost money: rate-limit sends per email and per IP, and keep `disableSignUp` off but watch the account count.
- Trending needs a formula; start with plays plus three times likes, halved every 48 hours, and adjust once there is data.
- Claim tokens are returned once; the CLI must save them before printing anything.
- Whether owned lesson pages should be indexed is a judgment call once creators exist; the flag is cheap to flip.

## Sources

- here.now: https://here.now, https://here.now/docs, https://here.now/pricing.md, https://here.now/skill.md
- Better Auth: https://better-auth.com/docs/integrations/next.md, https://better-auth.com/docs/plugins/email-otp.md, https://better-auth.com/docs/plugins/api-key/advanced.md, https://better-auth.com/docs/concepts/session-management.md
- Neon: https://neon.com/docs/guides/vercel-managed-integration, https://neon.com/faqs/free-plan-limits-and-quotas
- Drizzle: https://orm.drizzle.team/docs/quick-postgresql/neon
- Resend: https://resend.com/pricing, https://vercel.com/changelog/resend-vercel-marketplace
- Next.js 16: https://nextjs.org/docs/app/guides/upgrading/version-16, https://nextjs.org/docs/app/api-reference/functions/after
- Positioning references: https://v0.app, https://huggingface.co, https://skills.sh, https://www.tldraw.com, https://ui-patterns.com/patterns/LazyRegistration
