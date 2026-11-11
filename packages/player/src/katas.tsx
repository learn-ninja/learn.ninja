"use client"

import * as React from "react"
import { CheckIcon, LightbulbIcon, XIcon } from "lucide-react"

import type {
  ConceptKata as ConceptKataData,
  QuestionKata,
} from "@workspace/spec"
import { Kbd } from "@workspace/ui/components/kbd"
import { Selectable } from "@workspace/ui/components/selectable"
import { cn } from "@workspace/ui/lib/utils"

import type { Answer, Mark } from "@workspace/player-core/check"
import { chipsInGaps } from "@workspace/player-core/state"
import { usePlayer } from "./context"
import {
  controlPadding,
  controlStyles,
  controlSurface,
  keyHintStyles,
  markStyles,
  slotStyles,
} from "./controls"
import { shortcutBlocked } from "./keys"
import { MarkText } from "./marks"
import { buzz, fly, shake } from "./motion"
import { plainText, RichBlocks, RichText } from "./rich-text"
import { Visual } from "./visuals"

export interface QuestionKataProps {
  kata: QuestionKata
  answer: Answer
  setAnswer: (answer: Answer) => void
  marks: Record<string, Mark>
  /** True after checking: the answer can't change until the learner tries again. */
  locked: boolean
}

// A choice row is the shared control, a little roomier for its key hint and longer text.
const cardStyles = cn(
  controlStyles,
  "w-full rounded-lg text-start data-pressed:translate-y-px"
)

/** The number key that picks an option, or after checking, whether it was right. */
function KeyHint({
  i,
  mark,
  className = "ms-auto shrink-0",
}: {
  i: number
  mark?: Mark
  className?: string
}) {
  if (mark === "correct" || mark === "wrong" || mark === "partial")
    return (
      <>
        <Kbd
          aria-hidden="true"
          className={cn(
            className,
            // Square like the number key it replaces (the icon plus the key's padding would be 2px wider),
            // and filled, so it needs no outline.
            "w-5 border-0 px-0",
            mark === "correct"
              ? "bg-green-500 text-green-950"
              : "bg-yellow-500 text-yellow-950"
          )}
        >
          {mark === "correct" ? (
            <CheckIcon strokeWidth={3} />
          ) : (
            <XIcon strokeWidth={3} />
          )}
        </Kbd>
        <MarkText mark={mark} />
      </>
    )
  return (
    <Kbd aria-hidden="true" className={cn(className, keyHintStyles)}>
      {i + 1}
    </Kbd>
  )
}

// An option card: the visual on a panel in the page's color, the caption in a muted footer. Selection
// and marks only recolor the border; the panel inherits it. Each card spans two rows of the options
// grid (a subgrid), so the panels in a row match in height and the captions start on one line.
// No color transition: hover follows the pointer at once, and the panel's inherited border would ease twice.
const optionCardStyles =
  "group relative row-span-2 grid grid-rows-subgrid gap-0 rounded-xl border bg-muted text-start shadow-xs dark:bg-input/30 " +
  "hover:border-ring data-selected:border-primary data-pressed:translate-y-px " +
  "data-[status=correct]:border-green-600! data-[status=wrong]:border-yellow-500! data-[status=partial]:border-amber-500!"

// The panel is at least 160px tall (112px on phones), so a small visual (a row of buttons, a badge) still reads as a
// preview window; taller visuals grow it, and the visual stays centered.
const optionPanelStyles =
  "relative -mx-px -mt-px flex min-h-28 flex-col justify-center rounded-xl border border-inherit bg-background px-1 py-5 sm:min-h-40"

// ---------- concept ----------

/**
 * Theory: one idea with an optional visual. Nothing to answer. The visual sits under the title, as
 * in a question: the learner sees it first and the body explains it, and a tall one isn't missed below.
 */
export function ConceptKata({
  kata,
  steps,
}: {
  kata: ConceptKataData
  /** A stepped concept: how many steps of the body to show so far. */
  steps?: number
}) {
  const title = (
    <h2 className="text-lg font-semibold text-balance">{kata.title}</h2>
  )
  const body = (
    <RichBlocks
      text={kata.body}
      steps={kata.stepped ? steps : undefined}
      className="text-sm leading-relaxed text-pretty"
    />
  )
  if (!kata.visual)
    return (
      <div className="flex flex-col gap-3">
        {title}
        {body}
      </div>
    )
  return (
    <>
      {title}
      <Visual visual={kata.visual} />
      {body}
    </>
  )
}

// ---------- choice, compare, scenario ----------

/**
 * Options with visuals (in a compare or a choice) show as cards in two columns: each card has the
 * visual on a panel, with its number key in the corner, and an optional caption under it. Options
 * that are only text are rows, even in a compare.
 */
export function hasOptionCards(kata: QuestionKata): boolean {
  if (kata.type !== "compare" && kata.type !== "choice") return false
  return kata.options.some((o) => o.visual)
}

/**
 * The option row the explanation opens under: the one right answer in a list of rows. With cards,
 * several right answers, or no options, it goes below the kata instead (null).
 */
export function explanationAnchor(
  kata: QuestionKata,
  marks: Record<string, Mark>
): string | null {
  if (kata.type !== "choice" && kata.type !== "scenario") return null
  if (hasOptionCards(kata)) return null
  const right = Object.keys(marks).filter((id) => marks[id] === "correct")
  return right.length === 1 ? right[0]! : null
}

/** Why the answer is right, one line per block so worked steps stack. Attached, it continues the row above. */
export function Explanation({
  text,
  attached = false,
}: {
  text: string
  attached?: boolean
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-1 border border-green-600 bg-green-600/10 px-4 py-3 text-sm tabular-nums",
        attached ? "rounded-b-lg border-t-green-600/30" : "rounded-lg"
      )}
    >
      {text
        .split("\n")
        .filter((line) => line.trim())
        .map((line, i) => (
          <RichText key={i} text={line} className="block" />
        ))}
    </div>
  )
}

/**
 * The player's feedback under the answers, beside the ninja's line: a miss's hint or a scenario's
 * outcome in amber, the explanation in green, and the hint the learner asked for in neutral grey
 * with a lightbulb. The explanation's recipe, led by a filled icon.
 */
export function Note({
  tone,
  text,
  className,
}: {
  tone: "good" | "warn" | "neutral"
  text: string
  className?: string
}) {
  return (
    <div
      className={cn(
        "flex items-start gap-2.5 rounded-lg border px-4 py-3 text-sm tabular-nums",
        tone === "good"
          ? "border-green-600 bg-green-600/10"
          : tone === "warn"
            ? "border-yellow-500 bg-yellow-500/10"
            : "border-border bg-muted",
        className
      )}
    >
      {tone === "neutral" ? (
        <LightbulbIcon
          aria-hidden="true"
          className="mt-0.5 size-4 shrink-0 text-muted-foreground"
        />
      ) : (
        /* A filled dot: a white check, or a dark "!" (white is too faint on yellow). */
        <span
          aria-hidden="true"
          className={cn(
            "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full",
            tone === "good"
              ? "bg-green-600 text-white"
              : "bg-yellow-500 text-yellow-950"
          )}
        >
          {tone === "good" ? (
            <CheckIcon className="size-3" strokeWidth={3} />
          ) : (
            // Lucide's circle-alert mark, without its circle.
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={3}
              strokeLinecap="round"
              className="size-3"
            >
              <path d="M12 7v6M12 17h.01" />
            </svg>
          )}
        </span>
      )}
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        {text
          .split("\n")
          .filter((line) => line.trim())
          .map((line, i) => (
            <RichText key={i} text={line} className="block" />
          ))}
      </div>
    </div>
  )
}

export function OptionsKata({
  kata,
  answer,
  setAnswer,
  marks,
  locked,
  order,
  showOutcomes,
  explanation = null,
  tried = [],
}: QuestionKataProps & {
  order: string[]
  showOutcomes: string[]
  /** Shown under the right answer's row (see explanationAnchor). */
  explanation?: string | null
  /** A scenario's picks already rewound: crossed out, and they can't be picked again. */
  tried?: string[]
}) {
  const { t, keyScope } = usePlayer()
  const isOptions =
    kata.type === "choice" ||
    kata.type === "compare" ||
    kata.type === "scenario"
  const selected = answer.kind === "select" ? answer.ids : []
  const multiple = kata.type === "choice" && kata.multiple
  const toggle = (id: string) => {
    if (tried.includes(id)) return
    if (multiple)
      setAnswer({
        kind: "select",
        ids: selected.includes(id)
          ? selected.filter((x) => x !== id)
          : [...selected, id],
      })
    else setAnswer({ kind: "select", ids: [id] })
  }
  const options = isOptions
    ? order
        .map((id) =>
          (kata.options as { id: string }[]).find((o) => o.id === id)!
        )
        .filter(Boolean)
    : []

  // Number keys pick options: 1 for the first, 2 for the second…
  const toggleRef = React.useRef(toggle)
  toggleRef.current = toggle
  const ids = options.map((o) => o.id).join(",")
  React.useEffect(() => {
    if (locked) return
    const list = ids.split(",")
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || e.repeat) return
      const target = e.target as HTMLElement | null
      if (keyScope && !keyScope.current?.contains(target)) return
      if (shortcutBlocked(e)) return
      const n = Number(e.key)
      if (!Number.isInteger(n) || n < 1 || n > list.length) return
      e.preventDefault()
      toggleRef.current(list[n - 1]!)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [ids, locked, keyScope])

  if (!isOptions) return null
  const cards = hasOptionCards(kata)
  const anchor = explanation ? explanationAnchor(kata, marks) : null

  return (
    <div
      role="group"
      aria-label={kata.prompt}
      className={cn(
        "grid gap-3",
        // Two columns from sm up. Phones keep one column for a pair (a compare's two screens need the
        // width), but three or more pictures sit in a grid, like a picture quiz.
        cards && (options.length >= 3 ? "grid-cols-2" : "sm:grid-cols-2")
      )}
    >
      {options.map((raw, i) => {
        const o = raw as {
          id: string
          text?: string
          visual?: import("@workspace/spec").Visual
          lang?: string
          outcome?: string
        }
        const wasTried = tried.includes(o.id)
        const row = (
          <Selectable
            key={o.id}
            isSelected={selected.includes(o.id)}
            onChange={() => toggle(o.id)}
            isDisabled={locked || wasTried}
            data-status={marks[o.id]}
            // Once marked (Every path), a tried row takes its color like the rest.
            data-tried={(wasTried && !marks[o.id]) || undefined}
            className={cn(
              cards
                ? optionCardStyles
                : cn(
                    "group flex min-h-12 items-center gap-2 px-4 py-3",
                    cardStyles,
                    markStyles,
                    "data-tried:border-dashed data-tried:bg-transparent data-tried:text-muted-foreground data-tried:shadow-none dark:data-tried:bg-transparent"
                  ),
              o.id === anchor && "rounded-b-none border-b-0"
            )}
          >
            {cards ? (
              <>
                {/* The key badge numbers the card; the words are for screen readers. */}
                <span className="sr-only">{t.optionLabel(String(i + 1))}</span>
                {o.visual ? (
                  <span
                    className={cn(
                      optionPanelStyles,
                      // Without a caption, the panel is the whole card.
                      !o.text && "row-span-2 -mb-px"
                    )}
                  >
                    <KeyHint
                      i={i}
                      mark={marks[o.id]}
                      className="absolute end-3 top-3 z-10"
                    />
                    <Visual
                      visual={o.visual}
                      label={t.optionLabel(String(i + 1))}
                      plain
                    />
                  </span>
                ) : null}
                {o.text ? (
                  <span
                    className={cn(
                      "flex items-start gap-3 px-4 py-3",
                      !o.visual && "row-span-2"
                    )}
                  >
                    <RichText
                      text={o.text}
                      lang={o.lang}
                      className="flex-1 text-sm font-medium"
                    />
                    {/* A card with no visual keeps its key beside the text. */}
                    {o.visual ? null : <KeyHint i={i} mark={marks[o.id]} />}
                  </span>
                ) : null}
              </>
            ) : (
              <>
                <span className="flex min-w-0 flex-1 flex-col gap-2">
                  {o.text ? (
                    <RichText
                      text={o.text}
                      lang={o.lang}
                      className={cn(
                        "text-sm font-medium",
                        wasTried &&
                          !marks[o.id] &&
                          "line-through decoration-muted-foreground/60"
                      )}
                    />
                  ) : null}
                  {o.visual ? <Visual visual={o.visual} /> : null}
                  {o.outcome && showOutcomes.includes(o.id) ? (
                    <RichText
                      text={o.outcome}
                      className="text-sm text-muted-foreground"
                    />
                  ) : null}
                </span>
                {wasTried && !marks[o.id] ? (
                  <span className="ms-auto shrink-0 font-mono text-xs text-muted-foreground">
                    {t.tried}
                  </span>
                ) : (
                  <KeyHint i={i} mark={marks[o.id]} />
                )}
              </>
            )}
          </Selectable>
        )
        return o.id === anchor && explanation ? (
          <div key={o.id} className="flex flex-col">
            {row}
            <Explanation text={explanation} attached />
          </div>
        ) : (
          row
        )
      })}
    </div>
  )
}

// ---------- hotspot ----------

export function HotspotKata({
  kata,
  answer,
  setAnswer,
  marks,
  locked,
}: QuestionKataProps) {
  if (kata.type !== "hotspot") return null
  const selected = answer.kind === "select" ? answer.ids : []
  const onToggle = (id: string) =>
    setAnswer({
      kind: "select",
      ids: kata.multiple
        ? selected.includes(id)
          ? selected.filter((x) => x !== id)
          : [...selected, id]
        : [id],
    })
  return (
    <Visual
      visual={kata.visual}
      hotspots={{ selected, marks, onToggle, disabled: locked }}
      label={kata.prompt}
    />
  )
}

// ---------- match ----------

// Tap an item, then its match in the other column (either side can go first). Each pair is judged as
// it's made: a right pair flashes green and stays matched, greyed out, so the board empties as you go;
// a wrong one shakes yellow, comes apart, and costs the kata its first-try score (`onSlip`). The last
// pair checks the kata (`onDone`), so there's no Check to press.

/** How long a pair shows its result before it settles (and, after the last pair, the kata checks). */
const PAIR_FLASH = 450

export function MatchKata({
  kata,
  answer,
  setAnswer,
  marks,
  locked,
  rightOrder,
  onSlip,
  onDone,
}: QuestionKataProps & {
  rightOrder: number[]
  /** A wrong pair was made: the kata no longer counts as right first time. */
  onSlip?: () => void
  /** The last pair is matched: check the kata. */
  onDone?: () => void
}) {
  const root = React.useRef<HTMLDivElement>(null)
  const { t, keyScope } = usePlayer()
  // What a screen reader hears about the last pair, as sort and order say where an item went.
  const [said, setSaid] = React.useState("")
  // The item waiting for its match: either column can go first.
  const [armed, setArmed] = React.useState<{
    side: "left" | "right"
    index: number
  } | null>(null)
  // The pair just made, while it shows whether it was right.
  const [flash, setFlash] = React.useState<{
    left: number
    right: number
    good: boolean
  } | null>(null)
  React.useEffect(() => {
    if (!flash) return
    if (!flash.good) shake(root.current)
    const id = window.setTimeout(() => setFlash(null), PAIR_FLASH)
    return () => window.clearTimeout(id)
  }, [flash])
  const done = React.useRef(onDone)
  done.current = onDone
  const complete =
    kata.type === "match" &&
    answer.kind === "pairs" &&
    Object.keys(answer.links).length === kata.pairs.length
  React.useEffect(() => {
    if (!complete || locked) return
    const id = window.setTimeout(() => done.current?.(), PAIR_FLASH)
    return () => window.clearTimeout(id)
  }, [complete, locked])

  // Number keys pick down a column, as taps do: 1 for the first item on the left, then, with one
  // picked, 1 for the first item on the right to pair it with.
  const pick = React.useRef<(n: number) => void>(() => {})
  React.useEffect(() => {
    if (locked) return
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || e.repeat) return
      const el = e.target as HTMLElement | null
      if (keyScope && !keyScope.current?.contains(el)) return
      if (shortcutBlocked(e)) return
      const n = Number(e.key)
      if (!Number.isInteger(n) || n < 1 || n > 9) return
      e.preventDefault()
      pick.current(n - 1)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [locked, keyScope])

  if (kata.type !== "match" || answer.kind !== "pairs") return null
  const links = answer.links
  const matchedRight = new Set(Object.values(links))
  const isArmed = (side: "left" | "right", index: number) =>
    armed?.side === side && armed.index === index

  // A pair is right when the right-hand item is the left one's own (pairs keep their index).
  const pair = (left: number, right: number) => {
    setArmed(null)
    buzz()
    const good = left === right
    setFlash({ left, right, good })
    setSaid(
      good
        ? t.matched(
            plainText(kata.pairs[left]!.left),
            plainText(kata.pairs[right]!.right)
          )
        : t.notAPair
    )
    if (good) setAnswer({ kind: "pairs", links: { ...links, [left]: right } })
    else onSlip?.()
  }
  const press = (side: "left" | "right", index: number) => {
    if (armed && armed.side !== side)
      return side === "left"
        ? pair(index, armed.index)
        : pair(armed.index, index)
    setArmed(isArmed(side, index) ? null : { side, index })
  }

  pick.current = (n) => {
    if (armed?.side === "left") {
      const j = rightOrder[n]
      if (j !== undefined && !matchedRight.has(j)) press("right", j)
    } else if (n < kata.pairs.length && !(n in links)) press("left", n)
  }

  /** The tile's look: its check mark, the pair it's flashing in, matched, or waiting. */
  const statusOf = (side: "L" | "R", index: number) =>
    marks[`${side}${index}`] ??
    (flash && (side === "L" ? flash.left : flash.right) === index
      ? flash.good
        ? "correct"
        : "wrong"
      : undefined)
  const tile = (
    side: "left" | "right",
    index: number,
    text: string,
    lang: string | undefined,
    matched: boolean
  ) => {
    const status = statusOf(side === "left" ? "L" : "R", index)
    // Matched and settled: a dashed outline with muted text, out of play.
    const settled = matched && !status
    return (
      <Selectable
        key={index}
        isSelected={isArmed(side, index)}
        onChange={() => press(side, index)}
        isDisabled={locked || matched}
        data-status={status}
        // A matched pair never comes apart on Enter.
        data-enter={matched ? "main" : undefined}
        lang={lang}
        className={cn(
          settled
            ? cn(slotStyles, "text-muted-foreground")
            : cn(controlStyles, markStyles),
          controlPadding,
          "flex w-full items-center justify-center text-center"
        )}
      >
        <RichText text={text} />
        <MarkText mark={marks[`${side === "left" ? "L" : "R"}${index}`]} />
      </Selectable>
    )
  }

  // Both columns share the grid's rows (a subgrid), so each item is as tall as the one beside it. The
  // columns stay whole in the DOM, so keyboards and screen readers go down one column, then the other.
  const rows = { gridRow: `span ${kata.pairs.length}` }
  return (
    <div
      ref={root}
      className="grid grid-cols-2 gap-x-3 gap-y-2"
      style={{ gridTemplateRows: `repeat(${kata.pairs.length}, auto)` }}
    >
      <div className="grid min-w-0 grid-rows-subgrid" style={rows}>
        {kata.pairs.map((p, i) =>
          tile("left", i, p.left, kata.leftLang, i in links)
        )}
      </div>
      <div className="grid min-w-0 grid-rows-subgrid" style={rows}>
        {rightOrder.map((j) =>
          tile(
            "right",
            j,
            kata.pairs[j]!.right,
            kata.rightLang,
            matchedRight.has(j)
          )
        )}
      </div>
      <div aria-live="polite" className="sr-only">
        {said}
      </div>
    </div>
  )
}

// ---------- blank (word chips) ----------

// The chips in gaps are worked out in player-core (state.ts), shared with the app.
export { chipsInGaps }

/**
 * Gaps to fill from a bank of word chips, set like Duolingo's: the sentence sits on the page at
 * reading size, and a gap is an underline as wide as the longest word, so the text never jumps.
 * The gap waiting for a word has a blinking caret. Tapping a word (or its number key) slides it
 * onto that line, and tapping it there sends it back. A used word leaves a soft ghost in the bank,
 * so the other chips stay put.
 */
export function BlankKata({
  kata,
  answer,
  setAnswer,
  marks,
  locked,
  bank,
}: QuestionKataProps & { bank: string[] }) {
  const { t, keyScope } = usePlayer()
  const uid = React.useId().replace(/[^\w-]/g, "")
  const root = React.useRef<HTMLDivElement>(null)
  const [active, setActive] = React.useState<string | null>(null)

  // After checking, wrong words give a small shake, as in sort and order.
  const wrong = Object.keys(marks)
    .filter((id) => marks[id] === "wrong")
    .join(",")
  React.useEffect(() => {
    if (wrong) shake(root.current)
  }, [wrong])

  const values = answer.kind === "gaps" ? answer.values : {}
  const gapIds = kata.type === "blank" ? kata.blanks.map((b) => b.id) : []
  const firstEmpty = gapIds.find((id) => !values[id])
  const target = active && !values[active] ? active : firstEmpty
  const placed = chipsInGaps(gapIds, values, bank)
  const used = new Set(Object.values(placed))

  /** Change the gaps with a slide, then wait at the next empty gap. */
  const fill = (next: Record<string, string>, wait: string | null) => {
    buzz()
    void fly(root.current, () => {
      setAnswer({ kind: "gaps", values: next })
      setActive(wait)
    })
  }
  const place = (word: string) => {
    if (!target) return
    const next = { ...values, [target]: word }
    fill(next, gapIds.find((id) => !next[id]) ?? null)
  }
  const unplace = (id: string) => fill({ ...values, [id]: "" }, id)

  // Number keys pick words, as they pick answer options: 1 for the first chip, 2 for the second…
  const pick = React.useRef<(n: number) => void>(() => {})
  pick.current = (n) => {
    const word = bank[n]
    if (word !== undefined && !used.has(n)) place(word)
  }
  React.useEffect(() => {
    if (locked) return
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || e.repeat) return
      const el = e.target as HTMLElement | null
      if (keyScope && !keyScope.current?.contains(el)) return
      if (shortcutBlocked(e)) return
      const n = Number(e.key)
      if (!Number.isInteger(n) || n < 1 || n > bank.length) return
      e.preventDefault()
      pick.current(n - 1)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [locked, keyScope, bank.length])

  if (kata.type !== "blank" || answer.kind !== "gaps") return null
  const code = kata.format === "code"
  const words = [...new Set(bank)]
  const parts = kata.template.split(/(\[\[[^\]]+\]\])/)
  const vt = (i: number) => `learn-${uid}-w${i}`
  // One reading size: the words are the sentence's size (code's is mono), set apart by weight and chip.
  // A word is the same chip in the bank and in a gap, so it reads as one thing moving.
  const size = code ? "font-mono text-sm" : "text-base font-medium"
  const inline = cn(controlStyles, "px-2.5 py-0.5", size)

  return (
    <div ref={root} className="flex flex-col gap-8">
      {/* The sentence is the content: on the page, at reading size, with no card around it. */}
      <div
        lang={kata.lang}
        dir={code ? "ltr" : undefined}
        className={cn(
          "whitespace-pre-wrap",
          code ? "font-mono text-sm leading-9" : "text-base leading-9"
        )}
      >
        {parts.map((part, i) => {
          const m = part.match(/^\[\[(.+)\]\]$/)
          if (!m) return <React.Fragment key={i}>{part}</React.Fragment>
          const id = m[1]!
          const value = values[id]
          const waiting = !locked && !value && target === id
          return (
            <Selectable
              key={i}
              aria-label={value || t.emptyGap}
              isSelected={waiting}
              onChange={() => (value ? unplace(id) : setActive(id))}
              // Enter on a filled gap checks the answer rather than taking its word out (Space still does).
              data-enter={value ? "main" : undefined}
              isDisabled={locked}
              className={cn(
                // A line the word lands on, as wide as the longest word.
                "group/gap inline-grid items-center justify-items-center align-baseline leading-normal transition-colors",
                value
                  ? "mx-0.5"
                  : // An underline just under the text, the width of the longest word as a chip.
                    "mx-1 border-b-2 border-muted-foreground/40 data-selected:border-foreground"
              )}
            >
              {/* While empty, every word as a hidden chip in the same cell sets the width, so the
                  line fits whichever word lands. Filled, the gap fits its word and the text closes up. */}
              {(value ? [] : words).map((w) => (
                <span
                  key={w}
                  aria-hidden="true"
                  className={cn(
                    controlSurface,
                    "invisible border-y-0 px-2.5 shadow-none [grid-area:1/1]",
                    size
                  )}
                >
                  {w}
                </span>
              ))}
              <span className="[grid-area:1/1]">
                {value ? (
                  <span
                    // A gap emptied for another try loses its mark with its word.
                    data-status={marks[id]}
                    data-vt={
                      placed[id] !== undefined ? vt(placed[id]!) : undefined
                    }
                    className={cn(
                      inline,
                      "block group-hover/gap:bg-muted dark:group-hover/gap:bg-input/50",
                      markStyles
                    )}
                  >
                    {value}
                    <MarkText mark={marks[id]} />
                  </span>
                ) : waiting ? (
                  <span className="learn-caret">
                    <span />
                  </span>
                ) : null}
              </span>
            </Selectable>
          )
        })}
      </div>
      <div
        role="group"
        aria-label={t.wordBank}
        className="flex flex-wrap gap-2"
      >
        {bank.map((word, i) => {
          const gone = used.has(i)
          return (
            <Selectable
              key={`${word}-${i}`}
              aria-label={word}
              isSelected={gone}
              onChange={() => !gone && place(word)}
              isDisabled={locked || gone}
              lang={kata.lang}
              data-vt={gone ? undefined : vt(i)}
              className={cn(
                "flex items-center gap-2",
                gone
                  ? // An outlined slot holds its place, so the other chips don't move (like the sort kata's empty lanes).
                    cn(slotStyles, "py-1 ps-3 pe-2 text-transparent", size)
                  : cn(controlStyles, "py-1 ps-3 pe-2", size)
              )}
            >
              {word}
              {/* Its number key, as on answer options. Kept in a used or checked chip, unseen, so it doesn't shrink. */}
              {i < 9 ? (
                <Kbd
                  aria-hidden="true"
                  className={cn(keyHintStyles, (gone || locked) && "invisible")}
                >
                  {i + 1}
                </Kbd>
              ) : null}
            </Selectable>
          )
        })}
      </div>
    </div>
  )
}
