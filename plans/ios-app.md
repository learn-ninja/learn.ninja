# iOS app (Expo)

A native learn.ninja app that opens any shared lesson and plays it with the same katas, ninja, and streak as the web, plus sign-in, Explore, and a profile. Decided 2026-11-04. Estimate: about four to five weeks of agent-days, calibrated against this repo's own pace (the whole product, 78k lines, took four weeks), with App Store review and on-device tuning as the parts that stay on the calendar.

## Decisions

- **Platforms:** iOS first. Android compiles and stays green in CI but isn't polished or submitted. Where iOS uses its own controls (the lesson menu and Settings in SwiftUI through `@expo/ui`, the system's text prompt for the handle), a `.ios.tsx` file holds them and the plain `.tsx` beside it is phase 4's React Native version, so Android never loads them. Link previews and their menus do nothing off iOS, and only iOS has the see-through bar with a large title.
- **Scope of the first release:** play lessons, sign in, Explore, profile and streak. Matches the website.
- **Stack:** Expo (SDK 58 at the time of writing), Expo Router, NativeWind for styling, React Native Reusables for the shadcn-shaped component kit, Reanimated for motion, Gesture Handler for drag, `expo-haptics`, `expo-audio` for the ninja's voice and sounds (phase 3 chose it over `expo-av`, which SDK 58 no longer bundles), `react-native-svg` for the drawn renderers, `react-native-webview` for lesson visuals, and formulas drawn as SVG by MathJax on the server (phase 1 chose this over a MathJax view on the device).
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
| Ninja, streak, wrap-up, creator, briefing | CSS animation, Web Audio | Reanimated, `expo-audio` |
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
- **Phase 1** (PR 222): the lesson shell as the web draws it on a phone (the way home, the title on the intro and the progress bar after it with the question count and time behind a tap, the tray with a full-width Continue, the light haptic), screens moving with the web's motion in Reanimated, lesson text at the web's medium size (`LESSON_TEXT_SCALE` in `tokens.ts`). Inline and display formulas from the server's MathJax SVG (`apps/web/lib/publish/math-svg.ts`), set on the text's baseline at KaTeX's 1.21 size. HTML visuals sized to their content by the app's own Expo module (`apps/mobile/modules/visual-height`: an off-screen WKWebView with the page's scripts off, read once in WebKit's isolated world), capped at 2400, measured a screen ahead. Progress kept per lesson in `expo-sqlite/kv-store` through `player-core/progress.ts`, under the web's keys and fingerprint check, and synced to `PUT /progress` and `POST /complete` for published lessons. Screenshots: `plans/ios-app-phase1-*.png`.
- **Phase 2**: every question kata and every visual kind. The reducer moved to `packages/player-core/src/reducer.ts` and both players run it (the app binds the lesson in `apps/mobile/src/lib/play.ts`); `play.test.ts` plays every bundled lesson right first time, with one miss per kata, and with two misses through the fix round. The tray shows what the web shows on a phone after a check (`src/lib/feedback.ts`, pure and tested): the ninja's line and a note under it, the tray taking the tone, with Check, Hint, Try again, Rewind, Why?, and Continue, and the system's success or error tap. The katas (`src/components/katas/`): choice, compare, and scenario as rows or cards; blank's word chips on an underline as wide as the widest chip; match judged pair by pair; hotspots on HTML (the parts' boxes measured by the native module's second read, `measureSpots`, with the tiles and marks drawn over the frame since it runs no script), code lines, chess squares, and map countries; sort as the phone's deck with the card draggable into a bin; order by tap, or by dragging a placed item to another slot. The drawn visuals (`src/components/visuals/`): charts, diagrams, and molecules from the server's SVG strings through `react-native-svg`, themed by `src/lib/svg-theme.ts` (tested against the stories' prepared drawings); figures, the map (the same shapes and frame, now in `player-core`), the chess board, and chats natively. The wrap-up reports the score, the run bar, and the takeaways.
- **Phase 3**: the ninja, his voice, the streak, the wrap-up, sounds, and haptics. His character (moods, reactions per setting, idle life, entrance, send-off, `cueKindFor`) moved from the web's `ninja.tsx` into `packages/player-core/src/ninja.ts`, and the streak's rules from `apps/web/lib/activity` into `player-core/streak.ts`; the web imports both unchanged. The app draws him with `react-native-svg` from the web's shapes (`src/components/ninja.tsx`) and plays every mood's keyframes, transcribed from `globals.css` into `src/lib/ninja-moves.ts`, as Reanimated tracks; under reduced motion only the held poses and eyes change. The intro has his slot and entrance, the smoke behind it (the web's textures in `assets/smoke`, kept in step by `npm run smoke -w mobile` and a test), and Start vanishing it word by word (`src/components/smoke.tsx`). Sound is `expo-audio` in iOS's ambient session, so the silent switch mutes it (`src/lib/sound.ts`): his English lines stream from the web's `/voice/en/` with the next moment's loaded ahead, and the effects (the whoosh, the streak's lantern and flame, revived from `parked/streak-sounds`) are bundled. The Sound setting sits at the header's end and is kept in the web's `learn:preferences`, which also gives his character. The streak is kept on the device (`src/lib/streak.ts`): each learning day in `learn:days`, and a published lesson's finish under the web's `learn:finished:{id}` for sign-in to send. The day's first finish shows the streak screen before the wrap-up with a heavy tap; the wrap-up (`src/components/wrap-up.tsx`) has his send-off, the score from `State`, the run bar, Challenge friend through the share sheet, Restart, the streak card, and the takeaways.
- **Phase 4**: sign-in, Explore, profiles, links, the lesson menu and settings, every locale and right to left. The app signs in with the web's email code through Better Auth's Expo client (`src/lib/auth-client.ts`, the cookie in the keychain; the server adds `expo()` and trusts `learnninja://` in `apps/web/lib/auth/auth.ts`), from a sheet that matches `/login` (`src/app/sign-in.tsx`, the errors mapped by code in `src/lib/sign-in-errors.ts`). Every API request carries the session (`src/lib/api-fetch.ts`); signing in restarts the progress sync and resends what each open lesson missed (`progress-sync.ts`), and posts every kept `learn:finished:{id}` to `/complete` as the web's `sendFinishes` does (`src/lib/finishes.ts`), which carried a finish made logged out onto the profile. The web serves the app JSON for Explore (`GET /api/explore`, paged by a cursor on New) and a profile (`GET /api/profiles/{handle}?tz=`), with the pages' own queries and visibility (`apps/web/lib/explore/app-api.ts`). Signed in, the home is Explore with the web's rows, likes with a tap, pull to refresh, and paging (`src/app/index.tsx`, `src/components/explore/`); signed out, it's the call to log in over the test lessons, which development builds keep at Explore's foot. `/u/{handle}` is the profile with the activity grid in `react-native-svg`, its tabs, and the gear to Settings (handle, the app's language, Log out). Links: `applinks:learn.ninja` in `app.config.ts` and `/.well-known/apple-app-site-association` on the web (404 until `APPLE_TEAM_ID` is set); the `learnninja://` scheme opens the same paths. The header's end is the web's phone menu as a sheet (`src/components/lesson-menu.tsx`): Share (the system sheet with the web URL), Restart, the ninja, the text size (lesson text sizes are NativeWind variables now, `src/lib/text-size.ts`), the language (the web's rule: the chosen one, else the lesson's), and Sound, all in `learn:preferences`. New strings for the log-in, Explore, profile, and account are in every locale, with FormatJS's number and relative-time polyfills for Hermes. Right to left: each screen sets Yoga's `direction` and Text's writing direction (`src/components/direction.tsx`), so a screen mirrors at once without a reload; a lesson's content runs its own language's way under the player's (the web's `LessonContent`), and `I18nManager` follows the app's language from the next launch (`src/lib/direction-effect.ts`). Verified end to end on the simulator against a local server: sign-in, Explore, a like, a profile, the Arabic lesson by link played to its finish and Done on the profile with the day in the grid, each setting, the handle, Log out. Screenshots: `plans/ios-app-phase4-*.png`.

Not done:

- **On-device pass** (phase 3 follow-up): built without a simulator, like phase 2. To try first: the intro's entrance for each character (Sensei settles, Casual and Unhinged bounce), the smoke turning and the vanish on Start with its whoosh, each mood (the ninja's Storybook story on the web is the reference), a spoken line after a check, the silent switch muting it all, the Sound toggle, the streak screen and its lantern, flame, and heavy tap on the day's first finish, the streak across two days (a missed day spent from a rest day), the wrap-up's send-off and Challenge friend's share sheet. Known gaps against the web: no blur on the smoke words or the ninja's vanish (they skew and fade); a clip starts at its file's start, where the web skips the silence before its first sound; he shows only in the intro and wrap-up slots, as the web does on a phone, so the question feedback is his line and voice in the tray without his body (the call site is marked in `[slugId].tsx`); no ninja setting in the app yet (it reads the saved one; phase 4's menu sets it); the wrap-up lacks the challenge's verdict, the heart, and Keep learning, which need sign-in or the agent prompt.

- **On-device pass** (phase 2 follow-up): the session that built phase 2 had no simulator, so nothing above has been seen on a phone. To try first: each kata's gesture (the sort card's drag into a bin, the order drag, blank's chips, match's pairs, every hotspot kind), the haptics, and the four states (idle, wrong, correct, revealed) against the Katas stories in Storybook. Known gaps against the web, by design or to check: an HTML hotspot's other parts don't dim (the web dims them inside the frame); a scenario's brief is a plain screen, not the ninja's telling, and its rewind has no effect yet; the marked answer isn't scrolled back into view when the tray grows; a chart's text is drawn in the system font at the SVG's size; a diagram's Markdown labels (`foreignObject`) are dropped; a map's small-country tap goes to that country, not the nearest of several overlapping circles; the rest of a sort's lanes and the keyboard paths have no phone equivalent.
- **Phase 4 on a device**: universal links need the Apple Team ID (`APPLE_TEAM_ID` on Vercel, which fills the site association) and a signed build; on the simulator only the `learnninja://` scheme was tried. To try first on an iPhone: a `learn.ninja/l/…` link from Messages opening the app, the keychain session surviving a relaunch, iOS offering the emailed code above the keyboard, the like's tap, the share sheet's link preview, and an Arabic device launching mirrored.
- **Phase 4 gaps against the web**: no GitHub log-in (email codes only); Explore has no greeting, made-with logos, or the owner's row menu (publish, rename, delete) or Report; Settings has no picture, email change, or keys; the wrap-up still lacks the heart, Keep learning, and a Log in link for a learner who isn't; the streak screen counts the device's days, so a learner who also plays on the web can see a different number there than on their profile; `I18nManager`'s direction (the back swipe, the keyboard) changes only from the next launch, while every screen mirrors at once; the new strings' translations aren't native-checked (each translator chose a word for "kata" where the file had none).
- **Visual height and hotspots on Android**: the measuring module is iOS only, so Android keeps the 240-point default and can't tap an HTML hotspot's parts.
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
