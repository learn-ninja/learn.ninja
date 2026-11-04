# Hero demo rehearsal

Written 2026-11-01 for `hero-demo.tsx`, built with the stageshow skill (see `components/stage/README.md`). The skill's playground copy, where it is filmed, lives in `spikes/stageshow/examples/learn-hero/` (git-ignored); keep the two in step.

## The gold

Copied `device-pair` for the layout (a window pinned top-left and off the bottom, a phone straddling its right edge over the window's margin) and `hero-demo` for the terminal and the typed beat. Borrowed the touch cursor and the "fold back" seam from `phone-touch`. Dark with `palette="mono"`, as `dark-hero`: depth from surface steps, one lit color.

## Two setups

`setup="cli"` is the terminal; `setup="mcp"` (the playground registers it as `learn-hero-mcp`) is a chat window after the `ai-chat` gold: a past exchange as bars, the prompt typed into the composer and sent as a bubble, the three steps, the link and the note as the reply, the composer drawn after Claude's (a tall rounded box with "Reply" and a return key, a tool row and "AI can make mistakes." under it), 16px above the stage's edge and running under the phone, which covers its right end where Claude's model picker would be. Narrow, both windows are 300 tall and the thread is pinned to its foot, so the older turn scrolls up as the message lands. The beats, the phone and the seam are shared; the page's CLI/MCP toggle would remount the demo with the other setup. The lesson is git basics (prompt "make me a lesson about git basics", a question about staging a change), so the example reads as a builder's.

## What changed from the gold

- The window is a terminal (`chrome="terminal"`), the home page's default setup (CLI), not a dashboard. The text column stops 160px short of the terminal's right edge so the phone covers margin, never words.
- The phone shows the lesson player on a phone, drawn from a screenshot of the live compound-interest lesson at 375 wide: the 56pt header (mark, progress, menu; the Sign up pill was dropped on request), the "Warm-up" label, a 20pt question, 49pt options with 10px corners, the green border and check tile of a right answer.
- The look is the site's dark theme as fixed values (the same ones `apps/web/lib/og.tsx` uses) with Inter and Geist Mono; the playground falls back to system fonts, so the type will differ a little on the real page.
- The loop resets by folding the exchange away as one `Collapse` and fading the kata block out and in, like a page reload. `play="once"` with the same poster is the alternative if the loop reads as busy next to the typing headline.

## Simplifications to know about

- Tapping the right option turns it green at once. The real player needs "Check" in the tray at the bottom of the screen, which the crop hides; the tray with its feedback line and Continue is not drawn.
- The link is written without `https://` so it fits the column in one line. The agent prints the full URL.
- The three steps ("Wrote 7 katas", "Checked", "Published") paraphrase what the skill's CLI prints.
- The `ls` lines above the command are context, so the opening frame isn't an empty terminal.

## Filmed

- `shots/learn-hero-poster.png`, `shots/learn-hero-mcp-poster.png`: the reduced-motion posters of both setups at 720; `shots/learn-hero-poster-compact.png`, `shots/learn-hero-mcp-poster-compact.png` at 390; `shots/learn-hero-mcp-loop-compact.png` the compact chat loop.
- `shots/learn-hero-loop.png`, `shots/learn-hero-mcp-loop.png`: 20 frames at 800ms, the whole loop of each. `film.mjs --gate` ends `rehearsal passed` for both at the wide size.
- `shots/gold-device-pair.png`, `shots/gold-dark-hero.png`: the golds beside it.

## On the page

- The stage is framed like the site's other windows (rounded-2xl, a 1px ring, no fill), no fade: Colin's call, after seeing the faded version.
- `fill` is on: between phone width and 600px the compact design scales up to the column (Colin asked for it after seeing it small in a narrow window), and on a phone it scales down to fit.
- The hero remounts the demo on the CLI/MCP toggle (`key={setup}`), so a switch restarts the story in the other window.
- The whole stage is one `role="img"` with a label for assistive tech.
- Server-rendered: the opening frame is in the HTML, the script starts after hydration.

## Not checked

- The compact design still gets framing lines from the checker (the terminal inset 16 on three sides and bled off the right; the phone centered with 16px gutters). Not chased: the stacked composition is deliberate, but a fresh eye should judge it at 390 in the real page.
- The terminal's lower half is empty in the poster: a terminal looks like that, but it may want a shorter stage (400) once the real column width is known.
- The "touching" line on the caret is a terminal caret sitting after its text; deliberate.
- The seam frame (the phone with only its header for about half a second) was watched on the sheet, not at 60ms.
- Bundle weight was not measured.
