@AGENTS.md

# learn.ninja

An LLM turns any input into one short, interactive lesson (Duolingo/Brilliant-style), and this app plays it from a shared link. The product is **learn.ninja**, always lowercase (also at the start of a sentence), live at https://learn.ninja; it's free and needs no account. Built mainly with Claude Code. Open source: Apache-2.0 for the code (`LICENSE`, `NOTICE`), CC-BY-4.0 for `examples/` and `docs/` (`LICENSE-CONTENT`); the name, logo, `brand/` and the ninja are Uxcel Inc's trademarks (`TRADEMARK.md`). Maintainers' private notes go in a git-ignored `CLAUDE.local.md`.

## Layout

- `apps/web`: Next.js 16 app: the home page (`/`), the docs (`/docs`, rendered from `docs/`), bundled test lessons at `/lessons/{slug}`, published lessons at `/l/{slug}-{id}`, the publish API (`POST /api/lessons`, `PUT /api/lessons/{id}`) in `lib/publish/`, and the agent-facing files (below)
- `docs/`: the docs pages as Markdown/MDX, outside `apps/` so anyone can contribute. Fumadocs (`fumadocs-core` + `fumadocs-mdx`, headless: our own shadcn UI, like ui.shadcn.com) reads them through `apps/web/source.config.ts`. Each folder's `meta.json` orders the sidebar (`"..."` picks up new files); each file is a page at `/docs/{path}` with its own title, description, canonical URL, and JSON-LD (`lib/json-ld.ts`), so link to another file by its path, never a bare `#anchor`; the sidebar's sections are the separators in `docs/meta.json`, with each file's headings under the page being read (`apps/web/lib/docs-nav.ts`); `<KataPreview lesson="…" kata="…" />` embeds a playable kata from `examples/`
- `apps/storybook`: Storybook 10 (Vite) for the player and UI components; stories live next to components as `*.stories.tsx`
- `packages/ui`: shadcn/ui components on React Aria (`--base aria`), shared Tailwind styles and theme
- `packages/db`: the Postgres schema (Drizzle) and its SQL migrations
- `packages/spec`: the lesson spec v0.3: Zod schema, exported JSON Schema, validation rules, and the 0.2 → 0.3 upgrade (single source of truth)
- `packages/player`: React components for every lesson screen and kata
- `packages/player-core`: the player's DOM-free parts (answer checking, flow and state, saved progress with storage passed in, strings and every locale, the ninja's lines, `Prepared` types), shared by `packages/player` and `apps/mobile`; its tsconfig has no DOM library
- `packages/cli`: the `learn` command (sync, validate, publish, schema) the skill runs; bundled into `skills/learn/scripts/learn.mjs`
- `packages/eslint-config`, `packages/typescript-config`: shared configs
- `skills/learn/`: the installable skill (`npx skills add https://learn.ninja -g`, served by `apps/web` at `/.well-known/skills/`): a short SKILL.md that runs `sync`, then `steps.md`, the teaching guide, format reference (also shown in the docs through `<include>`), and generated copies of the schema, examples, and bundled CLI. Everything but SKILL.md and the CLI is also served as one bundle at `/api/skill`, which `sync` downloads into a project's `.learn/skill/`, so guide changes reach every install on deploy
- `examples/`: the seven test lessons as JSON (five beginner, one intermediate, one advanced), used as fixtures
- `spikes/`: throwaway test builds, git-ignored; never import from here

## Commands

- `npm run dev`: start the web app (webpack)
- `npm run check`: lint, type-check, and tests across all packages; run after every change
- `npm run build`: production build
- `npm run storybook`: Storybook at http://localhost:6006 (theme and language switches in the toolbar)
- `npm run skill:build -w @workspace/cli`: rebuild `skills/learn` (bundled CLI, schema, examples) after changing the spec, CLI, or examples; a test fails if it's stale
- `npm run schema -w @workspace/spec`: re-export `packages/spec/schema/lesson.schema.json` after changing the spec (a test fails if it's stale)
- `npm run map -w @workspace/player`: rebuild the map visual's country shapes (`packages/player-core/src/map-data.json`) and the checker's table of countries (`packages/spec/src/countries.ts`) from Natural Earth via world-atlas
- `npm run voice -w @workspace/player`: speak the ninja's English lines (`packages/player-core/src/locales/voices/en.ts`) with his ElevenLabs voice into `apps/web/public/voice/en/` and `packages/player-core/src/voice-clips.json`, after changing them (a test fails if a clip is missing); only new lines cost credits, and it reads `ELEVENLABS_API_KEY` from `apps/web/.env.local`
- `npm run favicon -w web`: rebuild `apps/web/app/favicon.ico` from `app/icon.svg` after changing the icon
- `npm run smoke -w web`: rebuild the intro smoke's textures (`packages/ui/src/styles/smoke.css`) after changing the recipe in `apps/web/scripts/build-smoke.mjs`; they live in the stylesheet so the smoke is there on the first paint
- `npm run tags -w web`: the weekly tag report (subjects by lesson count, top tags per subject, tags used once) from `DATABASE_URL` or `apps/web/.env.local`, else the local PGlite; read it to add synonyms to `packages/spec/src/tags.ts`
- `npm run tags:backfill -w web`: brings every stored lesson up to the current spec and rebuilds its `lesson_tag` rows (dry run; `-- --write` applies). The production build runs it automatically after the migrations on every deploy (`scripts/backfill-on-deploy.ts`, skipped on previews); run it by hand only for a local PGlite or a one-off
- `npm run handles:backfill -w web`: gives every account without a handle a random one (dry run; `-- --write` applies)
- `npm run bento -w web`: redraw the home page bento's lesson visuals (`apps/web/components/home/bento-visuals.generated.json`) with the player's own renderers after changing `apps/web/lib/bento-visuals.ts` (a test fails if it's stale)
- `npm run share -w web`: re-render the share images in `brand/` (GitHub social preview, X banner, square post) from the link preview card in `apps/web/lib/og.tsx`
- `npm run tokens -w mobile`: regenerate the app's design tokens (`apps/mobile/tokens.ts`) from the `.dark` block of `packages/ui/src/styles/globals.css` after changing the theme (a test fails if it's stale)
- Add shadcn components from `apps/web`: `npx shadcn@latest add <name>` (they land in `packages/ui`)

## Vocabulary

A lesson is made of **katas**, one per screen: `concept` katas (theory) and question katas (`choice`, `compare`, `hotspot`, `sort`, `order`, `match`, `blank`, `scenario`). Say "kata" (plural "katas"), not "brick", "step", or "exercise", in code, docs, and the skill; the ninja's own lines may use the Japanese plural "kata".

## Rules

- Read the `learn-ui-guidelines` skill (`.claude/skills/learn-ui-guidelines/SKILL.md`) before any UI work: surfaces and dark-mode layers, sizes, typography, states, and the check-before-done list.
- The UI follows shadcn's Nova style (`aria-nova` in both `components.json` files; the `sm` button keeps 14px text, as Agendolo's does). Build from shadcn components and their shapes (`rounded-lg` buttons and inputs, `rounded-md` other controls, `rounded-lg` alerts, `rounded-xl` cards, `rounded-2xl` bordered windows with no fill, `shadow-xs`, 1px borders) instead of hand-rolled styles. Add missing pieces with `npx shadcn@latest add` rather than copying their classes.
- Player screens import UI only from `@workspace/ui/components/*`, never from `react-aria-components` or `@base-ui/react` directly. There are no exceptions. This keeps a future library switch cheap.
- Build with webpack (`next dev/build --webpack`, already in the scripts). React Aria's locale-trimming plugin doesn't support Turbopack.
- React Aria stores Arabic strings as `ar-AE`. Use that code in `apps/web/next.config.ts`; any other Arabic code silently strips them.
- Focus styles use `focus-visible:` classes; `tailwindcss-react-aria-components` makes them follow React Aria's keyboard detection. Don't remove that plugin from `packages/ui/src/styles/globals.css`.
- Use logical CSS (`ms-*`, `me-*`, `ps-*`, `pe-*`, `start-*`, `end-*`), never left/right, so right-to-left works.
- Lesson visuals are LLM-written HTML shown in a sandboxed iframe with Basecoat and no scripts. Never let lesson content run code.
- Lesson routes (`/l/*`, `/lessons/*`) send a Content-Security-Policy from `next.config.ts` that only allows same-origin resources; visual frames inherit it, so it's what stops a visual loading anything off-site when the publish-time checks miss something. The frame's sandbox is pinned by `packages/player/src/visuals.test.ts`; never add `allow-scripts`.
- Never commit secrets. Real values go in `.env.local` (git-ignored); document variable names in `.env.example`.

## Site and docs

- Shared names and copy (the lowercase name, install command, agent prompt, agent list) live in `apps/web/lib/site.ts`; the FAQ in `lib/faq.ts`.
- Agents get plain text: `/llms.txt`, `/llms-full.txt`, `/index.md`, `/docs/{page}.md`, and `/schema/lesson.schema.json` (`lib/llm.ts`). Requests that don't accept HTML (like `curl`) get Markdown for `/` and `/docs/*` through rewrites in `next.config.ts`.
- `mdast-util-to-markdown` is pinned to 2.1.2 (root `overrides` plus a direct dependency of `apps/web`): 2.2.0 overflows the stack inside Fumadocs. Try removing the pin when Fumadocs updates.
- `apps/web/.source/` is generated by `fumadocs-mdx` (on install and build); after changing `source.config.ts`, restart the dev server.
- Demos in the docs use `KataDemo` from `@workspace/player`: one playable kata, shuffled with a seed so server and browser render the same.

## Publishing

- Storage goes through `LessonStore` (`apps/web/lib/publish/store.ts`): Postgres through Drizzle, with the schema and migrations in `packages/db`. Neon (`DATABASE_URL`, migrated by the web app's build) in production; PGlite in `apps/web/.data/pglite` in development and in memory in tests, migrated on first use. After changing `packages/db/src/schema.ts`, run `npm run generate -w @workspace/db` and commit the migration. Upstash Redis is only for rate limits.
- Lessons expire 7 days after publishing; updates keep the expiry. `/api/cron/expire` deletes expired rows daily (Vercel Cron, `CRON_SECRET`). Edit tokens are only stored hashed.
- `prepareLesson()` runs at publish time: KaTeX, Shiki, and Tailwind utilities for the lesson's HTML. The result is stored with the lesson.
- Guide, example, and checker changes need no version bump: they go live on deploy through `sync` and `/api/validate`. Bump `SKILL_VERSION` (`packages/cli/src/version.ts`, which `apps/web` imports as the latest version) only when the CLI or the installed `SKILL.md` changes; older installs are then told to run `npx skills add https://learn.ninja -g`. Raise `MIN_SKILL_VERSION` only when a guide relies on new CLI behavior: `sync` refuses to run below it.

## Storybook

- Build and review components in Storybook first, then use them in the app.
- Add a story for every new kata type or screen, with its states (the Katas stories use a `state` control for question katas: idle, wrong, correct, revealed).
- Stories use the example lessons from `examples/` via `packages/player/src/stories/fixtures.tsx`; formulas and code are prepared before Storybook starts.

## v1 scope reminders

No accounts (progress is kept in the browser only, per lesson page), lessons expire after 7 days, no typed answers (word chips instead), no `number` katas (multiple choice instead), no images. Multiple languages and right-to-left matter from day one: lessons are written in any language. The player's own interface follows the lesson's language or the learner's choice in the language menu (`UI_TRANSLATIONS` in `packages/player-core/src/strings.ts`); keep every translation up to date when adding strings, and check one with `?ui=`.
