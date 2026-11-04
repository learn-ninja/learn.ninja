# iOS app (Expo)

A native learn.ninja app that opens any shared lesson and plays it with the same katas, ninja, and streak as the web, plus sign-in, Explore, and a profile. Decided 2026-11-04. Estimate: about four to five weeks of agent-days, calibrated against this repo's own pace (the whole product, 78k lines, took four weeks), with App Store review and on-device tuning as the parts that stay on the calendar.

## Decisions

- **Platforms:** iOS first. Android compiles and stays green in CI but isn't polished or submitted.
- **Scope of the first release:** play lessons, sign in, Explore, profile and streak. Matches the website.
- **Stack:** Expo (SDK 58 at the time of writing), Expo Router, NativeWind for styling, React Native Reusables for the shadcn-shaped component kit, Reanimated for motion, Gesture Handler for drag, `expo-haptics`, `expo-av` for the ninja's voice and sounds, `react-native-svg` for the drawn renderers, `react-native-webview` for lesson visuals, and formulas drawn as SVG by MathJax on the server (phase 1 chose this over a MathJax view on the device).
- **Location:** `apps/mobile` in this repo. The DOM-free parts of `packages/player` move to a new `packages/player-core` that both players import.
- **Native features in the first release:** offline cache of recently opened lessons, push notifications when a streak is at risk, share sheet and deep links for `learn.ninja/l/{slug}-{id}`, a home screen widget with the streak and today's lesson.
- **Switching to Tamagui later** is a two-to-three-day mechanical rewrite of class strings, kept cheap by three rules: tokens live in one file that the NativeWind config reads; components stay thin on top of React Native Reusables; animation goes through Reanimated, never through NativeWind's class-driven animation.

## Why Expo is cheaper than it looks

`prepareLesson()` (`packages/player/src/prepare.ts`) runs KaTeX, Shiki, Observable Plot, D2, and OpenChemLib at publish time and stores the output with the lesson. The app never bundles any of them: code arrives as Shiki tokens that map to styled `Text` runs, charts, diagrams, and molecules arrive as SVG strings for `react-native-svg`, visuals arrive as HTML plus the compiled Tailwind CSS in `prepared.visualsCss`. Formulas arrive the same way: `GET /api/lessons/{id}` adds `mathSvg`, each formula in `prepared.math` drawn by MathJax on the server when the lesson is read.

## What carries over, what gets rewritten

Carries over unchanged, imported from shared packages:

- `@workspace/spec`: schema, validation, the 0.2 to 0.3 upgrade.
- `player-core` (carved from `packages/player`): `check.ts`, the logic in `progress.ts` without its localStorage calls, `random.ts`, `keys.ts`, `strings.ts`, every file in `locales/` including the ninja's lines and voice clip manifest, `prepared.ts` types, the chart, diagram, curve, and molecule checkers.
- The server: publish API, Better Auth, Explore, progress, likes, MCP.

Rewritten for React Native (the 18 DOM-bound files, about 10k lines):

| Area | Web today | App |
|---|---|---|
| Shell and player (`lesson-player.tsx`, `shell.tsx`) | React Aria, Tailwind, CSS motion | Expo Router screens, NativeWind, Reanimated |
| Nine question katas (`katas.tsx`, `sort.tsx`, `order.tsx`, `spots.ts`) | Pointer events, DOM drag | Gesture Handler plus Reanimated drag |
| Rich text (`rich-text.tsx`) | KaTeX HTML, Shiki spans | Shiki tokens as `Text` runs, the server's MathJax SVG for math |
| Visuals (`visuals.tsx`) | Sandboxed iframe, CSP | `react-native-webview`, scripts off, navigation blocked, CSP via injected meta, same tests as `visuals.test.ts` |
| Map, chess, figures, charts, diagrams, molecules | Inline SVG | `react-native-svg` with the same paths |
| Ninja, streak, wrap-up, creator, briefing | CSS animation, Web Audio | Reanimated, `expo-av` |
| UI kit (`packages/ui`) | shadcn on React Aria | React Native Reusables, Nova look |

Server additions: `GET /api/lessons/{id}` returning the prepared lesson as JSON (today only PUT, PATCH, and DELETE exist; the page renders server-side), a device token endpoint, and a daily job that sends the streak push.

## Phases

| Phase | Scope | Days |
|---|---|---|
| 0 | `apps/mobile` scaffold, monorepo wiring, `player-core` carve-out, lesson GET endpoint, tokens file, dark theme | 2 to 3 |
| 1 | Shell, concept kata, rich text with math, visuals in WebView, progress synced to the API | 3 to 4 |
| 2 | All nine question katas with idle, wrong, correct, and revealed states; every SVG renderer | 4 to 5 |
| 3 | Ninja animations and voice, streak, wrap-up, sounds, haptics | 2 to 3 |
| 4 | Sign-in, Explore, profile, deep links, share sheet, settings, all locales and RTL | 2 to 3 |
| 5 | Offline cache, streak push with its server job, home screen widget (Swift), store assets, TestFlight | 4 to 5 |
| | **Total** | **17 to 23** |

Phase 0 ends with a running app that plays one concept kata from a real published lesson. Stop there and look before continuing: it answers most of the questions about the rest.

## Where it stands

Done:

- **Phase 0** (PR 218): the scaffold, `player-core`, the lesson GET endpoint, tokens, concept katas with HTML and code visuals.
- **Phase 1**: the lesson shell as the web draws it on a phone (the way home, the title on the intro and the progress bar after it with the question count and time behind a tap, the tray with a full-width Continue, the light haptic), screens moving with the web's motion in Reanimated, lesson text at the web's medium size (`LESSON_TEXT_SCALE` in `tokens.ts`). Inline and display formulas from the server's MathJax SVG (`apps/web/lib/publish/math-svg.ts`), set on the text's baseline at KaTeX's 1.21 size. HTML visuals sized to their content by the app's own Expo module (`apps/mobile/modules/visual-height`: an off-screen WKWebView with the page's scripts off, read once in WebKit's isolated world), capped at 2400, measured a screen ahead. Progress kept per lesson in `expo-sqlite/kv-store` through `player-core/progress.ts`, under the web's keys and fingerprint check, and synced to `PUT /progress` and `POST /complete` for published lessons. Screenshots: `plans/ios-app-phase1-*.png`.

Not done:

- **Question katas** (phase 2): they show a placeholder and Continue steps past them unanswered, so the fix round never starts and the wrap-up has no score. The app's reducer (`apps/mobile/src/lib/play.ts`) has only `next`, `restart`, and `resume`; the web's `check`, `retry`, `startFix` and the rest come with the katas.
- **Charts, diagrams, maps, molecules, figures, chess, and chat visuals** (phase 2): placeholders.
- **Sync needs sign-in** (phase 4): the progress and complete endpoints answer 401 without a session, so the app sends one request, gets 401, and stops for the session. Nothing reaches a profile until the app signs in.
- **The lesson menu and settings** (phase 4): no Share, Restart, text size, sound, or language in the header yet; the wrap-up offers Restart lesson in the tray until phase 3 brings its own.
- **Visual height on Android**: the measuring module is iOS only, so Android keeps the 240-point default.
- Running against a local server: start it with `npm run dev` (its `predev` builds `public/lesson-visuals.css`; without it visuals lose Basecoat and their text is dark on dark), and point the app elsewhere than port 3000 with `EXPO_PUBLIC_API_BASE_URL`.

## The user experience rule

The styling layer doesn't change how the app feels. These do, and every kata ships with all four before it's called done:

1. Its transition in Reanimated on the UI thread.
2. Its haptic: on correct, on wrong, on drop, on a streak milestone.
3. Its gesture tuned on a real iPhone, not the simulator.
4. A side-by-side check against the same kata's Storybook state on the web.

## Risks

- **Pixel parity.** The same lesson is seen on both players. Storybook gives a reference for every kata state; matching it is the slow part.
- **Visual sandbox.** A WebView has more surface than an iframe. Pin `javaScriptEnabled: false`, block every navigation, inject the CSP, and port `visuals.test.ts` so the pins can't regress.
- **App Store review.** A first submission often gets one rejection. Offline lessons and the widget are the answer to guideline 4.2 (minimum functionality).
- **Two players.** Spec changes and new kata types land twice. `@workspace/spec` and `player-core` limit it; keep both players in the same PR when the spec changes.
- **Parity drift.** The web player moves while the port happens. Budget a day of catch-up at the end.
