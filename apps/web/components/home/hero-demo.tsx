"use client"

import {
  AudioLines,
  ChevronDown,
  CornerDownLeft,
  Mic,
  Plus,
} from "lucide-react"
import {
  Bar,
  Caret,
  Collapse,
  Phone,
  Prompt,
  Spinner,
  Stage,
  States,
  Text,
  Window,
  type Act,
} from "@/components/stage/kit"
import "./hero-demo.css"

// The home hero: a prompt goes into an agent, a link comes back, and
// the lesson is already playing on a phone beside it. Device pair: the agent's
// window pinned top-left and off the bottom, the phone straddling its right
// edge over the window's empty margin. `setup` follows the page's CLI/MCP
// toggle: a terminal for the skill, a chat window for the MCP server; the
// beats and the phone are the same. Dark, mono, the site's own
// tokens; the one lit color is the player's green for a right answer.
//
// Beats: the prompt is typed and sent; three steps tick in the terminal; the
// link lands with its one-line note; a finger taps the right option on the
// phone and it turns green. The payoff holds, then the output folds away and
// the phone's screen reloads, back to the opening frame.
//
// Real strings: the command, the three steps, the link, the note, the lesson
// title, the question and its three options.

const CMD = "make me a lesson about git basics"
const STEPS = ["Wrote 7 katas", "Checked", "Published"]
const LINK = "learn.ninja/l/git-basics-k3x9a2mq"
const NOTE = 'Lasts 7 days. Say "keep it" to save it.'
const QUESTION =
  "You edited a file and want it in your next commit. What comes first?"
const OPTIONS = ["git commit", "git push", "git add"]
const RIGHT = 2

export type Setup = "cli" | "mcp"

type S = {
  cmd: string
  /** Chat only: the message has left the composer and sits in the thread */
  sent: boolean
  /** How many steps have started; a started step shows a spinner until done passes it */
  started: number
  done: number
  link: boolean
  note: boolean
  picked: number | null
  correct: boolean
  /** The exchange folding away at the seam */
  clearing: boolean
  /** The phone's page reloading at the seam */
  reload: boolean
}

const initial: S = {
  cmd: "",
  sent: false,
  started: 0,
  done: 0,
  link: false,
  note: false,
  picked: null,
  correct: false,
  clearing: false,
  reload: false,
}
const poster: S = {
  ...initial,
  cmd: CMD,
  sent: true,
  started: 3,
  done: 3,
  link: true,
  note: true,
  picked: RIGHT,
  correct: true,
}

const script = (setup: Setup) => async (a: Act<S>) => {
  await a.wait(600)
  a.mark("type")
  await a.type("cmd", CMD, { interval: 42 })
  await a.wait(500)
  if (setup === "mcp") {
    // Sent: the message leaves the composer and lands in the thread
    a.put({ sent: true, cmd: "" })
    await a.wait(600)
  }
  a.mark("run")
  for (let i = 0; i < STEPS.length; i++) {
    a.put({ started: i + 1 })
    await a.wait(i === 0 ? 900 : 650)
    a.put({ done: i + 1 })
    await a.wait(220)
  }
  a.mark("link")
  a.put({ link: true })
  await a.wait(500)
  a.put({ note: true })
  await a.wait(900)
  a.mark("tap")
  await a.click(`opt-${RIGHT}`)
  a.put({ picked: RIGHT })
  await a.wait(380)
  a.put({ correct: true })
  a.mark("payoff")
  await a.wait(2600)
  // The seam: the output folds up as one thing while the phone's page reloads
  a.put({ clearing: true, reload: true })
  await a.wait(520)
  await a.snap({ ...initial, reload: true })
  await a.wait(80)
  a.put({ reload: false })
  await a.move("rest")
  await a.wait(400)
}

function Mark({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" aria-hidden>
      <g stroke="currentColor" strokeWidth="5" strokeLinejoin="round">
        <path d="M7.01 24.83A26 26 0 0 1 56.99 24.83Q32 15.17 7.01 24.83Z" />
        <path d="M56.99 39.17Q32 48.83 7.01 39.17A26 26 0 0 0 56.99 39.17Z" />
      </g>
      <ellipse cx="25" cy="32" rx="2.9" ry="4.6" fill="currentColor" />
      <ellipse cx="39" cy="32" rx="2.9" ry="4.6" fill="currentColor" />
    </svg>
  )
}

function Tick() {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden>
      <path
        d="M3.5 8.5 6.5 11.5 12.5 5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/** The agent's progress and its answer: three steps ticking, the link, the note. One markup for both windows. */
function Steps({ s }: { s: S }) {
  return (
    <>
      {STEPS.map((step, i) => (
        <Collapse key={step} open={s.started > i}>
          <div className="lh-step" data-done={s.done > i || undefined}>
            <span className="lh-step__mark">
              <States
                value={s.done > i ? "ok" : "wait"}
                states={{
                  wait: <Spinner size={11} />,
                  ok: <span className="ok">✓</span>,
                }}
              />
            </span>
            {step}
          </div>
        </Collapse>
      ))}
      <Collapse open={s.link}>
        <div className="lh-link">{LINK}</div>
      </Collapse>
      <Collapse open={s.note}>
        <div className="dim">{NOTE}</div>
      </Collapse>
    </>
  )
}

/** The chat app's composer, as Claude draws it: a tall rounded box with a return key, and a row of tools and a note under it. Runs under the phone on the right. */
function Composer({ value, focused }: { value: string; focused: boolean }) {
  return (
    <div className="lh-composer" data-snap>
      <div className="lh-composer__box" data-focused={focused || undefined}>
        <span className="lh-composer__text">
          {value ? (
            value
          ) : (
            <span className="lh-composer__placeholder">Reply</span>
          )}
          {focused && <span className="lh-composer__caret" />}
        </span>
        <CornerDownLeft
          size={16}
          strokeWidth={1.75}
          className="lh-composer__enter"
          aria-hidden
        />
      </div>
      <div className="lh-composer__row">
        <span className="lh-composer__tools">
          <Plus size={15} strokeWidth={1.75} aria-hidden />
          <Mic size={15} strokeWidth={1.75} aria-hidden />
          <AudioLines size={15} strokeWidth={1.75} aria-hidden />
          <ChevronDown size={12} strokeWidth={1.75} aria-hidden />
        </span>
        <span className="lh-composer__note">AI can make mistakes.</span>
        {/* Claude puts the model picker here; the phone covers that end, so nothing is drawn under it */}
        <span className="lh-composer__end" />
      </div>
    </div>
  )
}

/**
 * The home page's product shot, built with the stageshow kit (components/stage/README.md). Playable in
 * Storybook; filmed and judged with the skill's playground before any change lands here.
 */
export function HeroDemo({ setup = "cli" }: { setup?: Setup }) {
  return (
    <Stage<S>
      width={720}
      height={440}
      compact={{ below: 600, width: 358, height: 720 }}
      fill
      theme="dark"
      palette="mono"
      initial={initial}
      poster={setup === "mcp" ? { ...poster, cmd: "" } : poster}
      script={script(setup)}
      cursor={{
        at: { wide: { x: 600, y: 420 }, compact: { x: 180, y: 700 } },
        style: "touch",
        idle: false,
      }}
      className="lh"
    >
      {(s, _rect, layout) => (
        <>
          {setup === "cli" ? (
            <Window
              chrome="terminal"
              lights="grey"
              title="app — zsh"
              className="lh-term"
            >
              {/* What was there before: a project folder, the kind of place the skill is used from */}
              <Prompt path="~" className="dim">
                ls
              </Prompt>
              <div className="dim">README.md package.json src</div>
              <Prompt path="~">
                <span
                  className="lh-cmd"
                  data-snap
                  data-clearing={s.clearing || undefined}
                >
                  {s.cmd}
                </span>
                {!s.link && <Caret still={s.cmd.length > 0 && s.started > 0} />}
              </Prompt>
              <Collapse open={s.started > 0 && !s.clearing} className="lh-out">
                <Steps s={s} />
                <Collapse open={s.note}>
                  <Prompt path="~">
                    <Caret />
                  </Prompt>
                </Collapse>
              </Collapse>
            </Window>
          ) : (
            <Window title="Assistant" className="lh-chat">
              <div className="lh-chat__body">
                <div className="lh-thread">
                  {/* An earlier exchange, as placeholder: the eye lands on this one */}
                  <div className="lh-turn--past">
                    <Bar w={150} h={28} r={14} tone={1} className="lh-past-q" />
                    <Bar w="78%" h={7} r={4} tone={2} />
                    <Bar w="54%" h={7} r={4} tone={2} />
                  </div>
                  <Collapse
                    open={s.sent && !s.clearing}
                    className="lh-exchange"
                  >
                    <Collapse open={s.sent} reveal="drop" from="below">
                      <div className="lh-q">
                        <Text>{CMD}</Text>
                      </div>
                    </Collapse>
                    <Collapse open={s.started > 0}>
                      <div className="lh-reply">
                        <Steps s={s} />
                      </div>
                    </Collapse>
                  </Collapse>
                </div>
                <Composer value={s.cmd} focused={!s.sent} />
              </div>
            </Window>
          )}

          <Phone
            width={layout === "compact" ? 326 : 300}
            frame="pro"
            dark
            className="lh-phone"
          >
            <div className="lh-screen">
              <header className="lh-head">
                <span className="lh-logo">
                  <Mark />
                </span>
                <span className="lh-progress">
                  <span className="lh-progress__fill" />
                </span>
                <span className="lh-menu">
                  <span />
                  <span />
                  <span />
                </span>
              </header>
              <div className="lh-kata" data-reload={s.reload || undefined}>
                <span className="lh-label">Warm-up</span>
                <div className="lh-q">{QUESTION}</div>
                <div className="lh-opts">
                  {OPTIONS.map((o, i) => (
                    <div
                      key={o}
                      className="lh-opt"
                      data-target={`opt-${i}`}
                      data-picked={(s.picked === i && !s.correct) || undefined}
                      data-correct={(s.correct && i === RIGHT) || undefined}
                    >
                      {o}
                      <span className="lh-opt__check">
                        <Tick />
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Phone>
          <span data-target="rest" className="lh-rest" />
        </>
      )}
    </Stage>
  )
}
