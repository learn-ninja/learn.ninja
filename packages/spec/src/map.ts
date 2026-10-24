// Map regions, shared by the checker and the player's map: each is a box of longitude and latitude
// the map is fitted to. A box whose west is greater than its east crosses the 180th meridian.

export type Box = [west: number, south: number, east: number, north: number]

export const MAP_REGIONS = {
  // Antarctica is left off: it would take a sixth of the height and is rarely the point.
  world: [-180, -56, 180, 84],
  africa: [-19, -36, 53, 38],
  europe: [-25, 34, 45, 71],
  asia: [25, -11, 150, 60],
  "middle-east": [25, 12, 63, 42],
  "south-asia": [60, 5, 98, 38],
  "east-asia": [95, 18, 146, 54],
  "southeast-asia": [92, -11, 142, 24],
  "north-america": [-168, 14, -52, 72],
  "central-america": [-118, 7, -59, 33],
  "south-america": [-82, -56, -34, 13],
  oceania: [110, -48, -170, 0],
  mediterranean: [-10, 29, 42, 47],
  // Greece to Mesopotamia's edge and the Nile delta: the ancient world's middle, which the whole sea would leave a corner of.
  "eastern-mediterranean": [19, 28, 41, 43],
} as const satisfies Record<string, Box>

export type MapRegion = keyof typeof MAP_REGIONS

export const MAP_REGION_NAMES = Object.keys(MAP_REGIONS) as [
  MapRegion,
  ...MapRegion[],
]

/** A box's longitudes as a start and an end that's never smaller, so a crossing box runs past 180. */
const span = ([w, , e]: Box | readonly number[]) =>
  [w!, e! < w! ? e! + 360 : e!] as const

/** Whether a position (lon, lat) is inside a box. */
export function inBox(lon: number, lat: number, box: Box): boolean {
  const [w, e] = span(box)
  if (lat < box[1] || lat > box[3]) return false
  return [lon, lon + 360].some((l) => l >= w && l <= e)
}

/** Whether two boxes overlap: whether any of a country is on a region's map. */
export function boxesOverlap(a: Box, b: Box): boolean {
  if (a[1] > b[3] || b[1] > a[3]) return false
  const [aw, ae] = span(a)
  const [bw, be] = span(b)
  return [-360, 0, 360].some((shift) => aw + shift <= be && bw <= ae + shift)
}

/** A box in words for messages: "34°N to 71°N, 25°W to 45°E". */
export function describeBox([w, s, e, n]: Box): string {
  const lat = (v: number) => `${Math.abs(v)}°${v < 0 ? "S" : "N"}`
  const lon = (v: number) => `${Math.abs(v)}°${v < 0 ? "W" : "E"}`
  return `${lat(s)} to ${lat(n)}, ${lon(w)} to ${lon(e)}`
}

/** The width every map is drawn at; the player scales the drawing to fit the screen. */
export const MAP_WIDTH = 480

/** On a hotspot map, an answer country drawn smaller than this across (at MAP_WIDTH) is too small to find and tap. */
export const MAP_MIN_TAP = 24
