import type { LessonRowData, Viewer } from "./feed"

// What a lesson's row says, as the web's LessonRow decides it (apps/web/components/explore/
// lesson-row.tsx, lesson-time.tsx): pure, so it's tested without a screen.

/** In the length's place: Done once finished, the minutes left while partway, else the length. */
export type RowTime =
  | { kind: "done"; at: number }
  | {
      kind: "left"
      minutes: number
      share: number
      done: number
      total: number
    }
  | { kind: "length"; minutes: number }

/**
 * The row's time. Progress kept on this device wins over the account's (it's at least as fresh),
 * and a replay in progress shows how far it's got rather than the earlier finish.
 */
export function rowTime(
  row: LessonRowData,
  viewer: Viewer | undefined,
  local: { done: number; total: number } | null
): RowTime {
  const progress = local ?? row.progress ?? null
  if (progress && progress.total > 0) {
    const share = progress.done / progress.total
    return {
      kind: "left",
      minutes: Math.max(1, Math.round(row.minutes * (1 - share))),
      share,
      done: progress.done,
      total: progress.total,
    }
  }
  const at = viewer?.completed[row.id]
  return at !== undefined
    ? { kind: "done", at }
    : { kind: "length", minutes: row.minutes }
}

/** The badge on the viewer's own rows that visitors don't see. */
export function rowBadge(
  row: LessonRowData,
  viewerId: string | undefined
): "private" | "hidden" | null {
  if (!viewerId || row.author?.id !== viewerId) return null
  if (row.hidden) return "hidden"
  return row.visibility !== "public" ? "private" : null
}

/** "1.2K" for the counts. */
export function compact(n: number, lang: string): string {
  try {
    return new Intl.NumberFormat(lang, {
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(n)
  } catch {
    return String(n)
  }
}

/** A wedge of the progress pie's inner disc from 12 o'clock, clockwise, covering `share` of it. */
export function wedge(share: number): string {
  const r = 5
  if (share <= 0) return ""
  if (share >= 1)
    return `M12 ${12 - r}a${r} ${r} 0 1 1 0 ${2 * r}a${r} ${r} 0 1 1 0 ${-2 * r}Z`
  const angle = share * 2 * Math.PI
  const x = 12 + r * Math.sin(angle)
  const y = 12 - r * Math.cos(angle)
  return `M12 12V${12 - r}A${r} ${r} 0 ${share > 0.5 ? 1 : 0} 1 ${x.toFixed(2)} ${y.toFixed(2)}Z`
}
