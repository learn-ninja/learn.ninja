# Contributing to learn.ninja

Thanks for helping. learn.ninja is small and built by a few people, so a good pull request makes a real difference. This page says where help goes furthest, what to talk about before writing code, and how review works.

## Where we want help

How a change is reviewed depends on how much of the lesson experience it touches.

| Area | Examples | Touches | Review path |
| --- | --- | --- | --- |
| Languages | Translate the player's interface, fix right-to-left issues | `player/src/locales` | Pull request |
| Sounds and motion | Better sound effects, transitions, celebration moments | `player` | Pull request |
| Summary screen | A richer end-of-lesson summary, sharing, what to learn next | `player` | Pull request |
| Visuals | New or better maps, charts, diagrams, chess, molecules | `player`, sometimes `spec` | Pull request; a proposal if the format changes |
| Teaching guide | How the agent writes better lessons, more examples | `skills/learn`, `examples/` | Pull request |
| Agent round trips | Lessons that send results back to the agent, editing from the agent, a local preview | `cli`, `skills/learn` | Proposal first |
| Voices | New ninja lines, voices for other languages | `player/src/voices.ts` | Proposal first: clips are generated with our voice key |
| New kata types | A new kind of question or screen | `spec`, `player`, `cli`, guide | Proposal first |

Fixes to the docs in [`docs/`](docs), bug fixes, and accessibility fixes are always welcome as a pull request. Issues labelled `good first issue` are a good place to start.

## Proposal first

Some changes reach every lesson ever published and every agent that writes one, so we agree on the design before anyone writes the code:

- **Format changes**: anything in `packages/spec` that changes what a lesson file may contain.
- **New kata types**: a new kind of question or screen touches the spec, the player, the checker, and the teaching guide at once.
- **Agent round trips**: lessons that send results back to the agent, editing from the agent, a local preview.
- **Voices**: the ninja's clips are generated with our voice key, so new lines go through us.
- **The visual sandbox**: lesson visuals are LLM-written HTML in a sandboxed iframe with no scripts. `packages/player/src/visuals.test.ts` pins that sandbox, and it changes only through a proposal. The same goes for the Content-Security-Policy in `apps/web/next.config.ts`.

To propose something, open an issue with the **Idea** form: the problem, who has it, and the approach you have in mind. Once a maintainer agrees on the approach, go ahead with the pull request.

## Making a change

1. Run the app locally (see the [README](README.md)); it needs no database or keys.
2. Make your change. [`CLAUDE.md`](CLAUDE.md) holds the project's conventions, for people and agents alike. The ones that come up most:
   - The product is **learn.ninja**, always lowercase, also at the start of a sentence.
   - A lesson is made of **katas** (one per screen), not steps, bricks, or exercises.
   - Use logical CSS (`ms-*`, `pe-*`, `start-*`), never left and right, so right-to-left works.
   - Player screens import UI only from `@workspace/ui/components/*`.
   - UI work follows [`.claude/skills/learn-ui-guidelines/SKILL.md`](.claude/skills/learn-ui-guidelines/SKILL.md), and a new screen or kata state gets a Storybook story.
3. Run `npm run check` (lint, types, and tests). It must pass; CI runs it on every pull request.
4. Open a pull request that says what changed and why, with a screenshot for anything visible.

### Translations

The player's interface is English-only on the site for now (`UI_TRANSLATIONS` in `packages/player/src/strings.ts`) until people who speak each language have tested it. Every language's strings live in `packages/player/src/locales/`. To check one, open any lesson with `?ui=` and the language code, such as `?ui=ar`. Lessons themselves can already be written in any language.

## Code written with agents

Much of learn.ninja is written with Claude Code, and agent-written contributions are welcome. Two conditions: say in the pull request that an agent wrote some or all of it, and understand it well enough to explain it and answer review questions yourself. Please don't send pull requests you haven't run.

## Review

Colin and Yan, the maintainers, answer every pull request and issue within a week, even if the answer is "not yet". Changes to the skill's core, the lesson spec, the visual sandbox, and the Content-Security-Policy need a maintainer's review (see [`.github/CODEOWNERS`](.github/CODEOWNERS)).

## License

By contributing, you agree that your contribution is licensed under [Apache-2.0](LICENSE), as section 5 of that license already says, or under [CC-BY-4.0](LICENSE-CONTENT) for the example lessons and docs. There's no CLA and no sign-off to add. The learn.ninja name, logo, and ninja stay Uxcel Inc's trademarks; see [TRADEMARK.md](TRADEMARK.md).

Everyone taking part follows the [Code of Conduct](CODE_OF_CONDUCT.md). Security issues go through [SECURITY.md](SECURITY.md), not public issues.
