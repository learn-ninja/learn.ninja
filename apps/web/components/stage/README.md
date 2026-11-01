# Stage: the stageshow kit, vendored

`kit/` is the React and CSS kit from [Stageshow](https://github.com/benjitaylor/skills/tree/main/stageshow) (MIT, see `kit/LICENSE`), copied as is from commit `8020574` (2026-10-31) with one omission: `kit/brands/` and the `BrandMark` part, which carry third-party artwork under their own licenses that nothing here uses.

It draws the authored product illustrations on the site (the home hero in `components/home/hero-demo.tsx`): windows, phones, cursors and the motion parts that are hard to get right by hand. Every selector is scoped under `.ss-*`, all kit CSS sits in `@layer stageshow`, and a stage pauses offscreen and shows its `poster` under reduced motion.

Treat it as third-party code: it is excluded from lint and formatting, and nothing in it is edited by hand, except a `// @ts-nocheck` line at the top of the files that don't pass our stricter `noUncheckedIndexedAccess` (chart, Connector, Count, act, measure, stage, ios). To update, copy the skill's `kit/` over this folder again, drop `brands/` and `BrandMark` as above, and note the commit here. The skill itself (`npx skills add benjitaylor/skills --skill stageshow`) is how an agent builds and films a new scene: its playground and `film.mjs` live with the skill, not here.
