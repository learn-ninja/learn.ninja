import { useMemo, useState } from "react"
import { View } from "react-native"
import Svg, { Circle, G, Path, Text as SvgText } from "react-native-svg"

import type { MapVisual } from "@workspace/spec"

import { markColor } from "@/components/controls"
import { Text } from "@/components/ui/text"
import { alpha } from "@/lib/color"
import { tap } from "@/lib/haptics"
import {
  DOT,
  outlinesFor,
  placeLabels,
  pointsFor,
  RING,
  shadedFor,
  spotsFor,
  TAP,
  TEXT,
  textWidth,
  TINY,
  WIDTH,
} from "@/lib/map-draw"
import { colors } from "../../../tokens"

import type { HotspotControl } from "./visual"

// A world or regional map drawn with react-native-svg from Natural Earth's countries, as the web's
// map.tsx draws it: land, borders, shaded countries, and marked places, in theme tokens. On a
// hotspot every country is tapped on its own shape, and a small one also in a circle over it.

/**
 * Shaded countries take the accent; with groups, each group a color of its own, in order: the
 * accent, a neutral grey, then the pale end of the blues (the dark theme's).
 */
const GROUPS = [
  { fill: alpha(colors.chart[2], 0.7), stroke: colors.chart[2] },
  {
    fill: alpha(colors.foreground, 0.4),
    stroke: alpha(colors.foreground, 0.6),
  },
  { fill: colors.chart[1], stroke: colors.chart[1] },
]
const LAND = alpha(colors.foreground, 0.12)

export function WorldMap({
  map,
  plain,
  hotspots,
}: {
  map: MapVisual
  /** On an option or item card: shorter, to fit the card. */
  plain: boolean
  /** On a hotspot kata: every country drawn is tappable, its id the country's code. */
  hotspots?: HotspotControl
}) {
  const region = map.region ?? "world"
  const outlines = outlinesFor(region)
  const { height } = outlines
  // Drawn size over shown size, so text stays one size on any screen. A tall region is held to a
  // height and centered, so it can be the limit.
  const [shown, setShown] = useState({ width: 0, height: 0 })
  const maxHeight = plain ? 176 : 448
  const k =
    shown.width > 0
      ? Math.max(
          WIDTH / shown.width,
          height / Math.min(shown.height || Infinity, maxHeight)
        )
      : 1
  const groups = [
    ...new Set((map.countries ?? []).flatMap((c) => c.group ?? [])),
  ]
  const drawn = useMemo(() => shadedFor(map), [map])
  const shaded = drawn.map((c) => ({
    ...c,
    color: GROUPS[c.group ? groups.indexOf(c.group) : 0]!,
    tiny: !(c.across >= TINY * k),
  }))
  const dots = useMemo(() => pointsFor(map), [map])
  const labels = placeLabels(
    [
      ...dots.flatMap((d) =>
        d.label
          ? [
              {
                text: d.label,
                x: d.x,
                y: d.y,
                half: [DOT * k, DOT * k] as const,
                onTop: false,
                place: true,
              },
            ]
          : []
      ),
      ...shaded.flatMap((c) => {
        const ring = c.tiny ? c.anchor : null
        const at = c.at
        if (!c.label || !(ring || at)) return []
        const [x, y] = ring ?? [at!.x, at!.y]
        const half = ring
          ? ([RING * k, RING * k] as const)
          : ([at!.width / 2, at!.height / 2] as const)
        const onTop =
          !ring &&
          textWidth(c.label, k) < at!.width * 1.4 &&
          TEXT * k < at!.height
        return [{ text: c.label, x, y, half, onTop, place: false }]
      }),
    ],
    dots,
    k,
    height
  )
  const spots = hotspots ? spotsFor(region) : []
  const press = (code: string) => {
    if (!hotspots || hotspots.disabled) return
    tap()
    hotspots.onToggle(code)
  }
  const fills = Object.fromEntries(shaded.map((c) => [c.code, c.color.fill]))
  const marked = spots.filter(
    (s) =>
      hotspots?.selected.includes(s.code) || Boolean(hotspots?.marks[s.code])
  )
  const markOf = (code: string) => {
    const mark = hotspots?.marks[code]
    const color = mark ? markColor(mark) : colors.primary.DEFAULT
    return { fill: alpha(color, 0.1), stroke: color }
  }
  const drawWidth = shown.width || WIDTH
  const drawHeight = Math.min((drawWidth / WIDTH) * height, maxHeight)

  return (
    <View
      className="w-full items-center"
      onLayout={(e) =>
        setShown({
          width: e.nativeEvent.layout.width,
          height: e.nativeEvent.layout.height,
        })
      }
    >
      <Svg
        width={drawWidth}
        height={drawHeight}
        viewBox={`0 0 ${WIDTH} ${height}`}
        preserveAspectRatio="xMidYMid meet"
      >
        {hotspots ? (
          // The countries themselves, under the borders: each one a single shape, drawn in the
          // land's wash (or its shaded color) and tapped. Unowned land is drawn apart, untappable.
          <G>
            <Path d={outlines.unowned} fill={LAND} />
            {spots.map((s) => (
              <Path
                key={s.code}
                d={s.d}
                fill={fills[s.code] ?? LAND}
                onPress={() => press(s.code)}
              />
            ))}
          </G>
        ) : (
          <>
            <Path d={outlines.land} fill={LAND} />
            {shaded.map((c) => (
              <Path key={c.code} d={c.d} fill={c.color.fill} />
            ))}
          </>
        )}
        <Path
          d={outlines.borders}
          fill="none"
          stroke={colors.background}
          strokeWidth={1 * k}
          strokeLinejoin="round"
        />
        {marked.map((s) =>
          // A small country's outline is too small to see, so it's ringed in the same colors.
          s.size < TINY * k ? (
            <Circle
              key={s.code}
              cx={s.x}
              cy={s.y}
              r={RING * k}
              fill="none"
              stroke={markOf(s.code).stroke}
              strokeWidth={2 * k}
              pointerEvents="none"
            />
          ) : (
            <Path
              key={s.code}
              d={s.d}
              fill={markOf(s.code).fill}
              stroke={markOf(s.code).stroke}
              strokeWidth={2 * k}
              strokeLinejoin="round"
              pointerEvents="none"
            />
          )
        )}
        {hotspots && !hotspots.disabled
          ? // A circle TAP px wide over each small country, above its neighbors, so a tap near its
            // middle is for it (Switzerland among France, Germany, Italy, and Austria).
            spots
              .filter((s) => s.size < TAP * k)
              .map((s) => (
                <Circle
                  key={`tap-${s.code}`}
                  cx={s.x}
                  cy={s.y}
                  r={(TAP / 2) * k}
                  fill="transparent"
                  onPress={() => press(s.code)}
                />
              ))
          : null}
        {shaded.map(
          (c) =>
            c.tiny &&
            c.anchor && (
              <Circle
                key={`ring-${c.code}`}
                cx={c.anchor[0]}
                cy={c.anchor[1]}
                r={RING * k}
                fill="none"
                stroke={c.color.stroke}
                strokeWidth={1.5 * k}
                pointerEvents="none"
              />
            )
        )}
        {dots.map((d, i) => (
          <Circle
            key={`dot-${i}`}
            cx={d.x}
            cy={d.y}
            r={DOT * k}
            fill={colors.foreground}
            stroke={colors.background}
            strokeWidth={1.5 * k}
            pointerEvents="none"
          />
        ))}
        {labels.map((l, i) => (
          // A halo in the page color under the name: the stroke copy first, the fill over it.
          <G key={`label-${i}`} pointerEvents="none">
            <SvgText
              x={l.x}
              y={l.y}
              textAnchor={l.anchor}
              alignmentBaseline="central"
              fontSize={TEXT * k}
              fontWeight="500"
              stroke={colors.background}
              strokeWidth={3 * k}
              strokeLinejoin="round"
              fill={colors.background}
            >
              {l.text}
            </SvgText>
            <SvgText
              x={l.x}
              y={l.y}
              textAnchor={l.anchor}
              alignmentBaseline="central"
              fontSize={TEXT * k}
              fontWeight="500"
              fill={colors.foreground}
            >
              {l.text}
            </SvgText>
          </G>
        ))}
      </Svg>
      {groups.length > 0 && (
        <View className="mt-3 flex-row flex-wrap justify-center gap-x-4 gap-y-1">
          {groups.map((g, i) => (
            <View key={g} className="flex-row items-center gap-1.5">
              <View
                className="h-3 w-3 rounded-sm"
                style={{ backgroundColor: GROUPS[i]!.fill }}
              />
              <Text className="text-sm text-muted-foreground">{g}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  )
}
