# learn.ninja

Turn anything you give your AI agent into one short, interactive lesson, and share it as a link. Free, no account. Live at https://learn.ninja.

## Getting started

Requires Node 24 (see `.nvmrc`) and npm.

```bash
npm install
npm run dev
```

The web app runs at http://localhost:3000: the home page, the docs at `/docs`, and the seven test lessons at `/lessons/{slug}`.

```bash
npm run storybook
```

Storybook runs at http://localhost:6006, with every brick type in every state.

## The lesson skill

Install it in your agent (Claude Code, Cursor, Codex…), then ask it to make a lesson from anything:

```bash
npx skills add https://learn.ninja -g
```

The site serves the skill from `skills/learn/`. The skill writes a lesson file, checks it, and publishes it with `node <skill>/scripts/learn.mjs publish lesson.json`. Set `LEARN_API_URL` to publish somewhere other than the default server (e.g. `http://localhost:3000`).

## Contributing to the docs

The docs live in [`docs/`](docs) as Markdown (`.md`) or MDX (`.mdx`) files, one per page:

- Each page starts with a `title` and a `description`.
- Each folder's `meta.json` sets the sidebar order. A list ending in `"..."` also picks up new files.
- `<BrickPreview lesson="compound-interest" brick="p1" />` shows a playable brick from one of the lessons in `examples/` (MDX pages only).

Edit a page, run `npm run dev`, and open http://localhost:3000/docs to see it. `npm run check` catches missing titles, sidebar entries that point nowhere, and demos that name a lesson or brick that doesn't exist.

## Checks

```bash
npm run check
```

Runs lint, type-checking, and tests across every package. CI runs the same checks plus a production build on every push.

## Structure

| Path              | What it is                                               |
| ----------------- | -------------------------------------------------------- |
| `apps/web`        | Next.js app: home page, docs, lesson player, publish API |
| `apps/storybook`  | Storybook for the player and UI components               |
| `docs/`           | The docs pages                                           |
| `packages/ui`     | shadcn/ui components on React Aria, shared styles        |
| `packages/spec`   | The lesson spec (v0.7)                                   |
| `packages/player` | Lesson screens and building blocks                       |
| `packages/cli`    | The `learn` command: validate and publish lessons        |
| `skills/learn`    | The installable lesson skill                             |
| `examples/`       | Test lessons                                             |
