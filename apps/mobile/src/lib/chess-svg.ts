import { PIECES, type PieceCode } from "@workspace/player-core/chess-pieces"
import { readFen, type ChessVisual, type FenPiece } from "@workspace/spec"

import { alpha } from "./color"
import { colors } from "../../tokens"

// A chess position as an SVG string for react-native-svg, after the web's chess.tsx: the board,
// its marked squares and arrows, and the chessnut pieces, in the theme's colors.

const MARK = colors.chart[2]
/** Room beside and under the board for the ranks and files, in squares. */
export const GUTTER = 0.4
const FILES = "abcdefgh"

const code = (p: FenPiece) =>
  `${p === p.toUpperCase() ? "w" : "b"}${p.toUpperCase()}` as PieceCode

/** Where a square sits on the drawing: column and row from the top left corner, in squares. */
export function squarePlace(square: string, flip: boolean) {
  const file = square.charCodeAt(0) - 97
  const rank = Number(square[1])
  return flip ? { x: 7 - file, y: rank - 1 } : { x: file, y: 8 - rank }
}

/** The square at a column and row from the top left corner of the drawing. */
export const squareAt = (x: number, y: number, flip: boolean) =>
  flip ? `${FILES[7 - x]}${y + 1}` : `${FILES[x]}${8 - y}`

/** The board's 64 squares in drawing order, row by row from the top left. */
export const squareOrder = (flip: boolean) =>
  Array.from({ length: 64 }, (_, i) => squareAt(i % 8, Math.floor(i / 8), flip))

const n = (v: number) => String(Math.round(v * 1000) / 1000)

/** The board's SVG. `plain` leaves off the coordinates and their gutter, for a card. */
export function boardSvg(board: ChessVisual, plain: boolean): string {
  const read = readFen(board.fen)
  // The checker rejects a FEN it can't read; a stored lesson shows an empty board.
  const placement = "error" in read ? [] : read.placement
  const flip = board.flip ?? false
  const at = (square: string) => squarePlace(square, flip)
  const pieces = placement.flatMap((row, r) =>
    row.flatMap((p, f) =>
      p ? [{ code: code(p), square: `${FILES[f]}${8 - r}` }] : []
    )
  )
  const used = [...new Set(pieces.map((p) => p.code))]
  const gutter = plain ? 0 : GUTTER
  const dark = alpha(colors.foreground, 0.12)
  const parts: string[] = []
  parts.push(
    `<defs><clipPath id="board"><rect width="8" height="8" rx="0.08"/></clipPath>`
  )
  for (const c of used)
    parts.push(`<symbol id="${c}" viewBox="0 0 800 800">${PIECES[c]}</symbol>`)
  parts.push(`</defs><g clip-path="url(#board)">`)
  for (let i = 0; i < 64; i++) {
    const x = i % 8
    const y = Math.floor(i / 8)
    // a1 is dark: a square is dark when its file and rank numbers add up to an even number.
    const file = flip ? 7 - x : x
    const rank = flip ? y + 1 : 8 - y
    if ((file + rank) % 2 === 0) continue
    parts.push(`<rect x="${x}" y="${y}" width="1" height="1" fill="${dark}"/>`)
  }
  for (const square of board.highlight ?? []) {
    const { x, y } = at(square)
    parts.push(
      `<rect x="${x}" y="${y}" width="1" height="1" fill="${alpha(MARK, 0.35)}"/>`
    )
  }
  parts.push(`</g>`)
  parts.push(
    `<rect width="8" height="8" rx="0.08" fill="none" stroke="${alpha(colors.foreground, 0.15)}" stroke-width="0.015"/>`
  )
  if (!plain) {
    const muted = colors.muted.foreground
    for (let i = 0; i < 8; i++) {
      parts.push(
        `<text x="${i + 0.5}" y="${n(8 + GUTTER - 0.08)}" text-anchor="middle" font-size="0.24" fill="${muted}">${FILES[flip ? 7 - i : i]}</text>`
      )
      parts.push(
        `<text x="${n(-GUTTER / 2)}" y="${n(i + 0.58)}" text-anchor="middle" font-size="0.24" fill="${muted}">${flip ? i + 1 : 8 - i}</text>`
      )
    }
  }
  for (const { code, square } of pieces) {
    const { x, y } = at(square)
    const place = `href="#${code}" x="${n(x + 0.04)}" y="${n(y + 0.04)}" width="0.92" height="0.92"`
    // On the dark page a black piece would melt into it: a copy stroked in a light color sits
    // behind it, so only the stroke's outer half shows, as an edge.
    if (code.startsWith("b"))
      parts.push(
        `<use ${place} fill="${alpha(colors.foreground, 0.4)}" stroke="${alpha(colors.foreground, 0.4)}" stroke-width="36" stroke-linejoin="round"/>`
      )
    parts.push(`<use ${place}/>`)
  }
  for (const a of board.arrows ?? []) parts.push(arrow(at(a.from), at(a.to)))
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${n(-gutter)} 0 ${n(8 + gutter)} ${n(8 + gutter)}">` +
    parts.join("") +
    `</svg>`
  )
}

/** A move: a thick line from the middle of one square to the middle of another, with its head. */
function arrow(
  from: { x: number; y: number },
  to: { x: number; y: number }
): string {
  const x1 = from.x + 0.5
  const y1 = from.y + 0.5
  const x2 = to.x + 0.5
  const y2 = to.y + 0.5
  const length = Math.hypot(x2 - x1, y2 - y1)
  const ux = (x2 - x1) / length
  const uy = (y2 - y1) / length
  const head = 0.42
  const width = 0.36
  const tipX = x2 - ux * 0.12
  const tipY = y2 - uy * 0.12
  const baseX = tipX - ux * head
  const baseY = tipY - uy * head
  return (
    `<g opacity="0.8"><line x1="${n(x1 + ux * 0.15)}" y1="${n(y1 + uy * 0.15)}" x2="${n(baseX)}" y2="${n(baseY)}" stroke="${MARK}" stroke-width="0.16" stroke-linecap="round"/>` +
    `<polygon points="${n(tipX)},${n(tipY)} ${n(baseX - uy * (width / 2))},${n(baseY + ux * (width / 2))} ${n(baseX + uy * (width / 2))},${n(baseY - ux * (width / 2))}" fill="${MARK}"/></g>`
  )
}
