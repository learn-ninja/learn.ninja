"use client"

import * as React from "react"

import { Button } from "@workspace/ui/components/button"
import { cn } from "@workspace/ui/lib/utils"

import type { QuestionBrickProps } from "./bricks"
import { usePlayer } from "./context"
import {
  controlPadding,
  controlStyles,
  markStyles,
  slotStyles,
} from "./controls"
import { MarkText } from "./marks"
import { buzz, fly, shake } from "./motion"
import { RichText } from "./rich-text"
import { Visual } from "./visuals"

// The order brick: numbered slots wait on top and the shuffled items below. Tap the items in order and
// each slides into the next open slot, leaving a dashed space in the pool so the rest never shift; tap
// a placed item to send it back. With a keyboard, Enter or Space places or returns an item, ↑ and ↓
// move a placed item up or down, and focus never gets lost.

export function OrderBrick({
  brick,
  answer,
  setAnswer,
  marks,
  locked,
}: QuestionBrickProps) {
  const { t } = usePlayer()
  const uid = React.useId().replace(/[^\w-]/g, "")
  const root = React.useRef<HTMLDivElement>(null)
  const buttons = React.useRef<Record<string, HTMLButtonElement | null>>({})
  const [said, setSaid] = React.useState("")
  // Every item keeps its place in the pool, placed or not: a placed one leaves its space behind.
  const [shown] = React.useState(() =>
    answer.kind === "sequence"
      ? [
          ...answer.pool,
          ...answer.slots.filter((id): id is string => id !== null),
        ]
      : []
  )

  const wrong = Object.keys(marks)
    .filter((id) => marks[id] === "wrong")
    .join(",")
  React.useEffect(() => {
    if (wrong) shake(root.current)
  }, [wrong])

  if (brick.type !== "order" || answer.kind !== "sequence") return null

  const { slots, pool } = answer
  const items = new Map(brick.items.map((it, i) => [it.id, { ...it, i }]))
  const visual = brick.items.some((it) => it.visual)
  const next = slots.indexOf(null)
  const textOf = (id: string) => items.get(id)?.text?.replace(/[*`]/g, "") ?? id

  /** Change the answer with a slide, then put focus where the learner can carry on. */
  const move = (
    nextSlots: (string | null)[],
    nextPool: string[],
    message: string,
    focus?: string
  ) => {
    setSaid(message)
    buzz()
    void fly(
      root.current,
      () => setAnswer({ kind: "sequence", slots: nextSlots, pool: nextPool }),
      () => focus && buttons.current[focus]?.focus()
    )
  }

  /** From the pool into the next open slot; focus moves on to the next item waiting. */
  const place = (id: string) => {
    if (next < 0) return
    const nextSlots = slots.map((s, i) => (i === next ? id : s))
    const nextPool = pool.filter((p) => p !== id)
    const at = pool.indexOf(id)
    move(
      nextSlots,
      nextPool,
      t.placedAt(textOf(id), next + 1),
      nextPool[Math.min(at, nextPool.length - 1)] ?? id
    )
  }
  /** From a slot back to the end of the pool. */
  const unplace = (id: string) =>
    move(
      slots.map((s) => (s === id ? null : s)),
      [...pool, id],
      t.placedIn(textOf(id), t.pool),
      id
    )
  /** Swap a placed item with the slot above or below it, empty or not. */
  const shift = (id: string, way: -1 | 1) => {
    const from = slots.indexOf(id)
    const to = from + way
    if (to < 0 || to >= slots.length) return
    const nextSlots = [...slots]
    ;[nextSlots[from], nextSlots[to]] = [nextSlots[to]!, nextSlots[from]!]
    move(nextSlots, pool, t.placedAt(textOf(id), to + 1), id)
  }

  /** Where a placed item waited: dashed, and as big as the item, so nothing around it moves. */
  const space = (id: string) => {
    const it = items.get(id)!
    return (
      <div
        key={id}
        aria-hidden="true"
        className={cn(
          slotStyles,
          visual ? "min-h-16 w-full" : cn(controlPadding, "w-auto max-w-full")
        )}
      >
        {visual ? null : (
          <RichText text={it.text ?? ""} lang={it.lang} className="invisible" />
        )}
      </div>
    )
  }

  const tile = (id: string, placed: boolean) => {
    const it = items.get(id)!
    return (
      <Button
        key={id}
        ref={(el) => {
          buttons.current[id] = el
        }}
        data-vt={`learn-${uid}-o${it.i}`}
        data-status={placed ? marks[id] : undefined}
        variant="outline"
        isDisabled={locked}
        onPress={() => (placed ? unplace(id) : place(id))}
        onKeyDown={(e) => {
          if (!placed || locked) return
          if (e.key === "ArrowUp" || e.key === "ArrowDown") {
            e.preventDefault()
            shift(id, e.key === "ArrowUp" ? -1 : 1)
          } else if (e.key === "Delete" || e.key === "Backspace") {
            e.preventDefault()
            unplace(id)
          }
        }}
        className={cn(
          controlStyles,
          controlPadding,
          "h-auto whitespace-normal disabled:opacity-100",
          markStyles,
          // Placed items fill their row; waiting ones are chips, or cards when they're visuals.
          // A long one wraps within the column rather than running off it (buttons don't shrink).
          placed
            ? "min-w-0 flex-1 shrink"
            : visual
              ? "w-full"
              : "w-auto max-w-full",
          placed && !visual ? "justify-start text-start" : "justify-center",
          it.visual && "p-2"
        )}
      >
        {it.visual ? (
          <Visual visual={it.visual} label={textOf(id)} plain />
        ) : (
          <RichText text={it.text ?? ""} lang={it.lang} />
        )}
        <MarkText mark={placed ? marks[id] : undefined} />
      </Button>
    )
  }

  return (
    <div ref={root} className="flex flex-col gap-5">
      <ol aria-label={brick.prompt} className="flex flex-col gap-2">
        {slots.map((id, i) => (
          <li key={i} className="flex items-center gap-3">
            <span
              aria-hidden="true"
              className={cn(
                "w-4 shrink-0 text-end text-sm font-semibold text-muted-foreground tabular-nums",
                i === next && "text-foreground"
              )}
            >
              {i + 1}
            </span>
            {id ? (
              tile(id, true)
            ) : (
              // An open slot; the next one to fill stands out a little. It takes a tile's padding and one
              // line of its text, so it's exactly as tall as a placed item at every text size.
              <div
                className={cn(
                  slotStyles,
                  "min-w-0 flex-1",
                  // Visual items get a shorter open slot on phones, so the pool stays in reach.
                  visual ? "min-h-16 sm:min-h-24" : controlPadding,
                  i === next && "border-foreground/40"
                )}
              >
                {visual ? null : <span aria-hidden="true">{"\u200b"}</span>}
                <span className="sr-only">{t.emptyGap}</span>
              </div>
            )}
          </li>
        ))}
      </ol>
      {shown.length ? (
        <div
          role="group"
          aria-label={t.pool}
          className={cn(
            visual
              ? "grid grid-cols-2 gap-2 sm:grid-cols-3"
              : "flex flex-wrap justify-center gap-2"
          )}
        >
          {shown.map((id) => (pool.includes(id) ? tile(id, false) : space(id)))}
        </div>
      ) : null}
      <div aria-live="polite" className="sr-only">
        {said}
      </div>
    </div>
  )
}
