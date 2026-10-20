@AGENTS.md

# learn.ninja

An LLM turns any input into one short, interactive lesson (Duolingo/Brilliant-style), and this app plays it from a shared link. The product is **learn.ninja**, always lowercase (also at the start of a sentence), live at https://learn.ninja; it's free and needs no account. Built mainly by one person with Claude Code; open-source-ready (license not chosen yet, so don't add one).

Planning doc (decisions, lesson spec, tech stack, test lessons): https://claude.ai/code/artifact/d4d46b87-0964-4396-bb26-70d0e1b1eb49

## Layout

- `apps/web`: Next.js 16 app: the home page (`/`), the docs (`/docs`, rendered from `docs/`), bundled test lessons at `/lessons/{slug}`, published lessons at `/l/{slug}-{id}`, the publish API (`POST /api/lessons`, `PUT /api/lessons/{id}`) in `lib/publish/`, and the agent-facing files (below)
- `docs/`: the docs pages as Markdown/MDX, outside `apps/` so anyone can contribute. Fumadocs (`fumadocs-core` + `fumadocs-mdx`, headless: our own shadcn UI, like ui.shadcn.com) reads them through `apps/web/source.config.ts`. Each folder's `meta.json` orders the sidebar (`"..."` picks up new files); the docs render as one page at `/docs`, each file a section reached by anchor, so `##` headings must be unique across files; the sidebar's sections are the separators in `docs/meta.json`, with each file's headings under them (`apps/web/lib/docs-nav.ts`); `<BrickPreview lesson="…" brick="…" />` embeds a playable brick from `examples/`
- `apps/storybook`: Storybook 10 (Vite) for the player and UI components; stories live next to components as `*.stories.tsx`
- `packages/ui`: shadcn/ui components on React Aria (`--base aria`), shared Tailwind styles and theme
- `packages/db`: the Postgres schema (Drizzle) and its SQL migrations
- `packages/spec`: the lesson spec v0.3: Zod schema, exported JSON Schema, validation rules, and the 0.2 → 0.3 upgrade (single source of truth)
- `packages/player`: React components for every lesson screen and brick
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
- `npm run favicon -w web`: rebuild `apps/web/app/favicon.ico` from `app/icon.svg` after changing the icon
- `npm run tags -w web`: the weekly tag report (subjects by lesson count, top tags per subject, tags used once) from `DATABASE_URL` or `apps/web/.env.local`, else the local PGlite; read it to add synonyms to `packages/spec/src/tags.ts`
- `npm run share -w web`: re-render the share images in `brand/` (GitHub social preview, X banner, square post) from the link preview card in `apps/web/lib/og.tsx`
- Add shadcn components from `apps/web`: `npx shadcn@latest add <name>` (they land in `packages/ui`)

## Vocabulary

A lesson is made of **bricks**, one per screen: `concept` bricks (theory) and question bricks (`choice`, `compare`, `hotspot`, `sort`, `order`, `match`, `blank`, `scenario`). Say "brick", not "step" or "exercise", in code, docs, and the skill.

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
- Demos in the docs use `BrickDemo` from `@workspace/player`: one playable brick, shuffled with a seed so server and browser render the same.

## Publishing

- Storage goes through `LessonStore` (`apps/web/lib/publish/store.ts`): Postgres through Drizzle, with the schema and migrations in `packages/db`. Neon (`DATABASE_URL`, migrated by the web app's build) in production; PGlite in `apps/web/.data/pglite` in development and in memory in tests, migrated on first use. After changing `packages/db/src/schema.ts`, run `npm run generate -w @workspace/db` and commit the migration. Upstash Redis is only for rate limits.
- Lessons expire 7 days after publishing; updates keep the expiry. `/api/cron/expire` deletes expired rows daily (Vercel Cron, `CRON_SECRET`). Edit tokens are only stored hashed.
- `prepareLesson()` runs at publish time: KaTeX, Shiki, and Tailwind utilities for the lesson's HTML. The result is stored with the lesson.
- Guide, example, and checker changes need no version bump: they go live on deploy through `sync` and `/api/validate`. Bump `LATEST_SKILL_VERSION` (`apps/web/lib/skill-version.ts`) and `SKILL_VERSION` (`packages/cli/src/cli.ts`) together only when the CLI or the installed `SKILL.md` changes; older installs are then told to run `npx skills add https://learn.ninja -g`. Raise `MIN_SKILL_VERSION` only when a guide relies on new CLI behavior: `sync` refuses to run below it.

## Storybook

- Build and review components in Storybook first, then use them in the app.
- Add a story for every new brick type or screen, with its states (the Bricks stories use a `state` control for question bricks: idle, wrong, correct, revealed).
- Stories use the example lessons from `examples/` via `packages/player/src/stories/fixtures.tsx`; formulas and code are prepared before Storybook starts.

## v1 scope reminders

No accounts (progress is kept in the browser only, per lesson page), lessons expire after 7 days, no typed answers (word chips instead), no `number` bricks (multiple choice instead), no images. Multiple languages and right-to-left matter from day one.
