// Chess positions in FEN, read the same way by the checker and the player's board.

/** A piece as FEN writes it: uppercase for White, lowercase for Black. */
export type FenPiece =
  "K" | "Q" | "R" | "B" | "N" | "P" | "k" | "q" | "r" | "b" | "n" | "p"

/** The board's ranks from 8 down to 1, each its files a to h: a piece, or null for an empty square. */
export type Placement = (FenPiece | null)[][]

const PIECE = /^[KQRBNPkqrbnp]$/

/**
 * Reads a FEN's piece placement (its first field; the rest is ignored). On a mistake, says which
 * rank is wrong and how, so an agent can count it again.
 */
export function readFen(
  fen: string
): { placement: Placement } | { error: string } {
  const field = fen.trim().split(/\s+/)[0] ?? ""
  const ranks = field.split("/")
  if (ranks.length !== 8)
    return {
      error: `A FEN has 8 ranks separated by "/"; this one has ${ranks.length}.`,
    }
  const placement: Placement = []
  for (const [i, rank] of ranks.entries()) {
    const name = 8 - i
    const row: (FenPiece | null)[] = []
    for (const ch of rank) {
      if (/^[1-8]$/.test(ch)) row.push(...Array<null>(Number(ch)).fill(null))
      else if (PIECE.test(ch)) row.push(ch as FenPiece)
      else
        return {
          error: `Rank ${name} ("${rank}") has "${ch}", which isn't a piece (KQRBNP for White, kqrbnp for Black) or a count of empty squares (1–8).`,
        }
    }
    if (row.length !== 8)
      return {
        error: `Rank ${name} ("${rank}") covers ${row.length} squares, not 8. Count its pieces and empty squares again.`,
      }
    placement.push(row)
  }
  const kings = (k: FenPiece) => placement.flat().filter((p) => p === k).length
  if (kings("K") > 1 || kings("k") > 1)
    return { error: `Each side has at most one king.` }
  return { placement }
}

/** The piece on a square ("e4"), or null. */
export const pieceOn = (placement: Placement, square: string) =>
  placement[8 - Number(square[1])]?.[square.charCodeAt(0) - 97] ?? null
