# Stageshow: where product illustrations would help learn.ninja

Analysis written on 2026-11-01, before adding anything. Stageshow (`npx skills add benjitaylor/skills --skill stageshow`, MIT) is a skill plus a small React and CSS kit for **authored product illustrations**: a believable, simplified interface framed like a marketing shot, as a still or a 10 to 16 second loop in which a cursor does one thing. It ships framing and motion rules, gold examples to copy from, a kit (`Stage`, `Window`, `Phone`, `Thread`, cursors, `Roll`, `Stream`, `Fly`…), and a filming script that renders contact sheets so the agent can check its own work. It is not browser automation: a scripted `a.click()` draws the cursor pressing and `a.set()` changes the scene.

The kit is about 10k lines of TypeScript and plain CSS (860 KB on disk, 3 MB with examples and the playground), needs only React 18+ and `lucide-react` (every icon it imports exists in our 1.52), has no animation runtime, scopes every selector under `.ss-*` (nothing clashes with Tailwind's preflight), pauses offscreen, and shows a chosen `poster` frame under reduced motion.

## The gap it fills

**The site never shows the product.** The home page is a headline, a copy button, agent logos, the FAQ and "Get started"; the docs are prose and code; the link preview and the `brand/` share images are text cards. The one visual the site has is the real thing, a playable kata through `KataPreview` in the docs, and that covers only half the product. The other half, the agent side (a prompt in a chat or terminal, the agent writing and checking, a link coming back, the lesson opening on a phone, "keep it" and the log-in prompt), can't be embedded for real and is exactly what stageshow is for.

So the rule for where it belongs: **stageshow for the flow and the agent side; the real player for the lesson itself.** Never a faux kata where a real `KataDemo` could play.

## Where to use it, ranked

### 1. A hero product shot on the home page

The highest-value spot: the one place a visitor decides what learn.ninja is, and today it's words only. The story is the product's whole promise in one loop: a prompt goes into an agent, a link comes back, the lesson plays on a phone.

- **Layout:** `device-pair` (a window inset top and left, a phone straddling the right edge), or `hero-demo` (corner bleed, a satellite). Dark theme, mono palette, our tokens. A `compact` design at 358 for phones, which is most of the traffic a shared link brings.
- **Beats (12 to 14 s, loop):** the prompt is typed and sent (`Stream`); a short "Checking…" line; the link `learn.ninja/l/how-compound-interest-works-k3x9a2mq` lands as a chip; the phone shows the title screen, then the first choice kata; a finger taps an option and it turns correct. Poster: the link on screen and the phone on the correct answer.
- **Ties to the CLI/MCP picker:** the window's chrome can follow the setup toggle, `chrome="terminal"` for CLI and a chat thread for MCP, so the picker that already exists changes the picture too.
- **A design decision to make first:** the home page is deliberately spare, one column of type. A product shot changes its character. Build it in a spike and judge the hero with and without it at real size before committing.

### 2. Share and launch images from the same still

Nearly free once the hero exists. `film.mjs --still` renders a clean PNG at any size, so the GitHub social preview (1280×640), the X header (1500×500) and the square post (1080×1080) in `brand/` become product shots instead of text cards, and the same still serves the Claude connectors directory, skills directories and launch pages. The live `/opengraph-image` routes stay as they are: next/og (satori) can't run the kit, and the per-lesson previews are right as text cards anyway.

### 3. Docs flows that prose explains badly

The docs are MDX and already host React demos (`KataPreview` through `mdx-components.tsx`), so a `<Stage>` per section is the same mechanism. Three places where a picture would cut support questions:

- **Keep a lesson** (`docs/keep.md`, "Say keep"): the chat shows the agent's "lasts 7 days" line, the log-in card, the popup, and "Saved to @handle. It's private." Gold: `ai-cards` (a card answered in the thread and kept as the record). Still or `once`.
- **The Claude.ai connector dialog** (`docs/reference/mcp.md`): a close-up of the Authentication control with "Sign in when needed" chosen, one leader line to the warning. This is the one wrong click that makes keeping fail, and a still says it faster than the numbered step. Gold: `close-up` or `panel-annotation`. Draw a generic dialog with the exact labels, not Claude's identity (the skill's product-study rule).
- **Skill or MCP?**: a terminal and a chat side by side, the same link out of both. Gold: `window-row`.

Each needs a text fallback: `pageMarkdown` in `apps/web/lib/llm.ts` swaps `KataPreview` for the kata's JSON when a docs page is served as Markdown, so a stage component gets the same treatment (a one-line caption or nothing), and in the browser the stage is wrapped in `role="img"` with an `aria-label` since the kit marks only its cursor `aria-hidden`.

### 4. A "How it works" grid on the home page (optional)

Three or four tiles between the hero and the FAQ: give it anything (a file dropped into a chat, `upload`), one short lesson (screens as one object on a phone, `phone-touch`), a link to share (`share` or `corner-chip`), keep and publish to Explore (`many-of-one` of lesson rows, one in focus). Golds `dark-bento` and `ruled-bento`. Worth doing only if the hero shot proves the home page wants pictures at all; it adds a section the page was designed without.

### 5. Not worth it

- **Empty and terminal states** (Explore's "Nothing here yet", the expired-lesson page, 404): the text does the job; a decorative still there is cost without a story.
- **Inside the player or a lesson:** lesson visuals are sandboxed HTML with no scripts, and the player is the real UI.
- **In place of `KataDemo` anywhere.**
- **Video:** filmed loops could seed TikTok and YouTube clips, but that's the HyperFrames skills' job, not stageshow's.

## How it would fit the codebase

- **Where the kit lives:** copy `kit/` into `packages/stage` (or `apps/web/components/stage/`), minus `kit/brands/` (third-party marks under their own licenses; we have our own agent logos in `public/agents/`). Install the skill globally (`-g`) rather than into the repo: the examples and playground are 1.5 MB that only the agent reads, and the skill's own loop (copy a gold, film, compare) runs from its install folder. The `scripts/` filming tools need `playwright-core` and a local Chrome; `@playwright/test` is already a dev dependency.
- **The look file:** `apps/web/lib/og.tsx` already holds the dark theme as fixed hex values (page `#171717`, window `#1f1f1f`, card `#262626`, border `#2e2e33`, text `#fafafa` / `#d4d4d8` / `#a1a1aa`), which is exactly the token map a look needs. Inter and Geist Mono for `--ss-font` and `--ss-mono`; our radius scale (10 / 8 / 6 px) matches the kit's defaults; `--ss-control` 28 for the `sm` buttons and 36 for the tray pills; `palette="mono"` since the brand's primary is white. Dark only, since production forces dark.
- **Stories first:** each stage gets a Storybook story (the project rule), and the skill's `REHEARSAL.md` note sits beside the component. Film against the gold at the shown width and at 390 before it goes on a page.
- **Weight:** a demo ships its own code plus the kit parts it uses, tree-shaken, on the order of a few tens of KB gzipped. Load the hero with `next/dynamic` and render the poster state on the server so the first paint is the still. Keep the real `@workspace/player` out of the home page: a faux kata built from `Row` with our tokens is enough there, and the real one belongs in the docs.
- **Honesty:** the illustration must match the real product: the ninja mark, the link format, the player's chrome and the kata controls. Keep each stage to 3 to 7 real strings so it drifts rarely, and re-check the hero against the live player whenever the player's look changes.
- **Cost:** the skill's workflow is deliberately heavy (plan, copy a gold, film, compare, fresh-eye review). Budget half a day to a day of agent time per illustration, not an hour.

## The hero spike (2026-11-01)

Built in `spikes/stageshow/` (git-ignored): the whole skill copied there with its playground, and the scene in `examples/learn-hero/`. The playground runs from the `stageshow` entry in `.claude/launch.json` on port 5177; `?example=learn-hero` plays it, `?capture=learn-hero` is the filming route.

**What it is.** A 720×440 stage (the home column's width) with a compact 358×600 design below 600. A terminal pinned top-left and off the bottom; a phone straddling its right edge showing the player's first question. Beats: the prompt "make me a lesson about compound interest" is typed; three steps tick (Wrote 7 katas, Checked, Published); the link lands with "Lasts 7 days. Say "keep it" to save it."; a finger taps $1,950 and it turns green. The payoff holds, the exchange folds away, the phone's kata fades like a reload, and it loops at about 16 s. The poster (reduced motion, thumbnails) is the finished frame. `film.mjs --gate` passes at the wide size; `examples/learn-hero/REHEARSAL.md` lists what was simplified and what wasn't checked.

**What it taught.**

- The look maps in one file: the dark values from `og.tsx`, our radii, mono palette. The phone screen is a faithful copy of the live player at 375 wide, so it reads as learn.ninja, not a generic app.
- The terminal is the honest default: the picker defaults to CLI, and a terminal needs no product identity (no Claude Code box). The MCP variant (`setup="mcp"`, played as `learn-hero-mcp`) swaps it for a chat window with the same beats, so the page's CLI/MCP toggle can remount the demo with the other setup. The lesson shown is git basics, a builder's example.
- A cropped phone can't show the tray, so the illustration skips "Check answer" and the feedback line. If that matters, the stage must be about 720 tall, which is too much for a hero.
- The empty lower half of the terminal is the one composition question left; a shorter stage or a second satellite would fix it, but both cost calm.
- Loop or once is open. The typing headline above already moves; a loop under it may be busy. The scene supports both with one prop.

**Shipped to the page the same day:** the kit is vendored in `apps/web/components/stage/kit/` (README there), the scene is `apps/web/components/home/hero-demo.tsx` with its stylesheet, story and rehearsal note beside it, and the hero renders it under the copy, keyed on the CLI/MCP toggle. It is server-rendered (the opening frame is in the HTML) and the stage is framed like the site's windows (a fade at its foot was tried and dropped). The home page is forced dark in development too, since the shot is judged on its ground. Later changes go through the playground copy in `spikes/stageshow/examples/learn-hero/`, filmed with the skill, then back here.

## Suggested order

1. Spike the hero in `spikes/` (git-ignored): copy the kit, write the look file from `og.tsx`, copy `device-pair` and `hero-demo`, film both beside the golds, and look at the home page with and without it.
2. If it stays, move the kit into the repo with a story, wire the CLI/MCP chrome switch, and re-render `brand/` from the still.
3. The keep flow and the connector close-up in the docs.
4. The "How it works" grid only if the page wants more pictures after step 2.
