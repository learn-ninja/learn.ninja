"use client"

import * as React from "react"

import { Tooltip, TooltipTrigger } from "@workspace/ui/components/tooltip"
import { cn } from "@workspace/ui/lib/utils"

import {
  describeDay,
  GRID_WEEKS,
  type ActivityCell,
  type ActivityGridData,
  type Level,
} from "@/lib/activity/activity"

/**
 * A year of learning as GitHub draws a year of commits: 53 week columns, Sunday at the top, a
 * shade per day, month labels above, the year's total (streaks on hover) and the Less/More legend
 * below, and a tooltip per day. A rest day that kept the streak is the lantern's blue, named by
 * its tooltip. The shades
 * are relative to the person (lib/activity/activity.ts). The data is built on the server, so the
 * grid ends on the viewer's today and the markup never disagrees with it. Cells scale to the
 * column; on phones the grid scrolls sideways, starting at the newest weeks.
 */
export function ActivityGrid({
  grid,
  className,
}: {
  grid: ActivityGridData
  className?: string
}) {
  const scroller = React.useRef<HTMLDivElement>(null)
  React.useEffect(() => {
    const el = scroller.current
    if (!el) return
    // Newest weeks first when it scrolls; in right-to-left the end is on the left.
    const rtl = getComputedStyle(el).direction === "rtl"
    el.scrollLeft = rtl ? -el.scrollWidth : el.scrollWidth
  }, [])
  // One cell is in the tab order; arrow keys move between days, like GitHub's graph.
  const [focused, setFocused] = React.useState<string | null>(null)
  const first = grid.columns.flat().find(Boolean)?.day ?? null
  const active = focused ?? first
  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement
    const col = Number(target.dataset.col)
    const row = Number(target.dataset.row)
    if (Number.isNaN(col) || Number.isNaN(row)) return
    const rtl = getComputedStyle(e.currentTarget).direction === "rtl"
    const forward = rtl ? "ArrowLeft" : "ArrowRight"
    const back = rtl ? "ArrowRight" : "ArrowLeft"
    const moves: Record<string, [number, number]> = {
      [forward]: [1, 0],
      [back]: [-1, 0],
      ArrowDown: [0, 1],
      ArrowUp: [0, -1],
    }
    const move = moves[e.key]
    if (!move) return
    const next = grid.columns[col + move[0]]?.[row + move[1]]
    if (!next) return
    e.preventDefault()
    setFocused(next.day)
    e.currentTarget
      .querySelector<HTMLElement>(`[data-day="${next.day}"]`)
      ?.focus()
  }

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div ref={scroller} className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <div
          role="grid"
          aria-label="Lessons finished, by day, over the last year"
          aria-rowcount={8}
          aria-colcount={GRID_WEEKS}
          onKeyDown={onKeyDown}
          className="min-w-[33rem] text-xs text-muted-foreground"
        >
          <div
            role="row"
            className="mb-1 grid h-4 gap-[3px]"
            style={{ gridTemplateColumns: `repeat(${GRID_WEEKS}, minmax(0, 1fr))` }}
          >
            {grid.months.map((m) => (
              // Pinned to the row: a label may overlap the next label's columns (never its text).
              <span
                key={m.column}
                role="columnheader"
                className="whitespace-nowrap"
                style={{ gridColumn: `${m.column + 1} / span 3`, gridRow: 1 }}
              >
                {m.label}
              </span>
            ))}
          </div>
          {Array.from({ length: 7 }, (_, row) => (
            <div
              key={row}
              role="row"
              className="mb-[3px] grid gap-[3px] last:mb-0"
              style={{ gridTemplateColumns: `repeat(${GRID_WEEKS}, minmax(0, 1fr))` }}
            >
              {grid.columns.map((week, col) => {
                const cell = week[row]
                return cell ? (
                  <DayCell
                    key={cell.day}
                    cell={cell}
                    col={col}
                    row={row}
                    inTabOrder={cell.day === active}
                    onFocus={() => setFocused(cell.day)}
                  />
                ) : (
                  <span key={`${col}-${row}`} role="gridcell" aria-hidden="true" />
                )
              })}
            </div>
          ))}
        </div>
      </div>
      <Footer grid={grid} />
    </div>
  )
}

const LEVEL_CLASS: Record<Level, string> = {
  0: "bg-activity-0",
  1: "bg-activity-1",
  2: "bg-activity-2",
  3: "bg-activity-3",
  4: "bg-activity-4",
}

function DayCell({
  cell,
  col,
  row,
  inTabOrder,
  onFocus,
}: {
  cell: ActivityCell
  col: number
  row: number
  inTabOrder: boolean
  onFocus: () => void
}) {
  const label = describeDay(cell)
  return (
    <TooltipTrigger delay={0}>
      <div
        role="gridcell"
        tabIndex={inTabOrder ? 0 : -1}
        aria-label={label}
        data-day={cell.day}
        data-col={col}
        data-row={row}
        data-level={cell.level}
        data-rest={cell.rest || undefined}
        onFocus={onFocus}
        className={cn(
          "aspect-square rounded-xs outline-none ring-1 ring-inset ring-foreground/5 focus-visible:ring-2 focus-visible:ring-ring",
          cell.rest ? "bg-activity-rest" : LEVEL_CLASS[cell.level]
        )}
      />
      <Tooltip>{label}</Tooltip>
    </TooltipTrigger>
  )
}

/**
 * The row under the grid: the year's total at the start, underlined because hovering or focusing
 * it shows the streaks, and the Less/More legend at the end.
 */
function Footer({ grid }: { grid: ActivityGridData }) {
  const { total, streak } = grid
  const days = (n: number) => `${n} ${n === 1 ? "day" : "days"}`
  return (
    <div className="flex items-center justify-between gap-4 text-xs text-muted-foreground">
      <TooltipTrigger delay={0}>
        <span
          tabIndex={0}
          className="rounded-xs underline decoration-dotted underline-offset-3 outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {total} {total === 1 ? "lesson" : "lessons"} in the last year
        </span>
        <Tooltip>
          {streak.longest > 0
            ? `Current streak ${days(streak.current)} · Longest ${days(streak.longest)}`
            : "No streak yet"}
        </Tooltip>
      </TooltipTrigger>
      <div className="flex items-center gap-[3px]" aria-hidden="true">
        <span className="me-1">Less</span>
        {([0, 1, 2, 3, 4] as Level[]).map((level) => (
          <span
            key={level}
            className={cn(
              "size-2.5 rounded-xs ring-1 ring-inset ring-foreground/5",
              LEVEL_CLASS[level]
            )}
          />
        ))}
        <span className="ms-1">More</span>
      </div>
    </div>
  )
}
