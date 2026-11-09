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
| 15 | HTML visuals were slow to appear (open item 2): option cards and order items weren't measured ahead, so they opened at 240 and jumped. The next screen's HTML visuals are now measured at the widths they'll be laid out at (a question's visual, each option card at the widths it can take, order items, a hotspot's parts), and a frame fades in once its document has loaded instead of popping in. Tested; `plans/ios-app-bugs-visuals.png`. | `38de93e` |
| 16 | The marked answer could sit under the tray after a check (open item 3). Marked controls register with the player, and 250 ms after a check (or Why?) the lowest of them scrolls up 12 points clear of the tray, never past its own top. Tested; `plans/ios-app-bugs-tray.png`. | `aa4f555` |
| 17 | The offline error was raw and English only, nothing timed out, and the home screen had no retry (open item 4). API requests give up after 15 seconds, body and all; a lesson, Explore, and the test lessons say "Couldn't reach learn.ninja. Check your connection and try again." (a new player string, in every locale) with Try again. Tested; `plans/ios-app-bugs-offline.png`. | `44ed0b6` |
| 18 | VoiceOver didn't hear a checked answer's mark (open item 5). Every answer control, and an HTML hotspot's parts, now carry the web's screen-reader words ("correct", "not right", "partly right") as their accessibility value, read after the label. Tested; not heard with VoiceOver here. | `3a035b4` |
| 19 | `shadow-xs` didn't exist in Tailwind 3, and Metro advised about shadows on translucent fills (open item 8). It's in the theme as the web's (5% black); control surfaces, mark tints, and pressed buttons are solid, and the clear states drop the shadow. No advice in Metro through a lesson. | `fafc9e5` |
| 20 | Order kata layout shifts (open item 9). Visual items are laid out at one width in the pool and in their slot, and every card, open slot, and dashed space is as tall as the tallest item, so nothing moves as items are placed. Tested; `plans/ios-app-bugs-order.png`. | `f73e2a4` |

Rows 15 to 20 were fixed on 2026-11-06, after phase 4, on `claude/ios-bug-pass-f3bdb6`, and checked on the iPhone 18 Pro simulator against a local server (test lessons published to it with the visual katas first and a long warm-up).

## Open, with a recommendation

1. **Right to left isn't mirrored** (phase 4 in the plan). In an Arabic lesson the close mark, the progress bar's fill, the eyebrow, and the tray's feedback line stay on the left while the prompt and options align right. Recommend `direction: "rtl"` on the player's root view for an RTL lesson (Yoga flips rows and `start`/`end`), and the screen slide reading the lesson's direction instead of `I18nManager.isRTL`.
2. **Fixed, row 15.** HTML visuals were slow to appear.
3. **Fixed, row 16.** The marked answer could sit under the tray.
4. **Fixed, row 17.** The offline error was raw.
5. **Fixed, row 18.** VoiceOver didn't hear a checked answer's mark.
6. **Decided 2026-11-09: iPhone only.** `supportsTablet: true` with portrait only would fail App Store validation (an iPad app must support all four orientations for multitasking or set `UIRequiresFullScreen`), so the first release sets `supportsTablet: false`.
7. **The font is San Francisco, the web's is Inter**, so lines break differently (the intro's title fits one line in the app and wraps on the web). A design call: SF is native; Inter would match.
8. **Fixed, row 19.** `shadow-xs` didn't exist in Tailwind 3.
9. **Fixed, row 20.** Order kata layout shifts.
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
