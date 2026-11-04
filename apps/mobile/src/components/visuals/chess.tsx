import { useMemo, useState } from "react"
import { Pressable, View } from "react-native"
import { SvgXml } from "react-native-svg"

import type { ChessVisual } from "@workspace/spec"

import { markColor } from "@/components/controls"
import { boardSvg, GUTTER, squareOrder } from "@/lib/chess-svg"
import { alpha } from "@/lib/color"
import { tap } from "@/lib/haptics"
import { colors } from "../../../tokens"

import type { HotspotControl } from "./visual"

/**
 * A chess position drawn from its FEN (lib/chess-svg.ts), as the web's chess.tsx: the board, its
 * marked squares and arrows, and the chessnut pieces. On a hotspot the squares are buttons laid
 * over the drawing, each taking the pick's or the answer's color.
 */
export function ChessBoard({
  board,
  plain,
  hotspots,
}: {
  board: ChessVisual
  /** On an option or item card: smaller, so the coordinates and their gutter are left off. */
  plain: boolean
  /** On a hotspot kata: every square is tappable, its id the square's name. */
  hotspots?: HotspotControl
}) {
  const xml = useMemo(() => boardSvg(board, plain), [board, plain])
  const [size, setSize] = useState(0)
  const flip = board.flip ?? false
  const gutter = plain ? 0 : GUTTER
  // The squares' share of the drawing: the gutter sits at the start and under the board.
  const squares = (size * 8) / (8 + gutter)
  const start = size - squares
  return (
    <View
      className="aspect-square w-full"
      onLayout={(e) => setSize(e.nativeEvent.layout.width)}
    >
      {size > 0 ? <SvgXml xml={xml} width={size} height={size} /> : null}
      {hotspots && size > 0 ? (
        <View
          className="absolute top-0 flex-row flex-wrap"
          style={{ left: start, width: squares, height: squares }}
        >
          {squareOrder(flip).map((square) => {
            const selected = hotspots.selected.includes(square)
            const mark = hotspots.marks[square]
            const color = mark ? markColor(mark) : colors.primary.DEFAULT
            return (
              <Pressable
                key={square}
                accessibilityRole="button"
                accessibilityLabel={square}
                accessibilityState={{ selected, disabled: hotspots.disabled }}
                disabled={hotspots.disabled}
                onPress={() => {
                  tap()
                  hotspots.onToggle(square)
                }}
                style={{
                  width: squares / 8,
                  height: squares / 8,
                  // A picked or checked square: a 10% tint inside a ring of the color.
                  ...(selected || mark
                    ? {
                        backgroundColor: alpha(color, 0.1),
                        borderWidth: 2,
                        borderColor: color,
                      }
                    : null),
                }}
              />
            )
          })}
        </View>
      ) : null}
    </View>
  )
}
