import { describe, expect, it } from "vitest"

import { boardSvg, squareAt, squarePlace } from "./chess-svg"

const board = {
  kind: "chess" as const,
  fen: "r3k3/8/8/3N4/8/8/8/4K3 w - - 0 1",
  highlight: ["d5"],
  arrows: [{ from: "d5", to: "c7" }],
}

describe("the chess board's SVG", () => {
  it("places squares from the top left, flipped or not", () => {
    expect(squarePlace("a1", false)).toEqual({ x: 0, y: 7 })
    expect(squarePlace("h8", false)).toEqual({ x: 7, y: 0 })
    expect(squarePlace("a1", true)).toEqual({ x: 7, y: 0 })
    expect(squareAt(0, 7, false)).toBe("a1")
    expect(squareAt(7, 0, true)).toBe("a1")
  })

  it("draws the pieces, the highlight, the arrow, and the coordinates", () => {
    const svg = boardSvg(board, false)
    expect(svg).toContain('<symbol id="wN"')
    expect(svg).toContain('<symbol id="bK"')
    expect(svg).toContain('href="#wN" x="3.04" y="3.04"')
    // 32 dark squares, plus the highlight on d5.
    expect(svg.match(/<rect x="\d" y="\d" width="1" height="1"/g)).toHaveLength(
      33
    )
    expect(svg).toContain("<polygon")
    expect(svg).toContain(">a</text>")
    expect(svg).toMatch(/^<svg [^>]*viewBox="-0.4 0 8.4 8.4"/)
  })

  it("leaves the coordinates off a plain board", () => {
    const svg = boardSvg(board, true)
    expect(svg).not.toContain("<text")
    expect(svg).toMatch(/viewBox="0 0 8 8"/)
  })

  it("shows an empty board for a FEN it can't read", () => {
    expect(boardSvg({ kind: "chess", fen: "nonsense" }, true)).not.toContain(
      "<use"
    )
  })
})
