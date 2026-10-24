import {
  geoAzimuthalEqualArea,
  geoNaturalEarth1,
  geoPath,
  type GeoPath,
  type GeoPermissibleObjects,
} from "d3-geo"

import {
  MAP_REGIONS,
  MAP_WIDTH as WIDTH,
  type MapRegion,
} from "@workspace/spec"

// How a region is drawn: its projection and the drawing's height, at MAP_WIDTH (the height follows
// the region). Shared by the map and scripts/build-map-sizes.ts, which measures every country on
// every region for the checker.

/** A region's projection, fitted to its box, and the drawing's height. Made once per region. */
const frames = new Map<MapRegion, { path: GeoPath; height: number }>()
export function frameFor(region: MapRegion) {
  const known = frames.get(region)
  if (known) return known
  const [w, s, e, n] = MAP_REGIONS[region]
  const east = e < w ? e + 360 : e
  // The box's edges as points every degree or so, so the fit follows the parallels, not chords.
  const outline: GeoPermissibleObjects = {
    type: "MultiPoint",
    coordinates: [
      ...steps(w, east).flatMap((lon) => [
        [lon, s],
        [lon, n],
      ]),
      ...steps(s, n).flatMap((lat) => [
        [w, lat],
        [east, lat],
      ]),
    ],
  }
  // The world in the Natural Earth projection; a region in an equal-area view from above its middle,
  // which keeps far-north and far-south countries their true size, with only the near side drawn.
  const projection =
    region === "world"
      ? geoNaturalEarth1()
      : geoAzimuthalEqualArea()
          .rotate([-(w + east) / 2, -(s + n) / 2])
          .clipAngle(90)
  projection.fitWidth(WIDTH, outline)
  const height = Math.round(geoPath(projection).bounds(outline)[1][1])
  projection.clipExtent([
    [0, 0],
    [WIDTH, height],
  ])
  const frame = { path: geoPath(projection), height }
  frames.set(region, frame)
  return frame
}

const steps = (from: number, to: number) => {
  const n = Math.max(2, Math.ceil(to - from))
  return Array.from({ length: n + 1 }, (_, i) => from + ((to - from) * i) / n)
}
