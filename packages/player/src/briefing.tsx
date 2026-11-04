"use client"

import * as React from "react"

import { reducedMotion } from "./ninja"
import { TOKEN } from "@workspace/player-core/plain-text"
import { plainText, RichText } from "./rich-text"
import { ScreenLabel } from "./screen-label"

/**
 * A scenario's situation as the beats the ninja tells it in: one per sentence, and a colon that
 * introduces a list ends a beat too. Bold and code never break across beats.
 */
export function briefBeats(text: string, lang = "en"): string[] {
  const sentences =
    typeof Intl !== "undefined" && "Segmenter" in Intl
      ? [
          ...new Intl.Segmenter(lang, { granularity: "sentence" }).segment(
            text
          ),
        ].map((s) => s.segment)
      : text.split(/(?<=[.!?])\s+/)
  const parts = sentences
    .flatMap((s) => s.split(/(?<=:)\s+/))
    .map((s) => s.trim())
    .filter(Boolean)
  // A beat that opens bold or code without closing it takes the next one with it.
  const open = (s: string) =>
    (s.match(/\*\*/g)?.length ?? 0) % 2 === 1 ||
    (s.match(/`/g)?.length ?? 0) % 2 === 1
  const beats: string[] = []
  for (const part of parts) {
    const last = beats[beats.length - 1]
    if (last !== undefined && open(last))
      beats[beats.length - 1] = `${last} ${part}`
    else beats.push(part)
  }
  return beats
}

/**
 * A beat as the pieces it streams in: one per word, each still valid rich text (a bold phrase
 * becomes bold words), with code and formulas kept whole. Spaces ride on the word before them.
 */
export function streamUnits(beat: string): string[] {
  const units: string[] = []
  const add = (piece: string) => {
    if (/^\s+$/.test(piece) && units.length) units[units.length - 1] += piece
    else if (piece) units.push(piece)
  }
  const words = (text: string, wrap = (w: string) => w) => {
    for (const part of text.split(/(\s+)/))
      add(/^\s+$/.test(part) ? part : part && wrap(part))
  }
  let last = 0
  for (const m of beat.matchAll(TOKEN)) {
    words(beat.slice(last, m.index))
    const [whole, , , bold, italic] = m
    if (bold !== undefined) words(bold, (w) => `**${w}**`)
    else if (italic !== undefined) words(italic, (w) => `*${w}*`)
    else add(whole)
    last = m.index + whole.length
  }
  words(beat.slice(last))
  return units
}

// The stream's timing, in ms. The caret blinks a moment, then each word fades in a step after the
// last, overlapping, with a short breath between sentences.
const LEAD = 700
const STEP = 44
const BREATH = 418
const FADE = 495

/** When each beat's words start fading in, and when the last one has landed. */
export function streamSchedule(units: string[][]): {
  delays: number[][]
  end: number
} {
  let t = LEAD
  const delays = units.map((beat, b) => {
    if (b > 0) t += BREATH
    return beat.map(() => (t += STEP) - STEP)
  })
  return { delays, end: t - STEP + FADE }
}

/**
 * The ninja's brief before a scenario, said like an assistant's reply: no bubble, just his words
 * in the middle of the screen while he stays in his corner. A caret blinks, then the words stream
 * in, each fading up from a soft blur on its own CSS timer (no re-render per word). Every word is
 * laid out from the start, so nothing reflows. `skip` counts Skip presses: a new one shows the rest
 * at once. `onTold` fires once it's all out.
 */
export function Briefing({
  text,
  lang,
  skip,
  onTold,
  label,
}: {
  text: string
  lang?: string
  skip: number
  onTold: () => void
  /** The screen's label above his words, as the question after the brief shows it ("Challenge"). */
  label?: string
}) {
  const beats = React.useMemo(() => briefBeats(text, lang), [text, lang])
  const units = React.useMemo(() => beats.map(streamUnits), [beats])
  const { delays, end } = React.useMemo(() => streamSchedule(units), [units])
  const onToldRef = React.useRef(onTold)
  onToldRef.current = onTold
  // He's only done telling once, whether the stream ran out or was skipped.
  const toldOnce = React.useRef(false)
  const finish = React.useCallback(() => {
    if (toldOnce.current) return
    toldOnce.current = true
    onToldRef.current()
  }, [])

  React.useEffect(() => {
    const timer = window.setTimeout(finish, reducedMotion() ? 0 : end)
    return () => window.clearTimeout(timer)
  }, [end, finish])

  // Skip: everything at once. Only presses after this telling began count.
  const skipAtStart = React.useRef(skip)
  const skipped = skip !== skipAtStart.current
  React.useEffect(() => {
    if (skipped) finish()
  }, [skipped, finish])

  return (
    <div className="flex flex-col items-center">
      {/* Screen readers get the whole brief at once; the streaming words are for the eyes. */}
      <p className="sr-only">{plainText(text)}</p>
      <div
        aria-hidden="true"
        data-skipped={skipped || undefined}
        className="brief flex w-full max-w-md flex-col gap-2 text-base text-pretty"
        style={
          {
            "--brief-start": `${LEAD}ms`,
            "--brief-end": `${end}ms`,
          } as React.CSSProperties
        }
      >
        {label ? <ScreenLabel text={label} className="mb-2" /> : null}
        {units.map((beat, b) => (
          <p key={b}>
            {b === 0 ? <Caret at="start" /> : null}
            {beat.map((unit, i) => {
              const word = unit.trimEnd()
              return (
                <React.Fragment key={i}>
                  <span
                    className="brief-word"
                    style={{ animationDelay: `${delays[b]![i]}ms` }}
                  >
                    <RichText text={word} inline />
                  </span>
                  {unit.slice(word.length)}
                </React.Fragment>
              )
            })}
            {b === units.length - 1 ? <Caret at="end" /> : null}
          </p>
        ))}
      </div>
    </div>
  )
}

/** The caret: one before the words start and one after they've all landed. It takes no room. */
function Caret({ at }: { at: "start" | "end" }) {
  // The outer span shows or hides it on cue; the inner one blinks.
  return (
    <span className={`learn-caret brief-caret-${at}`}>
      <span />
    </span>
  )
}
