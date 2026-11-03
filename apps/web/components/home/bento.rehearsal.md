# Bento rehearsal

Written 2026-11-01 for `bento.tsx`, built with the stageshow skill (see `components/stage/README.md`), filmed on the real home page at `localhost:3000` with the skill's `film.mjs` (the playground has no copy of it: two of the tiles draw the player's own visuals, which only the web app can render).

## The gold

`bento` for the set (hero and strip, one window, each picture its own Stage pinned to its tile, one beat per tile once in view, 110ms apart) and `dark-bento` for the look (depth from a lighter surface, one lit color). The tile plan:

| Tile     | Span  | Kind       | The one thing                                                         | Moves                               |
| -------- | ----- | ---------- | --------------------------------------------------------------------- | ----------------------------------- |
| Kata     | 2 × 1 | Hero UI    | a word chip lands in the gap, Check turns it green, the sensei cheers | the chip flies, the tray goes green |
| Agents   | 1 × 1 | Collection | agent and chat-app marks, off the right and bottom                    | the marks settle in                 |
| Subjects | 1 × 1 | Collection | real lesson drawings on cards, off the right and bottom               | the cards settle in                 |
| Streak   | 1 × 1 | Stat       | today's lantern lights, 11 becomes 12                                 | the lantern lights, the count rolls |

Across and down, no kind sits next to itself; the kata card is the only window. The pillars Colin named (interactive, any tool, any subject, any language, gamification) are the four tiles; "any language" is a card in the subjects tile (an Arabic question, right to left) rather than a tile of its own, and "free" stays in the hero's subhead. The ninja appears once, in the kata's feedback.

## The second pass (2026-11-02)

The grid became two halves over three thirds, by what a visitor most needs to see first:

| Tile     | Span | Kind       | The one thing                                                                   | Moves                                                           |
| -------- | ---- | ---------- | ------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| Kata     | ½    | Hero UI    | the wrong chip is checked and the ninja says why, then the right one goes green | the chip flies and goes yellow, the note shows; then it's right |
| Subjects | ½    | Collection | real lesson drawings on cards, off the right                                    | the cards settle in                                             |
| Agents   | ⅓    | Collection | agent and chat-app marks, off the right and bottom                              | the marks settle in                                             |
| Share    | ⅓    | UI         | a lesson link, and that lesson open on a phone off the bottom                   | the phone rises                                                 |
| Activity | ⅓    | Stat       | the profile's activity grid, its last 26 weeks off the start edge, today's cell | today's cell fills, the streak count rolls                      |

- The kata shows a miss before the right answer: explanatory feedback on wrong answers is what the skill requires of every lesson and what sets a lesson apart from a summary or flashcards. The miss follows the player: the chip and Try again in yellow, the ninja's nudge from the English voices in a yellow bubble, the option's feedback in the amber note under the answers. The desktop card grew to 304 (the stage to 340) to hold the note. The phone shows the feedback as its tray's line instead of the note (the ninja's nudge is left out there), so its kata keeps no empty room and the stage stays 330.
- "Any language" left the bento for now (the Arabic card is gone; the FAQ still says it), and the subjects tile moved up to a half, the width it needs for two full columns of drawings.
- The streak lantern gave way to the activity grid, the picture the profile already draws; the streak count stays as its stat.
- Between 640 and 900 of grid width a half is too narrow for the desktop card, so the kata and subjects each take the full width there and the three small tiles pair up.
- One crop rule: every picture keeps the tile's 24px inset at the start and top and may run off only the end or the bottom (the activity grid's oldest weeks off the start), and fades out over 56px there (`.bn-pic[data-fade]`), so a cut reads as deliberate.
- One lit color per tile: the activity grid is the ink at five strengths here, with only today's square in the lantern's color.
- Each tile shows a muted line under its lead, so the point is stated, not only pictured.
- The share tile's phone is drawn near the kata's scale (13px text), so the two lessons don't sit side by side at different sizes.
- The hero gained a "Try a lesson" button (the Spanish greetings the kata comes from), so a visitor can play one before installing anything.

## What changed from the gold

- The grid is wider than the page's text column (984, the gold's width, in a 1032 section) while the heading keeps the column, so the pictures leave the text's bounds; below 1032 the grid is the column's width, and below 640 it stacks. At the wide width the agent marks run five columns and the subject cards grow to 210, so both still run past their tile's edge.
- Each tile carries its lead alone ("One screen at a time."); the continuation is read only by assistive tech.
- The tiles are the site's cards (`bg-card`, `rounded-xl`, a foreground ring) rather than the gold's light gray tiles, and the copy is the site's type (`text-base sm:text-lg`, a semibold lead and a muted continuation).
- The grid lives in `bento.css` with container queries (stacked below 640, hero and strip above), not Tailwind's container variants, which didn't apply.
- The kata hero has two designs in the HTML and CSS picks one at 420px of tile width: the desktop lesson card (inset 24 left, 12 top, off the right by 60, the tray along its foot a gutter above the edge) and the phone player (the screen is the stage: header, kata, the tray that takes the answer's green). Both play the same script with their own cursor (arrow, touch), so a phone never sees the desktop card first.
- The subjects tile's drawings are the player's own (chess, map, chart, molecule), drawn once by `npm run bento -w web` into `bento-visuals.generated.json`, so the page ships none of the map data or chess pieces.
- The activity tile is page markup in the grid's own `bg-activity-*` tokens, its days a fixed pattern (no randomness, so server and browser agree); the count is the kit's `Count`, lit on scroll-in.

## Simplifications to know about

- The desktop tray has only the Check pill; the real tray's Sensei, text size and sound controls would be cut by the crop, so they're left out rather than sliced.
- The sensei's line sits beside him in the card's lower-left, not above him as the player draws it: the card is 304 tall and the bubble needs the room.
- After Try again the wrong word goes back to the bank at once, without a flight home.
- The chips' number keys stay in the chips after checking (faded out), as the player keeps their room; the flyer carries a hidden key for the same reason, so it leaves and lands at one size.
- The word's comma sits 6px from the chip (the player's 2px reads as touching on film).

## Filmed

`spikes/stageshow/shots/bento/`: `loop-1280.png` and `loop-390.png` (14 frames at 500ms, the whole once-story of each design), `still-1280.png`, `still-390.png`.

Gate lines that stand:

- `kit override: .ss-phone…` on every stage: the hero demo's `hero-demo.css` restyles the kit's phone parts page-wide; not this component's, and present before it.
- `appears with no entrance` / `vanishes with no exit` on the flyer and the placed word: the `Fly` handoff, which the skill lists for manual review. Watched at 50ms: the flyer takes the chip's surface as it lifts and the real word shows the frame it lands.
- `data-ss-verification-stage` hydration warning: film's own attribute, added before React hydrates.

## Not checked

- The loop in Safari and on a real phone (touch, not emulated).
- Reduced motion on the real page (the poster is the right answer, checked; `useInView` reports seen at once under reduced motion, so the marks, cards, phone and today's cell show settled).
- Light mode: production forces dark, and the stage's look is dark fixed values; the tiles outside the stage use theme tokens and would follow a light page.
- Bundle weight of the generated visuals (117KB of JSON before gzip, most of it the map's outlines at one decimal).
