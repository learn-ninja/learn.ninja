"use client"

import * as React from "react"
import { CheckIcon, XIcon } from "lucide-react"

import type {
  ConceptBrick as ConceptBrickData,
  QuestionBrick,
} from "@workspace/spec"
import { Kbd } from "@workspace/ui/components/kbd"
import { Selectable } from "@workspace/ui/components/selectable"
import { cn } from "@workspace/ui/lib/utils"

import { POOL, type Answer, type Mark } from "./check"
import { usePlayer } from "./context"
import { DropZone } from "./dnd"
import { RichText } from "./rich-text"
import { Visual } from "./visuals"

export interface QuestionBrickProps {
  brick: QuestionBrick
  answer: Answer
  setAnswer: (answer: Answer) => void
  marks: Record<string, Mark>
  /** True after checking: the answer can't change until the learner tries again. */
  locked: boolean
}

const markStyles =
  "data-[status=correct]:border-green-600 data-[status=correct]:bg-green-600/10 " +
  "data-[status=wrong]:border-yellow-500 data-[status=wrong]:bg-yellow-500/10 " +
  "data-[status=partial]:border-amber-500 data-[status=partial]:bg-amber-500/10"

// Answer options show their result in the key badge, so the row itself stays neutral.
const cardStyles =
  "w-full rounded-lg border bg-background text-start shadow-xs transition-colors dark:bg-input/30 dark:hover:bg-input/50 dark:data-selected:bg-muted " +
  "hover:bg-muted data-selected:border-primary data-selected:bg-muted data-pressed:translate-y-px "

/** The number key that picks an option, or after checking, whether it was right. */
function KeyHint({ i, mark }: { i: number; mark?: Mark }) {
  if (mark === "correct" || mark === "wrong" || mark === "partial")
    return (
      <Kbd
        aria-hidden="true"
        className={cn(
          "ms-auto shrink-0",
          mark === "correct"
            ? "bg-green-500 text-green-950"
            : "bg-yellow-500 text-yellow-950"
        )}
      >
        {mark === "correct" ? <CheckIcon /> : <XIcon />}
      </Kbd>
    )
  return (
    <Kbd aria-hidden="true" className="ms-auto shrink-0 pointer-coarse:hidden">
      {i + 1}
    </Kbd>
  )
}

// ---------- concept ----------

/** Theory: one idea with an optional visual and a key term. Nothing to answer. */
export function ConceptBrick({ brick }: { brick: ConceptBrickData }) {
  return (
    <>
      <h2 className="text-2xl font-semibold text-balance">{brick.title}</h2>
      {brick.visual ? <Visual visual={brick.visual} /> : null}
      <p className="text-base">
        <RichText text={brick.body} />
      </p>
      {brick.term ? (
        <div className="flex items-baseline gap-3 rounded-lg bg-secondary px-4 py-3 text-secondary-foreground">
          <strong className="font-semibold whitespace-nowrap">
            {brick.term.word}
          </strong>
          <RichText text={brick.term.definition} />
        </div>
      ) : null}
    </>
  )
}

// ---------- choice, compare, scenario ----------

/**
 * Compare options, and choice options with visuals, show as cards in two columns: each card has an
 * "Option n" label, the visual, and an optional caption. Other options are rows.
 */
export function hasOptionCards(brick: QuestionBrick): boolean {
  if (brick.type === "compare") return true
  return brick.type === "choice" && brick.options.some((o) => o.visual)
}

export function OptionsBrick({
  brick,
  answer,
  setAnswer,
  marks,
  locked,
  order,
  showOutcomes,
}: QuestionBrickProps & { order: string[]; showOutcomes: string[] }) {
  const { t } = usePlayer()
  const isOptions =
    brick.type === "choice" ||
    brick.type === "compare" ||
    brick.type === "scenario"
  const selected = answer.kind === "select" ? answer.ids : []
  const multiple = brick.type === "choice" && brick.multiple
  const toggle = (id: string) => {
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
          (brick.options as { id: string }[]).find((o) => o.id === id)!
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
      if (target?.closest("input, textarea, select, [contenteditable=true]"))
        return
      const n = Number(e.key)
      if (!Number.isInteger(n) || n < 1 || n > list.length) return
      e.preventDefault()
      toggleRef.current(list[n - 1]!)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [ids, locked])

  if (!isOptions) return null
  const cards = hasOptionCards(brick)

  return (
    <div
      role="group"
      aria-label={brick.prompt}
      className={cn("grid gap-3", cards && "sm:grid-cols-2")}
    >
      {options.map((raw, i) => {
        const o = raw as {
          id: string
          text?: string
          visual?: import("@workspace/spec").Visual
          lang?: string
          outcome?: string
        }
        return (
          <Selectable
            key={o.id}
            isSelected={selected.includes(o.id)}
            onChange={() => toggle(o.id)}
            isDisabled={locked}
            data-status={marks[o.id]}
            className={cn(
              "group",
              cardStyles,
              cards
                ? "flex flex-col gap-2 p-3"
                : "flex min-h-12 items-center gap-2 px-4 py-3"
            )}
          >
            {cards ? (
              <>
                <span className="flex items-center gap-2 px-1 text-sm font-medium text-muted-foreground">
                  {t.optionLabel(String(i + 1))}
                  <KeyHint i={i} mark={marks[o.id]} />
                </span>
                {o.visual ? (
                  <Visual
                    visual={o.visual}
                    label={t.optionLabel(String(i + 1))}
                  />
                ) : null}
                {o.text ? (
                  <RichText
                    text={o.text}
                    lang={o.lang}
                    className="px-1 text-sm font-medium"
                  />
                ) : null}
              </>
            ) : (
              <>
                <span className="flex min-w-0 flex-1 flex-col gap-2">
                  {o.text ? (
                    <RichText
                      text={o.text}
                      lang={o.lang}
                      className="text-sm font-medium"
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
                <KeyHint i={i} mark={marks[o.id]} />
              </>
            )}
          </Selectable>
        )
      })}
    </div>
  )
}

// ---------- hotspot ----------

export function HotspotBrick({
  brick,
  answer,
  setAnswer,
  marks,
  locked,
}: QuestionBrickProps) {
  if (brick.type !== "hotspot") return null
  const selected = answer.kind === "select" ? answer.ids : []
  const onToggle = (id: string) =>
    setAnswer({
      kind: "select",
      ids: brick.multiple
        ? selected.includes(id)
          ? selected.filter((x) => x !== id)
          : [...selected, id]
        : [id],
    })
  return (
    <Visual
      visual={brick.visual}
      hotspots={{ selected, marks, onToggle, disabled: locked }}
      label={brick.prompt}
    />
  )
}

// ---------- sort and order (drag and drop) ----------

function moveItem(
  zones: Record<string, string[]>,
  itemId: string,
  toZone: string,
  index: number
): Record<string, string[]> {
  const next = Object.fromEntries(
    Object.entries(zones).map(([z, ids]) => [
      z,
      ids.filter((id) => id !== itemId),
    ])
  )
  const target = next[toZone] ?? []
  target.splice(Math.min(index, target.length), 0, itemId)
  next[toZone] = target
  return next
}

export function SortBrick({
  brick,
  answer,
  setAnswer,
  marks,
  locked,
}: QuestionBrickProps) {
  const { t } = usePlayer()
  if (brick.type !== "sort" || answer.kind !== "zones") return null
  const byId = new Map(brick.items.map((i) => [i.id, i]))
  const zoneItems = (zone: string) =>
    (answer.zones[zone] ?? []).map((id) => {
      const it = byId.get(id)!
      return {
        id,
        textValue: it.text.replace(/[*`]/g, ""),
        content: <RichText text={it.text} />,
        lang: it.lang,
        mark: marks[id],
      }
    })
  const onMove = (itemId: string, zone: string, index: number) =>
    setAnswer({
      kind: "zones",
      zones: moveItem(answer.zones, itemId, zone, index),
    })

  return (
    <div className="flex flex-col gap-3">
      <DropZone
        zoneId={POOL}
        label={t.pool}
        items={zoneItems(POOL)}
        emptyText={t.allPlaced}
        onMove={onMove}
        layout="grid"
        disabled={locked}
      />
      <div
        className={cn(
          "grid gap-3",
          brick.groups.length === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2"
        )}
      >
        {brick.groups.map((g) => (
          <div key={g.id} className="flex min-w-0 flex-col gap-2">
            <div
              lang={g.lang}
              className="px-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase"
            >
              {g.label}
            </div>
            <DropZone
              zoneId={g.id}
              label={g.label}
              items={zoneItems(g.id)}
              emptyText={t.dropHere}
              onMove={onMove}
              disabled={locked}
              className="min-h-28"
            />
          </div>
        ))}
      </div>
    </div>
  )
}

export function OrderBrick({
  brick,
  answer,
  setAnswer,
  marks,
  locked,
}: QuestionBrickProps) {
  if (brick.type !== "order" || answer.kind !== "sequence") return null
  const byId = new Map(brick.items.map((i) => [i.id, i]))
  const items = answer.ids.map((id) => {
    const it = byId.get(id)!
    return {
      id,
      textValue: it.text?.replace(/[*`]/g, "") ?? id,
      content: it.visual ? (
        <Visual visual={it.visual} />
      ) : (
        <RichText text={it.text ?? ""} />
      ),
      lang: it.lang,
      mark: marks[id],
    }
  })
  const onMove = (itemId: string, _zone: string, index: number) => {
    const rest = answer.ids.filter((id) => id !== itemId)
    rest.splice(Math.min(index, rest.length), 0, itemId)
    setAnswer({ kind: "sequence", ids: rest })
  }
  return (
    <DropZone
      zoneId="order"
      label={brick.prompt}
      items={items}
      emptyText=""
      onMove={onMove}
      disabled={locked}
    />
  )
}

// ---------- match ----------

const PAIR_COLORS = ["#3b6cf6", "#d98b06", "#d6337a", "#0f9a9a", "#8b5cf6"]

export function MatchBrick({
  brick,
  answer,
  setAnswer,
  marks,
  locked,
  rightOrder,
}: QuestionBrickProps & { rightOrder: number[] }) {
  const [armed, setArmed] = React.useState<number | null>(null)
  if (brick.type !== "match" || answer.kind !== "pairs") return null
  const links = answer.links
  const paired = Object.keys(links)
    .map(Number)
    .sort((a, b) => a - b)
  const pairNumber = (left: number) => paired.indexOf(left)
  const ownerOf = (right: number) => paired.find((l) => links[l] === right)

  const pressLeft = (i: number) => {
    const next = { ...links }
    delete next[i]
    setAnswer({ kind: "pairs", links: next })
    setArmed(armed === i ? null : i)
  }
  const pressRight = (j: number) => {
    const next = { ...links }
    const owner = ownerOf(j)
    if (owner !== undefined) delete next[owner]
    if (armed !== null) {
      next[armed] = j
      setArmed(null)
    }
    setAnswer({ kind: "pairs", links: next })
  }

  const badge = (k: number) => (
    <span
      aria-hidden="true"
      className="grid size-6 shrink-0 place-items-center rounded-full border border-dashed text-xs font-bold text-white"
      style={
        k >= 0
          ? {
              background: PAIR_COLORS[k % PAIR_COLORS.length],
              borderColor: PAIR_COLORS[k % PAIR_COLORS.length],
              borderStyle: "solid",
            }
          : undefined
      }
    >
      {k >= 0 ? k + 1 : ""}
    </span>
  )
  const chip =
    "flex w-full items-center gap-2.5 rounded-lg border bg-background px-3 py-2.5 text-start text-base shadow-xs hover:bg-muted data-selected:border-primary data-selected:bg-muted dark:bg-input/30 dark:hover:bg-input/50 dark:data-selected:bg-muted " +
    markStyles

  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="flex min-w-0 flex-col gap-2">
        {brick.pairs.map((p, i) => (
          <Selectable
            key={i}
            isSelected={armed === i}
            onChange={() => pressLeft(i)}
            isDisabled={locked}
            data-status={marks[`L${i}`]}
            lang={brick.leftLang}
            className={chip}
          >
            {badge(pairNumber(i))}
            <RichText text={p.left} />
          </Selectable>
        ))}
      </div>
      <div className="flex min-w-0 flex-col gap-2">
        {rightOrder.map((j) => {
          const owner = ownerOf(j)
          return (
            <Selectable
              key={j}
              isSelected={false}
              onChange={() => pressRight(j)}
              isDisabled={locked}
              data-status={marks[`R${j}`]}
              lang={brick.rightLang}
              className={chip}
            >
              {badge(owner === undefined ? -1 : pairNumber(owner))}
              <RichText text={brick.pairs[j]!.right} />
            </Selectable>
          )
        })}
      </div>
    </div>
  )
}

// ---------- blank (word chips) ----------

export function BlankBrick({
  brick,
  answer,
  setAnswer,
  marks,
  locked,
  bank,
}: QuestionBrickProps & { bank: string[] }) {
  const { t } = usePlayer()
  const [active, setActive] = React.useState<string | null>(null)
  if (brick.type !== "blank" || answer.kind !== "gaps") return null
  const values = answer.values
  const gapIds = brick.blanks.map((b) => b.id)
  const firstEmpty = gapIds.find((id) => !values[id])
  const target = active ?? firstEmpty ?? gapIds[gapIds.length - 1]!

  const place = (word: string) => {
    const next = { ...values, [target]: word }
    setAnswer({ kind: "gaps", values: next })
    setActive(gapIds.find((id) => !next[id]) ?? null)
  }
  const clear = (id: string) => {
    setAnswer({ kind: "gaps", values: { ...values, [id]: "" } })
    setActive(id)
  }

  const code = brick.format === "code"
  const parts = brick.template.split(/(\[\[[^\]]+\]\])/)
  return (
    <div className="flex flex-col gap-4">
      <div
        lang={brick.lang}
        dir={code ? "ltr" : undefined}
        className={cn(
          "rounded-xl bg-card px-5 py-4 whitespace-pre-wrap shadow-xs ring-1 ring-foreground/10",
          code ? "font-mono text-base leading-loose" : "text-xl leading-[2.3]"
        )}
      >
        {parts.map((part, i) => {
          const m = part.match(/^\[\[(.+)\]\]$/)
          if (!m) return <React.Fragment key={i}>{part}</React.Fragment>
          const id = m[1]!
          const value = values[id]
          return (
            <Selectable
              key={i}
              aria-label={value || t.emptyGap}
              isSelected={!locked && target === id && !value}
              onChange={() => clear(id)}
              isDisabled={locked}
              data-status={marks[id]}
              className={cn(
                "mx-0.5 inline-block min-w-[4.5rem] rounded-md border-b-2 border-primary bg-muted px-2 text-center align-baseline leading-normal",
                "data-selected:bg-primary/10",
                value &&
                  "border border-border bg-background shadow-xs dark:bg-input/30",
                markStyles
              )}
            >
              {value || " "}
            </Selectable>
          )
        })}
      </div>
      <div
        role="group"
        aria-label={t.wordBank}
        className="flex flex-wrap gap-2"
      >
        {bank.map((word) => {
          const used = Object.values(values).includes(word)
          return (
            <Selectable
              key={word}
              isSelected={used}
              onChange={() => !used && place(word)}
              isDisabled={locked}
              lang={brick.lang}
              className={cn(
                "rounded-md border bg-background px-3 py-1.5 shadow-xs hover:bg-muted dark:bg-input/30 dark:hover:bg-input/50 data-selected:opacity-45",
                code ? "font-mono text-sm" : "text-base"
              )}
            >
              {word}
            </Selectable>
          )
        })}
      </div>
    </div>
  )
}
