# iOS app bug hunt, 2026-11-04

A pass over the iOS app (`apps/mobile`) as a learner uses it, on the iPhone simulator against the local web app, compared screen by screen with the web player at the same width (402 points) and its Storybook stories. Screenshots of each bug are in `plans/bugs/`, numbered as below.

**Phase 2 was already merged.** The brief expected the question katas in an open PR. They had landed on main as PR 225 before this pass began, so they were tested here as merged code, and the fixes are on this branch. Nothing was posted on PR 225.

## Where and how

- iPhone 18 Pro simulator, iOS 27.2 (the first one, on another runtime, disappeared mid-pass when its runtime was cleared to free disk space; the second is the same model). A debug build from `expo run:ios`, Metro, and `npm run dev` on port 3000. The web reference: `/lessons/{slug}` at 402 × 874 and Storybook in dark.
- Published test lessons were made locally through `POST /api/lessons` (PGlite) and opened by deep link (`ninja.learn.app://l/{slug}-{id}`): two order katas in a row, an Arabic lesson (the Storybook fixture), and button hierarchy with its visual cards moved up.
- `npm run check` is green (24 of 24 tasks).

## What was tested

| Area | Covered |
|---|---|
| Lessons | Compound interest to the wrap-up (hint, wrong, Try again, Why?, revealed, the fix round, the streak screen); button hierarchy to its last question (visual compare, HTML hotspot, sort, visual order, visual multi-select); map vs forEach to the wrap-up and Restart (code visuals, code blank, code hotspot, two-group sort, scenario); Spanish greetings (warm-up miss, match with a slip); correlation (hook with a chart, HTML hotspot); writing a PRD's katas (in the two-orders copy: compare, multi-select, two orders, scenario with Rewind and Every path); bronze age to its map concept |
| Phase 1 | Formula visual, HTML visuals with and without a declared height, code visuals, long concept bodies, the progress bar's details (count, fix round, time), the close button, resume after closing and after killing the app, progress sync |
| Phase 3 | The intro's entrance and smoke, Start's vanish, Restart, the streak screen on the day's first finish (and not on the second), the wrap-up's score, run bar, streak card, and takeaways |
| Progress | `PUT /api/lessons/{id}/progress` is sent once for a published lesson, answers 401, and nothing more is sent (no further PUT, no `/complete`): as designed until sign-in |
| Edge cases | Dynamic Type at accessibility XL; reduced motion; an Arabic lesson; background and foreground mid-question; the server down while opening a lesson, then back; a lesson that doesn't exist; quick double taps of Start and Continue; tapping during a slide |

## Fixed on this branch

| # | Bug | Commit |
|---|---|---|
| 1 | Every size in the app was 7/8 of the web's: NativeWind's native rem is 14 points, so `p-4` was 14, the tray button 42 tall, a visual's window 252 instead of 288. Now 16, with a test on the Metro config. | `c5bbcde` |
| 2 | Tapping a word in any blank kata gave a red screen (development builds): `shadow-none` on a used chip adds Tailwind 3's shadow variables, and NativeWind's upgrade warning threw while printing the props. Release builds would have remounted the chip. Class removed from the katas, with a test that keeps it out. | `cfa08dc` |
| 3 | The intro's title ran its words together ("Buttonhierarchy"): each word is its own text and iOS drops a line's trailing space. A no-break space now; tested. | `afa4124` |
| 4 | An HTML hotspot's tiles (which parts can be tapped) were timed from the kata's arrival, and the WebView takes 1.5 to 5 seconds to draw, so they were gone before the visual showed. Now timed from the load, and nothing is drawn over the empty frame. | `38a52d7` |
| 5 | A sort card dropped on a bin landed in the bin below (or back on the deck from the last): the card and the bins were measured in different parents. Both now in the kata's coordinates; tested. | `842b9fc` |
| 6 | An order kata's visual items were blank cards: a plain visual's stage had no width, and inside a tile that centers its content it shrank to zero. | `c867e15` |
| 7 | Toggling Sound on the streak screen lit the lantern again: another heavy tap and its lighting sound. The lighting now runs once and the sound follows the setting. (Not audible or felt on the simulator; for the device.) | `f4d37fe` |
| 8 | The wrap-up kept an empty tray, a dark strip at the foot of the screen; the web hides it on a phone. | `998e56f` |
| 9 | Lesson screens weren't keyed, so two katas of a kind in a row (two orders, two sorts in a fix round) shared the first one's local state; the order kata would look up the first kata's item ids in the second and throw. | `71af3af` |
| 10 | While a lesson loaded or after it failed there was no header: no way home but the edge swipe, no way to retry. Close shows on both; Try again on a network or server failure (not on a missing lesson). | `e8f174f` |
| 11 | A captionless option card stretched by a taller neighbour showed a band of its own fill under the visual's panel. | `dc2b675` |
| 12 | An inline code chip split across lines and left an empty grey box at the end of the first: its padding was plain spaces. | `4d5cfd0` |
| 13 | With a larger text size, the tray's buttons (fixed at 48) cut their labels off. They grow now. | `0efcb0b` |
| 14 | A quick double tap of Continue skipped the concept it opened (the second tap left it as it arrived; at once under reduced motion). A new screen now ignores Continue for 350 ms; tested. | `47bb71e` |

## Open, with a recommendation

1. **Right to left isn't mirrored** (phase 4 in the plan). In an Arabic lesson the close mark, the progress bar's fill, the eyebrow, and the tray's feedback line stay on the left while the prompt and options align right. Recommend `direction: "rtl"` on the player's root view for an RTL lesson (Yoga flips rows and `start`/`end`), and the screen slide reading the lesson's direction instead of `I18nManager.isRTL`.
2. **HTML visuals are slow to appear.** A WebView takes 1.5 to 5 seconds to paint; until then the window is empty (worst on a hotspot, which also measures its parts). Option cards and order items aren't measured ahead (only a concept's visual is), so they open at 240 and jump to their height. Recommend measuring a question's visuals ahead like a concept's, and fading a frame in on its load.
3. **The marked answer can sit under the tray** after a check, when the tray grows (seen on map vs forEach's scenario). Already a known gap in the plan; recommend scrolling the marked answer into view when feedback opens.
4. **The offline error is raw**: "fetch failed: Could not connect to the server.", in English. Recommend a player string for "couldn't reach learn.ninja" in every locale. The lesson and home fetches also have no timeout, so a server that never answers leaves a spinner forever (Close now gets out of it); the home screen has no retry.
5. **VoiceOver doesn't hear a checked answer's mark**: the badge is hidden from accessibility and nothing replaces it (the web adds screen-reader text). Recommend adding "correct" / "wrong" to each option's label after a check.
6. **iPad and App Store**: `supportsTablet: true` with portrait only. App Store validation requires an iPad app to support all four orientations for multitasking or to set `UIRequiresFullScreen`. Decide before phase 5's TestFlight.
7. **The font is San Francisco, the web's is Inter**, so lines break differently (the intro's title fits one line in the app and wraps on the web). A design call: SF is native; Inter would match.
8. **`shadow-xs` doesn't exist in Tailwind 3**, so cards and controls draw no shadow (the web's is 5% black, faint on dark). Metro also repeats the advice "has a shadow set but cannot calculate shadow efficiently" for views with a shadow on a translucent fill. Recommend defining `shadow-xs` in the tokens or dropping the class, and giving shadowed views a solid fill.
9. **Order kata layout shifts**: a placed visual item is about 20 points taller than an empty slot, so everything below moves as items are placed, and the pool's dashed spaces shrink once placed.
10. **The ninja's lines repeat after reopening**: the line picker is seeded by title and run, so closing and reopening a lesson (or relaunching) replays the same lines. The web does the same on reload. Minor.
11. **The progress details stay open** from one screen to the next until tapped again. Minor; the web's tooltip closes on its own.
12. **Code answers** show as inline code chips in the app and as plain monospace on the web. Minor.
13. **Console**, besides the shadow advice: `ImageBackground is deprecated` (from a library, not the app), `UIApplication statusBarFrame` deprecated (native), CoreMedia `FigFilePlayer err=-12864` on opening a lesson (the simulator's audio, likely harmless), and Reanimated's development-only notice that reduced motion is on.

Not bugs: taps sent less than about 100 ms apart by the simulator tool were sometimes dropped, but never at human speed (250 ms); Fast Refresh blanks the intro until the lesson is reopened (development only).

## Not tested here: for Colin on a device

- Haptics (the light tap, success and error, the streak's heavy tap) and the silent switch.
- Sound: the ninja's voice and the effects. The clips are served (200) and preloaded, but the simulator can't be heard here. Muting with the Sound toggle mid-line, and the streak screen's sound after fix 7.
- Real touch: the sort drag, the order drag, match, and blank chips under a finger (the simulator's drags worked after fix 5).
- Memory pressure with a visual on screen (the WebView's reload on `onContentProcessDidTerminate`), Network Link Conditioner, and airplane mode mid-voice: no simulator control from here.
- The streak across days (changing the clock), Challenge friend's share sheet, VoiceOver itself, Japanese or Hindi UI strings, and landscape (the app is portrait only). The iPad simulator wouldn't take input; its home screen laid out correctly.
- Drawn visuals not reached: diagrams, figures, chess, molecules, and chat.
