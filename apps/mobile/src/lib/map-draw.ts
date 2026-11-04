import type { GeoPath } from "d3-geo"
import type { Feature, MultiPolygon, Polygon } from "geojson"
import { feature, mesh } from "topojson-client"
import type { GeometryCollection, Topology } from "topojson-specification"

import data from "@workspace/player-core/map-data.json"
import { frameFor } from "@workspace/player-core/map-frame"
import {
  COUNTRIES,
  DRAWN_SIZES,
  MAP_WIDTH as WIDTH,
  type MapRegion,
  type MapVisual,
} from "@workspace/spec"

// A map's geometry, worked out as the web's map.tsx does (packages/player/src/map.tsx) from the
// same shapes and frames: the region's outlines, the shaded countries, the points, where every
// name goes, and on a hotspot which country a tap near a small one is for. Pure, so it's tested
// without the screen; components/visuals/map.tsx draws it.

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
export const TEXT = 12
export const DOT = 4
export const RING = 7
/** A shaded country smaller than this (in px across) gets a ring, so it can be found. */
export const TINY = 10
/** On a hotspot, a country smaller than this (in px across) is also tapped in a circle this wide. */
export const TAP = 44

export { WIDTH }

/**
 * A region's land, the borders between countries, and the land no country owns, as paths. They're
 * the same on every map of the region, and the borders are long, so they're made once per region.
 */
const outlinesByRegion = new Map<
  MapRegion,
  { land: string; borders: string; unowned: string; height: number }
>()
export function outlinesFor(region: MapRegion) {
  const known = outlinesByRegion.get(region)
  if (known) return known
  const { path, height } = frameFor(region)
  const outlines = {
    land: path(land) ?? "",
    borders: path(borders) ?? "",
    unowned: path(unowned) ?? "",
    height,
  }
  outlinesByRegion.set(region, outlines)
  return outlines
}

/** A country on a hotspot map: its shape, where its name would go, its box, and its drawn size. */
export interface Spot {
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
 * south by where its name would go. Made once per region.
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

export interface Shaded {
  code: string
  label?: string
  group?: string
  d: string
  across: number
  anchor: [number, number] | null
  at: { x: number; y: number; width: number; height: number } | null
}

/** The shaded countries' shapes and label places, which don't change with a tap or a resize. */
export function shadedFor(map: MapVisual): Shaded[] {
  const region = map.region ?? "world"
  const { path, height } = frameFor(region)
  const projection = path.projection() as (
    p: [number, number]
  ) => [number, number] | null
  return (map.countries ?? []).map((c) => {
    const all = {
      type: "FeatureCollection" as const,
      features: countries.filter((f) => f.id === c.code),
    }
    const [[x0, y0], [x1, y1]] = path.bounds(all)
    const anchor = projection(COUNTRIES[c.code]?.at ?? [0, 0])
    return {
      code: c.code,
      label: c.label,
      group: c.group,
      d: path(all) ?? "",
      across: Math.max(x1 - x0, y1 - y0),
      anchor,
      at: labelAt(all.features, anchor, path, height),
    }
  })
}

/** The map's points, projected. */
export function pointsFor(map: MapVisual) {
  const { path } = frameFor(map.region ?? "world")
  const projection = path.projection() as (
    p: [number, number]
  ) => [number, number] | null
  return (map.points ?? []).flatMap((p) => {
    const at = projection([p.lon, p.lat])
    return at ? [{ ...p, x: at[0], y: at[1] }] : []
  })
}

export type Anchor = "start" | "middle" | "end"

/** About the width of a name in medium text: close enough to keep names apart. */
export const textWidth = (text: string, k: number) =>
  text.length * TEXT * 0.6 * k

export interface LabelWanted {
  text: string
  x: number
  y: number
  /** Half the width and height of what the name labels: a dot, a ring, or a country. */
  half: readonly [number, number]
  /** Whether the name can sit on top of it, as on a country it fits inside. */
  onTop: boolean
  place: boolean
}

/**
 * Places names so they don't cover each other or a dot. A place's name goes after its dot, else
 * before it, above, or below; a country's on it when it fits, else below, above, or beside it.
 * Places go first, since their dots pin them down. A name that fits nowhere takes its first spot.
 */
export function placeLabels(
  labels: LabelWanted[],
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
 * largest piece) when that's on the map, else the middle of its largest piece that is.
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
