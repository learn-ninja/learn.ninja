import * as React from "react"
import type { GeoPath } from "d3-geo"
import type { Feature, MultiPolygon, Polygon } from "geojson"
import { feature, mesh } from "topojson-client"
import type { GeometryCollection, Topology } from "topojson-specification"

import {
  COUNTRIES,
  DRAWN_SIZES,
  MAP_WIDTH as WIDTH,
  type MapRegion,
  type MapVisual,
} from "@workspace/spec"
import { Selectable } from "@workspace/ui/components/selectable"
import { cn } from "@workspace/ui/lib/utils"

import { usePlayer } from "./context"
import { countryName } from "./country-names"
import data from "./map-data.json"
import { frameFor } from "./map-frame"
import type { HotspotControl } from "./visuals"

// A world or regional map drawn as SVG in the browser from Natural Earth's countries (public
// domain, simplified by scripts/build-map.ts): land, borders, shaded countries, and marked places.
// visuals.tsx loads this module only for a lesson that has a map, since the shapes are most of its
// size. It's drawn in theme tokens: land a faint wash of the text color, borders in the page color,
// shaded countries in the accent, so one drawing serves light and dark.

const topology = data as unknown as Topology<{ countries: GeometryCollection }>
const countries = feature(topology, topology.objects.countries)
  .features as Feature<Polygon | MultiPolygon>[]
const borders = mesh(topology, topology.objects.countries, (a, b) => a !== b)
const land = { type: "FeatureCollection" as const, features: countries }
/** Land no country code owns (Natural Earth leaves a few places unnamed): drawn, never tapped. */
const unowned = {
  type: "FeatureCollection" as const,
  features: countries.filter((f) => !f.id),
}

/** Text, dots, and rings in px as shown, whatever the map's width. */
const TEXT = 12
const DOT = 4
const RING = 7
/** A shaded country smaller than this (in px across) gets a ring, so it can be found. */
const TINY = 10
/** On a hotspot, a country smaller than this (in px across) is also tapped in a circle this wide. */
const TAP = 44

/**
 * Shaded countries take the accent; with groups, each group a color of its own, in order: the
 * accent, a neutral grey, then the far end of the blues from the page (deep in light, pale in dark).
 */
const GROUPS = [
  {
    fill: "fill-chart-2/70",
    stroke: "stroke-chart-2",
    swatch: "bg-chart-2/70",
  },
  {
    fill: "fill-foreground/40",
    stroke: "stroke-foreground/60",
    swatch: "bg-foreground/40",
  },
  {
    fill: "fill-chart-5 dark:fill-chart-1",
    stroke: "stroke-chart-5 dark:stroke-chart-1",
    swatch: "bg-chart-5 dark:bg-chart-1",
  },
]

export default function WorldMap({
  map,
  plain,
  hotspots,
}: {
  map: MapVisual
  /** On an option or item card: shorter, to fit the card. */
  plain: boolean
  /** On a hotspot brick: every country drawn is tappable, its id the country's code. */
  hotspots?: HotspotControl
}) {
  const { dir, lang } = usePlayer()
  const ref = React.useRef<SVGSVGElement>(null)
  const region = map.region ?? "world"
  const { path, height } = frameFor(region)
  // Drawn size over shown size, measured in the browser, so text stays one size on any screen. A
  // tall region (Africa, South America) is held to a height and centered, so it can be the limit.
  const [k, setK] = React.useState(1)
  React.useEffect(() => {
    const svg = ref.current
    if (!svg) return
    const measure = () => {
      const { width: w, height: h } = svg.getBoundingClientRect()
      if (w && h) setK(Math.max(WIDTH / w, height / h))
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(svg)
    return () => observer.disconnect()
  }, [height])
  const projection = path.projection() as (
    p: [number, number]
  ) => [number, number] | null
  const groups = [
    ...new Set((map.countries ?? []).flatMap((c) => c.group ?? [])),
  ]
  // The shaded countries' shapes don't change with a tap or a resize, so they're drawn once.
  const drawn = React.useMemo(
    () =>
      (map.countries ?? []).map((c) => {
        const all = {
          type: "FeatureCollection" as const,
          features: countries.filter((f) => f.id === c.code),
        }
        const [[x0, y0], [x1, y1]] = path.bounds(all)
        const anchor = projection(COUNTRIES[c.code]?.at ?? [0, 0])
        return {
          ...c,
          d: path(all) ?? "",
          across: Math.max(x1 - x0, y1 - y0),
          anchor,
          at: labelAt(all.features, anchor, path, height),
        }
      }),
    [map.countries, path, projection, height]
  )
  const shaded = drawn.map((c) => ({
    ...c,
    color: GROUPS[c.group ? groups.indexOf(c.group) : 0]!,
    tiny: !(c.across >= TINY * k),
  }))
  const outlines = outlinesFor(region)

  const dots = (map.points ?? []).flatMap((p) => {
    const at = projection([p.lon, p.lat])
    return at ? [{ ...p, x: at[0], y: at[1] }] : []
  })
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
        // A name sits on its country when it about fits (running a little past its edges is fine);
        // else beside it, or beside its ring.
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
  const text = {
    fontSize: TEXT * k,
    strokeWidth: 3 * k,
    strokeLinejoin: "round",
    paintOrder: "stroke",
    className: "fill-foreground stroke-background font-medium",
    style: { fontFamily: "inherit" },
  } as const

  const spots = hotspots ? spotsFor(region) : []
  // The country the map's tab stop is on, and the one with keyboard focus, to outline it.
  const [active, setActive] = React.useState<string | null>(null)
  const [focused, setFocused] = React.useState<string | null>(null)
  const tap = (code: string) => {
    setActive(code)
    hotspots?.onToggle(code)
  }
  const drawing = (
    <svg
      ref={ref}
      viewBox={`0 0 ${WIDTH} ${height}`}
      className={cn("block h-auto w-full", plain ? "max-h-44" : "max-h-112")}
      aria-hidden
    >
      {hotspots ? (
        <CountryShapes
          spots={spots}
          unowned={outlines.unowned}
          fills={Object.fromEntries(shaded.map((c) => [c.code, c.color.fill]))}
          control={hotspots}
          onTap={tap}
        />
      ) : (
        <>
          <path
            d={outlines.land}
            className="fill-foreground/8 dark:fill-foreground/12"
          />
          {shaded.map((c) => (
            <path key={c.code} d={c.d} className={c.color.fill} />
          ))}
        </>
      )}
      <path
        d={outlines.borders}
        fill="none"
        strokeWidth={1}
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
        className="stroke-background"
      />
      {hotspots && (
        <CountryMarks
          spots={spots}
          control={hotspots}
          k={k}
          focused={focused}
          onTap={tap}
        />
      )}
      {shaded.map(
        (c) =>
          c.tiny &&
          c.anchor && (
            <circle
              key={c.code}
              cx={c.anchor[0]}
              cy={c.anchor[1]}
              r={RING * k}
              fill="none"
              strokeWidth={1.5}
              vectorEffect="non-scaling-stroke"
              pointerEvents="none"
              className={c.color.stroke}
            />
          )
      )}
      {dots.map((d, i) => (
        <circle
          key={i}
          cx={d.x}
          cy={d.y}
          r={DOT * k}
          strokeWidth={1.5 * k}
          pointerEvents="none"
          className="fill-foreground stroke-background"
        />
      ))}
      {labels.map((l, i) => (
        <text
          key={i}
          {...text}
          x={l.x}
          y={l.y}
          textAnchor={l.anchor}
          dominantBaseline="central"
          pointerEvents="none"
        >
          {l.text}
        </text>
      ))}
    </svg>
  )

  return (
    <>
      {hotspots ? (
        // The toggles sit over the drawing, which the svg centers when its height is the limit.
        <div className="relative overflow-hidden">
          {drawing}
          <Toggles
            spots={spots}
            control={hotspots}
            lang={lang}
            k={k}
            height={height}
            active={active}
            onFocus={(code) => {
              setActive(code)
              setFocused(code)
            }}
            onBlur={() => setFocused(null)}
          />
        </div>
      ) : (
        drawing
      )}
      {groups.length > 0 && (
        <ul
          dir={dir}
          className="mt-3 flex flex-wrap justify-center gap-x-4 gap-y-1 text-sm text-muted-foreground"
        >
          {groups.map((g, i) => (
            <li key={g} className="flex items-center gap-1.5">
              <span className={`size-3 rounded-sm ${GROUPS[i]!.swatch}`} />
              {g}
            </li>
          ))}
        </ul>
      )}
    </>
  )
}

/**
 * A region's land, the borders between countries, and the land no country owns, as paths. They're
 * the same on every map of the region, and the borders are long, so they're made once per region.
 */
const outlinesByRegion = new Map<
  MapRegion,
  { land: string; borders: string; unowned: string }
>()
export function outlinesFor(region: MapRegion) {
  const known = outlinesByRegion.get(region)
  if (known) return known
  const { path } = frameFor(region)
  const outlines = {
    land: path(land) ?? "",
    borders: path(borders) ?? "",
    unowned: path(unowned) ?? "",
  }
  outlinesByRegion.set(region, outlines)
  return outlines
}

/** A country on a hotspot map: its shape, where its name would go, its box, and its drawn size. */
interface Spot {
  code: string
  d: string
  x: number
  y: number
  box: [number, number, number, number]
  /** Px across at WIDTH, from the checker's table, so the checker and the map agree. */
  size: number
}

/**
 * Every country a region's map draws, as the checker lists them, west to east and then north to
 * south by where its name would go: the order the arrow keys step through. Made once per region.
 */
const spotsByRegion = new Map<MapRegion, Spot[]>()
export function spotsFor(region: MapRegion): Spot[] {
  const known = spotsByRegion.get(region)
  if (known) return known
  const { path, height } = frameFor(region)
  const projection = path.projection() as (
    p: [number, number]
  ) => [number, number] | null
  const spots = Object.entries(DRAWN_SIZES[region])
    .map(([code, size]) => {
      const shapes = countries.filter((f) => f.id === code)
      const all = { type: "FeatureCollection" as const, features: shapes }
      const [[x0, y0], [x1, y1]] = path.bounds(all)
      const anchor = projection(COUNTRIES[code]?.at ?? [0, 0])
      const at = labelAt(shapes, anchor, path, height)
      return {
        code,
        d: path(all) ?? "",
        x: at?.x ?? (x0 + x1) / 2,
        y: at?.y ?? (y0 + y1) / 2,
        box: [x0, y0, x1, y1] as Spot["box"],
        size,
      }
    })
    .sort((a, b) => a.x - b.x || a.y - b.y)
  spotsByRegion.set(region, spots)
  return spots
}

/** A picked or checked country's mark, drawn over it: a 10% tint inside an outline of the color. */
const markStyles = (selected: boolean, mark: string | undefined) =>
  cn(
    "fill-transparent",
    selected && "fill-primary/10 stroke-primary",
    mark === "correct" && "fill-green-600/10! stroke-green-600!",
    mark === "wrong" && "fill-yellow-500/10! stroke-yellow-500!"
  )

/**
 * Of the small countries (under TAP px across), the one whose middle is nearest a point, within
 * TAP/2 px: who a tap in the circles over small countries is for.
 */
export function nearestSmall(
  x: number,
  y: number,
  spots: Spot[],
  k: number
): string | undefined {
  let best: { code: string; d: number } | undefined
  for (const s of spots) {
    if (s.size >= TAP * k) continue
    const d = Math.hypot(s.x - x, s.y - y)
    if (d <= (TAP / 2) * k && (!best || d < best.d)) best = { code: s.code, d }
  }
  return best?.code
}

/**
 * On a hotspot, the countries themselves, under the borders: each one a single shape, drawn in
 * the land's wash (or its shaded color) and tapped. Land no country owns is drawn apart, untappable.
 */
function CountryShapes({
  spots,
  unowned,
  fills,
  control,
  onTap,
}: {
  spots: Spot[]
  /** The path of the land no country owns. */
  unowned: string
  /** Shaded countries' fill classes, by code; the rest take the land's. */
  fills: Record<string, string>
  control: HotspotControl
  onTap: (code: string) => void
}) {
  return (
    <g className={cn(!control.disabled && "cursor-pointer")}>
      <path d={unowned} className="fill-foreground/8 dark:fill-foreground/12" />
      {spots.map((s) => (
        <path
          key={s.code}
          d={s.d}
          data-shape={s.code}
          className={cn(
            fills[s.code] ?? "fill-foreground/8 dark:fill-foreground/12",
            !control.disabled &&
              (fills[s.code] ? "hover:opacity-80" : "hover:fill-primary/15")
          )}
          onClick={control.disabled ? undefined : () => onTap(s.code)}
        />
      ))}
    </g>
  )
}

/**
 * Over the borders: picks and marks, the keyboard's focus, and a circle TAP px wide over each small
 * country. The circles sit above the neighbors, so a tap near a small country's middle is for it
 * (Switzerland among France, Germany, Italy, and Austria). Where circles overlap, a tap goes to the
 * small country under it, else the nearest middle (nearestSmall): one handler for every circle,
 * simpler than clipping each circle against the others.
 */
function CountryMarks({
  spots,
  control,
  k,
  focused,
  onTap,
}: {
  spots: Spot[]
  control: HotspotControl
  k: number
  focused: string | null
  onTap: (code: string) => void
}) {
  const marked = spots.filter(
    (s) => control.selected.includes(s.code) || Boolean(control.marks[s.code])
  )
  const small = spots.filter((s) => s.size < TAP * k)
  const focus = spots.find((s) => s.code === focused)
  const tapSmall = (e: React.MouseEvent<SVGCircleElement>) => {
    const m = e.currentTarget.ownerSVGElement?.getScreenCTM()
    if (!m) return
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse())
    const under = document
      .elementsFromPoint(e.clientX, e.clientY)
      .map((el) => (el as SVGElement).dataset?.shape)
      .find((c) => c && small.some((s) => s.code === c))
    const code = under ?? nearestSmall(p.x, p.y, spots, k)
    if (code) onTap(code)
  }
  return (
    <>
      {marked.map((s) =>
        // A small country's outline is too small to see, so it's ringed in the same colors.
        s.size < TINY * k ? (
          <circle
            key={s.code}
            cx={s.x}
            cy={s.y}
            r={RING * k}
            strokeWidth={2}
            vectorEffect="non-scaling-stroke"
            pointerEvents="none"
            className={cn(
              markStyles(
                control.selected.includes(s.code),
                control.marks[s.code]
              ),
              "fill-none!"
            )}
          />
        ) : (
          <path
            key={s.code}
            d={s.d}
            strokeWidth={2}
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
            pointerEvents="none"
            className={markStyles(
              control.selected.includes(s.code),
              control.marks[s.code]
            )}
          />
        )
      )}
      {/* The keyboard's place, as the focus ring the player's other controls show. */}
      {focus &&
        (focus.size < TINY * k ? (
          <circle
            cx={focus.x}
            cy={focus.y}
            r={RING * k + 2 * k}
            strokeWidth={3}
            vectorEffect="non-scaling-stroke"
            pointerEvents="none"
            className="fill-none stroke-ring/50"
          />
        ) : (
          <path
            d={focus.d}
            strokeWidth={3}
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
            pointerEvents="none"
            className="fill-none stroke-ring/50"
          />
        ))}
      {!control.disabled &&
        small.map((s) => (
          <circle
            key={s.code}
            cx={s.x}
            cy={s.y}
            r={(TAP / 2) * k}
            data-tap={s.code}
            className="cursor-pointer fill-transparent"
            onClick={tapSmall}
          />
        ))}
    </>
  )
}

const STEPS: Record<string, (i: number, n: number) => number> = {
  ArrowRight: (i) => i + 1,
  ArrowDown: (i) => i + 1,
  ArrowLeft: (i) => i - 1,
  ArrowUp: (i) => i - 1,
  Home: () => 0,
  End: (_, n) => n - 1,
}

/**
 * The countries as toggles, laid over the drawing for the keyboard and screen readers; taps go
 * through them to the shapes below. The map is one tab stop: the arrow keys step through the
 * countries, so the keyboard doesn't walk through every one.
 */
function Toggles({
  spots,
  control,
  lang,
  k,
  height,
  active,
  onFocus,
  onBlur,
}: {
  spots: Spot[]
  control: HotspotControl
  lang?: string
  k: number
  /** The drawing's height at WIDTH. */
  height: number
  active: string | null
  onFocus: (code: string) => void
  onBlur: () => void
}) {
  const refs = React.useRef(new Map<string, HTMLButtonElement>())
  const stop = active ?? control.selected[0] ?? spots[0]?.code
  const onKeyDown = (e: React.KeyboardEvent) => {
    const i = spots.findIndex(
      (s) => s.code === (e.target as HTMLElement).dataset.country
    )
    const to = STEPS[e.key]?.(i, spots.length)
    if (i < 0 || to === undefined || to < 0 || to >= spots.length) return
    e.preventDefault()
    refs.current.get(spots[to]!.code)?.focus()
  }
  const pct = (v: number, of: number) => `${(v / of) * 100}%`
  return (
    // The map is always drawn left to right (its block sets dir="ltr"), so these are physical edges.
    <div
      onKeyDown={onKeyDown}
      className="pointer-events-none absolute inset-0 m-auto"
      style={{ width: WIDTH / k, height: height / k }}
    >
      {spots.map((s) => {
        // Each toggle covers its country, or a circle's square around a small one.
        const [x0, y0, x1, y1] =
          s.size < TAP * k
            ? [
                s.x - (TAP / 2) * k,
                s.y - (TAP / 2) * k,
                s.x + (TAP / 2) * k,
                s.y + (TAP / 2) * k,
              ]
            : s.box
        return (
          <Selectable
            key={s.code}
            ref={(el) => {
              if (el) refs.current.set(s.code, el)
              else refs.current.delete(s.code)
            }}
            data-country={s.code}
            aria-label={countryName(s.code, lang)}
            isSelected={control.selected.includes(s.code)}
            onChange={() => control.onToggle(s.code)}
            onFocus={() => onFocus(s.code)}
            onBlur={onBlur}
            isDisabled={control.disabled}
            excludeFromTabOrder={s.code !== stop}
            className="pointer-events-none absolute focus-visible:ring-0"
            style={{
              insetInlineStart: pct(Math.max(0, x0), WIDTH),
              top: pct(Math.max(0, y0), height),
              width: pct(Math.min(WIDTH, x1) - Math.max(0, x0), WIDTH),
              height: pct(Math.min(height, y1) - Math.max(0, y0), height),
            }}
          />
        )
      })}
    </div>
  )
}

type Anchor = "start" | "middle" | "end"

/** About the width of a name in medium text: close enough to keep names apart. */
const textWidth = (text: string, k: number) => text.length * TEXT * 0.6 * k

/**
 * Places names so they don't cover each other or a dot. A place's name goes after its dot, else
 * before it, above, or below; a country's on it when it fits, else below, above, or beside it.
 * Places go first, since their dots pin them down. A name that fits nowhere takes its first spot.
 */
function placeLabels(
  labels: {
    text: string
    x: number
    y: number
    /** Half the width and height of what the name labels: a dot, a ring, or a country. */
    half: readonly [number, number]
    /** Whether the name can sit on top of it, as on a country it fits inside. */
    onTop: boolean
    place: boolean
  }[],
  dots: { x: number; y: number }[],
  k: number,
  height: number
): { text: string; x: number; y: number; anchor: Anchor }[] {
  const h = TEXT * 1.2 * k
  const gap = 3 * k
  type Box = [number, number, number, number]
  const taken: Box[] = dots.map(({ x, y }) => [
    x - DOT * k,
    y - DOT * k,
    x + DOT * k,
    y + DOT * k,
  ])
  const overlaps = (a: Box, b: Box) =>
    a[0] < b[2] && b[0] < a[2] && a[1] < b[3] && b[1] < a[3]
  return labels.map(({ text, x, y, half: [hx, hy], onTop, place }) => {
    const w = textWidth(text, k)
    const side: { x: number; y: number; anchor: Anchor }[] = [
      { x: x + hx + gap, y, anchor: "start" },
      { x: x - hx - gap, y, anchor: "end" },
    ]
    const under: { x: number; y: number; anchor: Anchor }[] = [
      { x, y: y + hy + gap + h / 2, anchor: "middle" },
      { x, y: y - hy - gap - h / 2, anchor: "middle" },
    ]
    const spots = [
      ...(onTop ? [{ x, y, anchor: "middle" as const }] : []),
      ...(place ? [...side, ...under] : [...under, ...side]),
    ]
    const boxOf = (s: (typeof spots)[number]): Box => {
      const x0 =
        s.anchor === "start" ? s.x : s.anchor === "end" ? s.x - w : s.x - w / 2
      return [x0, s.y - h / 2, x0 + w, s.y + h / 2]
    }
    const inside = (b: Box) =>
      b[0] >= 0 && b[1] >= 0 && b[2] <= WIDTH && b[3] <= height
    const spot =
      spots.find((s) => {
        const b = boxOf(s)
        return inside(b) && !taken.some((t) => overlaps(b, t))
      }) ??
      spots.find((s) => inside(boxOf(s))) ??
      spots[0]!
    taken.push(boxOf(spot))
    return { text, ...spot }
  })
}

/**
 * Where a country's name goes, and the size of the piece it names: its anchor (the middle of its
 * largest piece) when that's on the map, else the middle of its largest piece that is, as for
 * Russia on a map of Europe.
 */
function labelAt(
  shapes: Feature<Polygon | MultiPolygon>[],
  anchor: [number, number] | null,
  path: GeoPath,
  height: number
): { x: number; y: number; width: number; height: number } | null {
  const pieces = shapes.flatMap((f) =>
    f.geometry.type === "MultiPolygon"
      ? f.geometry.coordinates.map(
          (coordinates) => ({ type: "Polygon", coordinates }) as Polygon
        )
      : [f.geometry]
  )
  const largest = pieces
    .map((p) => ({ p, area: path.area(p) }))
    .sort((a, b) => b.area - a.area)[0]
  if (!largest?.area) return null
  const [[x0, y0], [x1, y1]] = path.bounds(largest.p)
  const size = { width: x1 - x0, height: y1 - y0 }
  const margin = 12
  if (
    anchor &&
    anchor[0] > margin &&
    anchor[0] < WIDTH - margin &&
    anchor[1] > margin &&
    anchor[1] < height - margin
  )
    return { x: anchor[0], y: anchor[1], ...size }
  const [x, y] = path.centroid(largest.p)
  return { x, y, ...size }
}
