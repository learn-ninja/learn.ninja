import * as React from "react"

import { readFen, type ChessVisual, type FenPiece } from "@workspace/spec"
import { Selectable } from "@workspace/ui/components/selectable"
import { cn } from "@workspace/ui/lib/utils"

import { PIECES, type PieceCode } from "./chess-pieces"
import type { HotspotControl } from "./visuals"

// A chess position drawn as SVG in the browser: the board, its marked squares and arrows, and the
// chessnut pieces. visuals.tsx loads this module only for a lesson that has a board, since the
// pieces are most of its size.

// The board is drawn in theme tokens, so it sits lightly on the page in both themes: light squares
// are clear, dark squares a faint wash of the text color, and the marks take the accent.
const MARK = "var(--chart-2)"
/** Room beside and under the board for the ranks and files, in squares. */
const GUTTER = 0.4

const FILES = "abcdefgh"

const code = (p: FenPiece) =>
  `${p === p.toUpperCase() ? "w" : "b"}${p.toUpperCase()}` as PieceCode

export default function ChessBoard({
  board,
  plain,
  hotspots,
}: {
  board: ChessVisual
  /** On an option or item card: smaller, so the coordinates and their gutter are left off. */
  plain: boolean
  /** On a hotspot brick: every square is tappable, its id the square's name. */
  hotspots?: HotspotControl
}) {
  // React's ids carry characters a fragment link might not survive.
  const id = `chess${React.useId().replace(/[^\w-]/g, "")}`
  const read = readFen(board.fen)
  // The checker rejects a FEN it can't read; a stored lesson shows an empty board.
  const placement = "error" in read ? [] : read.placement
  const flip = board.flip ?? false
  // Where a square sits on the drawing: column and row from the top start corner, in squares.
  const at = (square: string) => {
    const file = square.charCodeAt(0) - 97
    const rank = Number(square[1])
    return flip ? { x: 7 - file, y: rank - 1 } : { x: file, y: 8 - rank }
  }
  const pieces = placement.flatMap((row, r) =>
    row.flatMap((p, f) =>
      p ? [{ code: code(p), square: `${FILES[f]}${8 - r}` }] : []
    )
  )
  const used = [...new Set(pieces.map((p) => p.code))]
  const gutter = plain ? 0 : GUTTER

  const drawing = (
    <svg
      viewBox={`${-gutter} 0 ${8 + gutter} ${8 + gutter}`}
      className="block h-auto w-full"
      aria-hidden
    >
      <defs>
        <clipPath id={`${id}-board`}>
          <rect width={8} height={8} rx={0.08} />
        </clipPath>
        {used.map((c) => (
          <symbol
            key={c}
            id={`${id}-${c}`}
            viewBox="0 0 800 800"
            dangerouslySetInnerHTML={{ __html: PIECES[c] }}
          />
        ))}
      </defs>
      <g clipPath={`url(#${id}-board)`}>
        {Array.from({ length: 64 }, (_, i) => {
          const x = i % 8
          const y = Math.floor(i / 8)
          // a1 is dark: a square is dark when its file and rank numbers add up to an even number.
          const file = flip ? 7 - x : x
          const rank = flip ? y + 1 : 8 - y
          if ((file + rank) % 2 === 0) return null
          return (
            <rect
              key={i}
              x={x}
              y={y}
              width={1}
              height={1}
              className="fill-foreground/8 dark:fill-foreground/12"
            />
          )
        })}
        {(board.highlight ?? []).map((square) => {
          const { x, y } = at(square)
          return (
            <rect
              key={square}
              x={x}
              y={y}
              width={1}
              height={1}
              className="fill-chart-2/25 dark:fill-chart-2/35"
            />
          )
        })}
      </g>
      <rect
        width={8}
        height={8}
        rx={0.08}
        fill="none"
        strokeWidth={1}
        vectorEffect="non-scaling-stroke"
        className="stroke-foreground/15"
      />
      {!plain && <Coordinates flip={flip} />}
      {pieces.map(({ code, square }) => {
        const { x, y } = at(square)
        const place = {
          href: `#${id}-${code}`,
          x: x + 0.04,
          y: y + 0.04,
          width: 0.92,
          height: 0.92,
        }
        return (
          <React.Fragment key={square}>
            {/* On a dark page a black piece would melt into it, so in dark mode a copy stroked
                in a light color sits behind it: only the stroke's outer half shows, as an edge. */}
            {code.startsWith("b") && (
              <use
                {...place}
                strokeWidth={36}
                strokeLinejoin="round"
                className="hidden fill-foreground/40 stroke-foreground/40 dark:inline"
              />
            )}
            <use {...place} />
          </React.Fragment>
        )
      })}
      {(board.arrows ?? []).map((a, i) => (
        <Arrow key={i} from={at(a.from)} to={at(a.to)} />
      ))}
    </svg>
  )
  if (!hotspots) return drawing
  return (
    <div className="relative">
      {drawing}
      <Squares
        flip={flip}
        gutter={gutter}
        first={board.highlight?.[0]}
        control={hotspots}
      />
    </div>
  )
}

/** The square at a column and row from the top start corner of the drawing. */
const squareAt = (x: number, y: number, flip: boolean) =>
  flip ? `${FILES[7 - x]}${y + 1}` : `${FILES[x]}${8 - y}`

const STEPS: Record<string, [number, number]> = {
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
}

/**
 * The board's squares as toggles laid over the drawing, for a hotspot. The board is one tab stop:
 * the arrow keys move between squares, so the keyboard doesn't walk through 64 buttons.
 */
function Squares({
  flip,
  gutter,
  first,
  control,
}: {
  flip: boolean
  gutter: number
  /** The square the board's tab stop starts on when nothing is picked: the piece in question. */
  first?: string
  control: HotspotControl
}) {
  const refs = React.useRef(new Map<string, HTMLButtonElement>())
  const [active, setActive] = React.useState<string | null>(null)
  const order = Array.from({ length: 64 }, (_, i) =>
    squareAt(i % 8, Math.floor(i / 8), flip)
  )
  const stop = active ?? control.selected[0] ?? first ?? order[0]!
  const onKeyDown = (e: React.KeyboardEvent) => {
    const step = STEPS[e.key]
    const i = order.indexOf((e.target as HTMLElement).dataset.square ?? "")
    if (!step || i < 0) return
    const x = (i % 8) + step[0]
    const y = Math.floor(i / 8) + step[1]
    if (x < 0 || x > 7 || y < 0 || y > 7) return
    e.preventDefault()
    refs.current.get(squareAt(x, y, flip))?.focus()
  }
  return (
    // The board is always drawn left to right (its block sets dir="ltr"), so its start is the left.
    <div
      onKeyDown={onKeyDown}
      className="absolute top-0 grid aspect-square grid-cols-8 grid-rows-8"
      style={{
        insetInlineStart: `${(gutter / (8 + gutter)) * 100}%`,
        width: `${(8 / (8 + gutter)) * 100}%`,
      }}
    >
      {order.map((square) => (
        <Selectable
          key={square}
          ref={(el) => {
            if (el) refs.current.set(square, el)
            else refs.current.delete(square)
          }}
          data-square={square}
          aria-label={square}
          isSelected={control.selected.includes(square)}
          onChange={() => control.onToggle(square)}
          onFocus={() => setActive(square)}
          isDisabled={control.disabled}
          excludeFromTabOrder={square !== stop}
          data-status={control.marks[square]}
          className={cn(
            "cursor-pointer focus-visible:z-10 data-hovered:bg-primary/10",
            "data-selected:bg-primary/10 data-selected:inset-ring-2 data-selected:inset-ring-primary",
            // A checked square takes the answer colors: a 10% tint inside a ring of the color.
            "data-[status=correct]:bg-green-600/10! data-[status=correct]:inset-ring-2 data-[status=correct]:inset-ring-green-600!",
            "data-[status=wrong]:bg-yellow-500/10! data-[status=wrong]:inset-ring-2 data-[status=wrong]:inset-ring-yellow-500!"
          )}
        />
      ))}
    </div>
  )
}

/** The files under the board and the ranks beside it, in muted text outside the squares. */
function Coordinates({ flip }: { flip: boolean }) {
  const text = {
    fontSize: 0.24,
    className: "fill-muted-foreground",
    style: { fontFamily: "inherit" },
  } as const
  return (
    <g>
      {Array.from({ length: 8 }, (_, i) => (
        <React.Fragment key={i}>
          <text {...text} x={i + 0.5} y={8 + GUTTER - 0.08} textAnchor="middle">
            {FILES[flip ? 7 - i : i]}
          </text>
          <text {...text} x={-GUTTER / 2} y={i + 0.58} textAnchor="middle">
            {flip ? i + 1 : 8 - i}
          </text>
        </React.Fragment>
      ))}
    </g>
  )
}

/** A move: a thick line from the middle of one square to the middle of another, with its head. */
function Arrow({
  from,
  to,
}: {
  from: { x: number; y: number }
  to: { x: number; y: number }
}) {
  const x1 = from.x + 0.5
  const y1 = from.y + 0.5
  const x2 = to.x + 0.5
  const y2 = to.y + 0.5
  const length = Math.hypot(x2 - x1, y2 - y1)
  const ux = (x2 - x1) / length
  const uy = (y2 - y1) / length
  const head = 0.42
  const width = 0.36
  // The head's tip lands a little short of the square's middle, so the piece there still shows.
  const tipX = x2 - ux * 0.12
  const tipY = y2 - uy * 0.12
  const baseX = tipX - ux * head
  const baseY = tipY - uy * head
  return (
    <g opacity={0.8}>
      <line
        x1={x1 + ux * 0.15}
        y1={y1 + uy * 0.15}
        x2={baseX}
        y2={baseY}
        stroke={MARK}
        strokeWidth={0.16}
        strokeLinecap="round"
      />
      <polygon
        points={`${tipX},${tipY} ${baseX - uy * (width / 2)},${baseY + ux * (width / 2)} ${baseX + uy * (width / 2)},${baseY - ux * (width / 2)}`}
        fill={MARK}
      />
    </g>
  )
}
