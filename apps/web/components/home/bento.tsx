"use client"

import * as React from "react"
import { Link2Icon } from "lucide-react"

import { cn } from "@workspace/ui/lib/utils"

import { logoMask } from "@/components/site/agent-logos"
import {
  Count,
  Fly,
  Stage,
  States,
  useReducedMotion,
  type Act,
} from "@/components/stage/kit"
import { AGENTS, SETUPS } from "@/lib/site"

import visuals from "./bento-visuals.generated.json"
import "./bento.css"

// The home page's feature grid (stageshow's bento, see components/stage/README.md): what a
// lesson is, in five tiles. Two halves over three thirds: the kata and the subjects on top, the
// agents, the link, and the activity grid under them. One picture is UI (the kata's lesson card,
// the only window); the rest are a collection of real lesson drawings, a collection of marks, a
// shared link on a phone, and a stat. Each picture is drawn at 1:1 inside its tile; the copy is
// page text over it. Every tile plays one beat, once, as the grid scrolls in, 110ms after the one
// before it in reading order.
//
//   Tile      Span   Kind         The one thing                               Moves
//   Kata      ½      Hero UI      the wrong chip is checked and the ninja     the chip flies, goes yellow, the note
//                                 says why, then the right one goes green     shows; the right chip flies, goes green
//   Subjects  ½      Collection   real lesson drawings, off the edges         the cards settle in
//   Agents    ⅓      Collection   agent and chat-app marks, off the edges     the marks settle in
//   Link      ⅓      UI           a lesson link, and the lesson on a phone    the phone rises
//   Activity  ⅓      Stat         the last weeks of learning, today's cell    today's cell fills, the count rolls

const STEP = 110
const LEAD = 450

/* ---------------- The grid ---------------- */

export function Bento() {
  return (
    // The heading keeps the page's column; the grid is wider than it (the stageshow gold's 984),
    // so the pictures leave the text's bounds, and steps back into the column where the window is narrower.
    <section
      aria-labelledby="bento-heading"
      className="mx-auto flex w-full max-w-[1032px] flex-col gap-10 px-4 pb-20 sm:px-6 sm:pb-28"
    >
      <h2
        id="bento-heading"
        className="mx-auto w-full max-w-3xl px-0 text-3xl font-semibold tracking-tight sm:text-4xl"
      >
        Learn by doing
      </h2>
      <div className="bn">
        <div className="bn-grid">
          <Kata />
          <Subjects />
          <Agents />
          <Share />
          <Activity />
        </div>
      </div>
    </section>
  )
}

/** One tile: the card look, a lead and one muted line at the top, the picture under them, cropped by the tile. */
function Tile({
  name,
  lead,
  children,
  picture,
  fade,
  className,
}: {
  name: string
  lead: string
  children: React.ReactNode
  picture?: React.ReactNode
  /** The edges the picture runs off, faded out (bento.css) */
  fade?: "end" | "bottom" | "end bottom"
  className?: string
}) {
  return (
    <div
      className={cn(
        "bn-tile relative flex flex-col overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10",
        className
      )}
      data-tile={name}
      data-crop
    >
      <div className="relative z-10 flex max-w-md flex-col gap-1 px-6 pt-6">
        <p className="text-base font-semibold text-pretty text-foreground sm:text-lg">
          {lead}
        </p>
        <p className="text-sm text-pretty text-muted-foreground">{children}</p>
      </div>
      <div className="bn-pic" data-fade={fade}>
        {picture}
      </div>
    </div>
  )
}

// The tile owns the crop: a picture matches its tile's width so a stage never slices the card
// before the tile's edge.
function usePictureWidth() {
  const ref = React.useRef<HTMLDivElement>(null)
  const [width, setWidth] = React.useState(640)
  React.useLayoutEffect(() => {
    const node = ref.current
    if (!node) return
    const measure = () =>
      setWidth(Math.max(1, Math.round(node.getBoundingClientRect().width)))
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(node)
    return () => observer.disconnect()
  }, [])
  return [ref, width] as const
}

/** True once the element has scrolled into view (or at once under reduced motion), after `delay` ms. */
function useInView<T extends Element>(delay: number) {
  const ref = React.useRef<T>(null)
  const reduced = useReducedMotion()
  const [seen, setSeen] = React.useState(false)
  React.useEffect(() => {
    const el = ref.current
    if (!el || reduced) return
    let t = 0
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e?.isIntersecting) return
        io.disconnect()
        t = window.setTimeout(() => setSeen(true), delay)
      },
      { threshold: 0.4 }
    )
    io.observe(el)
    return () => {
      io.disconnect()
      clearTimeout(t)
    }
  }, [delay, reduced])
  return [ref, seen || reduced] as const
}

/* ---------------- Kata (hero) ---------------- */

// The Spanish greetings lesson (examples/spanish-greetings.json) turned into a blank: its 9 a.m.
// in Madrid and its three greetings as word chips. The buttons and the sensei's lines are the
// player's real ones (its English voices); the wrong chip's feedback is written as a lesson would.
const PROMPT = "It's 9 a.m. in Madrid. Finish the greeting."
const BEFORE = "—Buenos"
const AFTER = ", ¿cómo estás?"
const CHIPS = ["noches", "días", "tardes"]
const WRONG = 0
const RIGHT = 1
const NUDGE = "Not quite. Take another look."
const FEEDBACK = "Noches is for the night. At 9 a.m. it's still morning."
const PRAISE = "Yosh! Nice work."

type S = {
  /** The chip the learner goes for: the wrong one first, then the right one */
  aim: number
  /** That chip is in the air between the bank and the gap */
  flying: boolean
  /** It sits in the gap */
  placed: boolean
  /** Checked: a miss (yellow, the ninja nudges, the feedback shows) or right (green, Continue) */
  checked: "miss" | "right" | null
  /** What the sensei last said: kept after Try again, so the bubble fades out on its own words */
  said: "miss" | "right"
}
const initial: S = {
  aim: WRONG,
  flying: false,
  placed: false,
  checked: null,
  said: "miss",
}
const poster: S = {
  aim: RIGHT,
  flying: false,
  placed: true,
  checked: "right",
  said: "right",
}

const script = async (a: Act<S>) => {
  await a.wait(LEAD)
  a.mark("pick")
  await a.click(`chip-${WRONG}`)
  // The chip leaves the bank as it lifts: a dashed ghost holds its place
  a.put({ flying: true })
  await a.wait(640)
  a.put({ flying: false, placed: true })
  await a.wait(700)
  a.mark("check")
  await a.click("check")
  a.put({ checked: "miss", said: "miss" })
  a.mark("miss")
  // Long enough to read the feedback
  await a.wait(2600)
  await a.click("check")
  a.put({ aim: RIGHT, placed: false, checked: null })
  await a.wait(500)
  a.mark("retry")
  await a.click(`chip-${RIGHT}`)
  a.put({ flying: true })
  await a.wait(640)
  a.put({ flying: false, placed: true })
  await a.wait(600)
  await a.click("check")
  a.put({ checked: "right", said: "right" })
  a.mark("payoff")
}

/** The tray's button: Check answer, then Try again after a miss, then Continue. */
const BUTTON = {
  check: "Check answer",
  retry: "Try again",
  next: "Continue",
} as const
const buttonState = (s: S) =>
  s.checked === "right" ? "next" : s.checked === "miss" ? "retry" : "check"

function Mark({ size = 24, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      aria-hidden
      className={className}
    >
      <g stroke="currentColor" strokeWidth="5" strokeLinejoin="round">
        <path d="M7.01 24.83A26 26 0 0 1 56.99 24.83Q32 15.17 7.01 24.83Z" />
        <path d="M56.99 39.17Q32 48.83 7.01 39.17A26 26 0 0 0 56.99 39.17Z" />
      </g>
      <ellipse cx="25" cy="32" rx="2.9" ry="4.6" fill="currentColor" />
      <ellipse cx="39" cy="32" rx="2.9" ry="4.6" fill="currentColor" />
    </svg>
  )
}

/** A word chip: in the bank, in the gap, or in flight. */
function Chip({
  word,
  index,
  state,
  keyHint,
  hideKey,
  ...rest
}: {
  word: string
  index?: number
  state?: "gone" | "placed" | "miss" | "correct"
  /** The number key, as the desktop player shows on each chip */
  keyHint?: boolean
  /** Once the answer is checked the keys go, but the chip keeps their room, as the player's do */
  hideKey?: boolean
} & Record<`data-${string}`, unknown>) {
  return (
    <span className="bn-chip" data-state={state} {...rest}>
      {word}
      {keyHint && index !== undefined ? (
        <kbd className="bn-key" data-hidden={hideKey || undefined}>
          {index + 1}
        </kbd>
      ) : null}
    </span>
  )
}

/** The sentence with its gap, the bank of chips under it, and the miss's note. One markup for both layouts. */
function Blank({
  s,
  keyHint,
  rect,
}: {
  s: S
  keyHint: boolean
  rect: (name: string) => {
    x: number
    y: number
    width: number
    height: number
  }
}) {
  const word = CHIPS[s.aim]!
  const mark =
    s.checked === "right" ? "correct" : s.checked === "miss" ? "miss" : "placed"
  return (
    <>
      <div className="bn-sentence" lang="es">
        <span>{BEFORE}</span>
        <span className="bn-gap" data-filled={s.placed || undefined}>
          {/* Every chip, hidden, sets the gap's width to the longest word */}
          {CHIPS.map((c) => (
            <span key={c} className="bn-gap__size" aria-hidden>
              {c}
            </span>
          ))}
          <span
            className="bn-gap__word"
            data-target="gap-word"
            data-shown={s.placed || undefined}
          >
            <Chip word={word} state={mark} />
          </span>
          {!s.placed && !s.flying && (
            <span className="bn-caret" aria-hidden>
              <span />
            </span>
          )}
        </span>
        <span>{AFTER}</span>
      </div>
      <div className="bn-bank">
        {CHIPS.map((c, i) => (
          <Chip
            key={c}
            word={c}
            index={i}
            keyHint={keyHint}
            hideKey={s.checked === "right"}
            state={i === s.aim && (s.flying || s.placed) ? "gone" : undefined}
            data-target={`chip-${i}`}
            data-cursor="pointer"
          />
        ))}
      </div>
      {/* The wrong chip's feedback, as the player's note under the answers */}
      <div className="bn-note" data-on={s.checked === "miss" || undefined}>
        <span className="bn-note__icon" aria-hidden>
          !
        </span>
        <span>{FEEDBACK}</span>
      </div>
      {/* The flyer waits over its chip in the bank, flies, and is gone once the word is in the gap.
          Each chip gets its own, so the second flight starts from the right place. */}
      {!s.placed && (
        <Fly
          key={s.aim}
          from={rect(`chip-${s.aim}`)}
          to={rect("gap-word")}
          go={s.flying}
          held
        >
          {/* Drawn at the bank chip's size, its key's room included, so it leaves at one size and lands at another */}
          <Chip
            word={word}
            index={s.aim}
            keyHint={keyHint}
            hideKey
            state="placed"
          />
        </Fly>
      )}
    </>
  )
}

/** The desktop player: the lesson card inset top-left and off the right, the tray along its foot. */
function Desktop({ width }: { width: number }) {
  return (
    <Stage<S>
      width={width}
      height={340}
      theme="dark"
      palette="mono"
      initial={initial}
      poster={poster}
      script={script}
      play="once"
      cursor={{ at: { x: width - 60, y: 310 }, style: "arrow" }}
      className="bn-stage"
    >
      {(s, rect) => (
        <div className="bn-card" style={{ width: width + 60 }}>
          <div className="bn-kata">
            <div className="bn-prompt">{PROMPT}</div>
            <Blank s={s} keyHint rect={rect} />
          </div>
          <div
            className="bn-sensei"
            data-on={s.checked || undefined}
            data-tone={s.said}
          >
            <Mark size={28} className="bn-sensei__mark" />
            <span className="bn-bubble">
              {s.said === "miss" ? NUDGE : PRAISE}
            </span>
          </div>
          <div className="bn-tray" data-checked={s.checked ?? undefined}>
            <span
              className="bn-button"
              data-target="check"
              data-cursor="pointer"
              data-ready={s.placed || undefined}
              data-tone={s.checked ?? undefined}
            >
              <States value={buttonState(s)} states={BUTTON} />
            </span>
          </div>
        </div>
      )}
    </Stage>
  )
}

/** The phone player: the header, the kata, and the tray that takes the answer's color. */
function Phone() {
  return (
    <Stage<S>
      width={358}
      height={330}
      theme="dark"
      palette="mono"
      initial={initial}
      poster={poster}
      script={script}
      play="once"
      cursor={{ at: { x: 300, y: 310 }, style: "touch" }}
      className="bn-stage bn-stage--phone"
    >
      {(s, rect) => (
        <div className="bn-screen">
          <header className="bn-head">
            <Mark size={22} />
            <span className="bn-progress">
              <span
                className="bn-progress__fill"
                style={{ width: s.checked === "right" ? "38%" : "30%" }}
              />
            </span>
            <span className="bn-menu" aria-hidden>
              <span />
              <span />
              <span />
            </span>
          </header>
          <div className="bn-kata">
            <div className="bn-prompt">{PROMPT}</div>
            <Blank s={s} keyHint={false} rect={rect} />
          </div>
          <div className="bn-tray" data-checked={s.checked ?? undefined}>
            {/* On phones the tray carries the miss's feedback itself, so the kata keeps no empty room for a note */}
            <div className="bn-tray__line">
              {s.checked === "miss" ? FEEDBACK : PRAISE}
            </div>
            <span
              className="bn-button"
              data-target="check"
              data-cursor="pointer"
              data-ready={s.placed || undefined}
              data-tone={s.checked ?? undefined}
            >
              <Mark size={20} className="bn-button__mark" />
              <States value={buttonState(s)} states={BUTTON} />
            </span>
          </div>
        </div>
      )}
    </Stage>
  )
}

// Both players are in the HTML, and the tile's width picks one (bento.css), so a phone never sees
// the desktop card first.
function Kata() {
  const [picture, width] = usePictureWidth()
  return (
    <Tile
      name="kata"
      lead="Wrong answers teach you."
      fade="end"
      picture={
        <div
          ref={picture}
          className="absolute inset-x-0 bottom-0"
          role="img"
          aria-label="The wrong word dropped into a Spanish sentence: the ninja explains why it's wrong, then the right word goes in and turns green."
        >
          <div className="bn-player bn-player--desktop">
            <Desktop width={width} />
          </div>
          <div className="bn-player bn-player--phone">
            <Phone />
          </div>
        </div>
      }
    >
      The ninja explains every miss.
    </Tile>
  )
}

/* ---------------- Agents (collection) ---------------- */

// Terminal agents and chat apps, interleaved, so the first row has both kinds.
const MARKS = [
  AGENTS[0],
  SETUPS.mcp.agents[0],
  AGENTS[1],
  SETUPS.mcp.agents[1],
  AGENTS[2],
  AGENTS[3],
  AGENTS[4],
  SETUPS.mcp.agents[2],
  ...AGENTS.slice(5),
]

function Agents() {
  const [ref, on] = useInView<HTMLDivElement>(LEAD + 2 * STEP)
  return (
    <Tile
      name="agents"
      lead="Any agent."
      fade="end bottom"
      picture={
        <div
          ref={ref}
          className="bn-marks"
          data-on={on || undefined}
          role="img"
          aria-label={MARKS.map((m) => m.name).join(", ")}
        >
          {MARKS.map((m, i) => (
            <span
              key={m.name}
              className="bn-mark"
              data-lead={i === 0 || undefined}
              style={{ transitionDelay: `${i * 30}ms` }}
            >
              <span className="bn-mark__logo" style={logoMask(m.logo)} />
            </span>
          ))}
        </div>
      }
    >
      In your terminal or your chat app.
    </Tile>
  )
}

/* ---------------- Subjects (collection) ---------------- */

// Three columns at most, the third cut by the tile's edge: the molecule goes there, so the map,
// chess, chart and clock show whole.
const CARDS = [
  {
    name: "map",
    alt: "A map of Europe with the six founders of the EU shaded.",
  },
  { name: "chess", alt: "A chess position, the Italian Game." },
  { name: "molecule", alt: "The caffeine molecule." },
  {
    name: "chart",
    alt: "A chart: compound interest curving above simple interest.",
  },
  { name: "clock", alt: "A clock showing a quarter to four." },
] as const

function Subjects() {
  const [ref, on] = useInView<HTMLDivElement>(LEAD + STEP)
  return (
    <Tile
      name="subjects"
      lead="Any subject."
      fade="end"
      picture={
        <div
          ref={ref}
          className="bn-cards"
          data-on={on || undefined}
          role="img"
          aria-label={CARDS.map((c) => c.alt).join(" ")}
        >
          {CARDS.map((c, i) => (
            <div
              key={c.name}
              className="bn-lesson"
              data-visual={c.name}
              style={{ transitionDelay: `${i * 60}ms` }}
            >
              <div
                className="bn-lesson__visual"
                dangerouslySetInnerHTML={{ __html: visuals[c.name] }}
              />
            </div>
          ))}
        </div>
      }
    >
      Real maps, boards, charts and diagrams.
    </Tile>
  )
}

/* ---------------- Share (UI) ---------------- */

// Real strings from examples/correlation-vs-causation.json; the link is slugify() of its title and an
// id of the publish shape (lib/publish/ids.ts: eight of 0-9 and a-z).
const LINK = "learn.ninja/l/correlation-isn-t-causation-m4q8z2tw"
const SHARED = {
  prompt:
    "Among children aged 5 to 12, shoe size correlates with reading score. Which confounder explains it?",
  options: ["Age", "Family income", "School quality"],
  right: 0,
}

function Share() {
  const [ref, on] = useInView<HTMLDivElement>(LEAD + 3 * STEP)
  return (
    <Tile
      name="share"
      lead="Send one link."
      fade="bottom"
      picture={
        <div
          ref={ref}
          className="bn-share"
          data-on={on || undefined}
          role="img"
          aria-label="A lesson link, and the lesson open on a phone."
        >
          <div className="bn-share__link">
            <Link2Icon aria-hidden />
            <span>{LINK}</span>
          </div>
          <div className="bn-phone">
            <div className="bn-phone__progress">
              <span />
            </div>
            <div className="bn-phone__prompt">{SHARED.prompt}</div>
            {SHARED.options.map((o, i) => (
              <div
                key={o}
                className="bn-phone__option"
                data-correct={i === SHARED.right || undefined}
              >
                {o}
              </div>
            ))}
          </div>
        </div>
      }
    >
      Anyone can play it. No account, no app.
    </Tile>
  )
}

/* ---------------- Activity (stat) ---------------- */

// The profile's grid (components/explore/activity-grid.tsx), its last 26 weeks: Sunday at the top,
// today a Wednesday, so the newest column has four days. A 12-day streak ends today, after a day
// off. The shades are the ink's, so the only lit square is today's, empty until the tile comes in.
const WEEKS = 26
const DAYS = (WEEKS - 1) * 7 + 4
const TODAY = DAYS - 1
const STREAK = 12
const START = TODAY - STREAK

function levelOf(day: number): Level {
  if (day === START - 1) return 0
  // A small integer hash, so neighbouring days don't fall into stripes
  let h = Math.imul(day ^ 0x5bd1e995, 0x27d4eb2d)
  h ^= h >>> 15
  const roll = (h >>> 0) % SHADES.length
  if (day >= START) return ((roll % 4) + 1) as Level
  // About half the days off, mostly light ones, the odd big one
  return SHADES[roll]!
}

type Level = 0 | 1 | 2 | 3 | 4
const SHADES: Level[] = [0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 2, 2, 3, 4]

function Activity() {
  const [ref, on] = useInView<HTMLDivElement>(LEAD + 4 * STEP)
  return (
    <Tile
      name="activity"
      lead="Come back tomorrow."
      picture={
        <div
          ref={ref}
          className="bn-activity"
          data-on={on || undefined}
          role="img"
          aria-label="Six months of learning, one square a day, and a twelve-day streak as today's square fills in."
        >
          {/* The grid's own clip, so only the weeks fade where they run off, not the count */}
          <div className="bn-days-clip">
            <div className="bn-days">
              {Array.from({ length: DAYS }, (_, day) => (
                <span
                  key={day}
                  className="bn-day"
                  data-level={day === TODAY ? undefined : levelOf(day)}
                  data-today={day === TODAY || undefined}
                />
              ))}
            </div>
          </div>
          <div className="bn-activity__count">
            <span className="bn-activity__number">
              <Count value={on ? STREAK : STREAK - 1} duration={900} />
            </span>
            <span className="bn-activity__label">day streak</span>
          </div>
        </div>
      }
    >
      A square for every day you learn.
    </Tile>
  )
}
