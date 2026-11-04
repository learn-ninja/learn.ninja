import type { NinjaMood } from "@workspace/player-core/ninja"

// What each of the ninja's moods looks like, as the web draws it in CSS (packages/ui/src/styles/
// globals.css, under `.ninja`): which eyes show, how the open eyes are squashed, where the head is
// held, and the keyframes a mood plays on his head, his whole body, or his eyes. Pure numbers, so
// the app's Ninja (src/components/ninja.tsx) plays them as Reanimated tracks and the tests can check
// them without a phone. Distances are in the mark's own units (its 64-unit drawing) and scale with
// the setting's energy, as --ninja-energy scales them on the web; turns are in degrees.

/** A transform: moved by tx and ty, turned by rot, then scaled by sx and sy. */
export interface Pose {
  tx: number
  ty: number
  rot: number
  sx: number
  sy: number
}

export const REST: Pose = { tx: 0, ty: 0, rot: 0, sx: 1, sy: 1 }
/** The entrance also fades him in. */
export type EntrancePose = Partial<Pose> & { opacity?: number }
const REST_ALL: Record<string, number> = { ...REST, opacity: 1 }
export const CHANNELS = ["tx", "ty", "rot", "sx", "sy"] as const
export type Channel = (typeof CHANNELS)[number]

/** A CSS timing function: a cubic Bézier's control points, linear, or steps(1). */
export type Ease = readonly [number, number, number, number] | "linear" | "step"

export const EASE: Record<
  "ease" | "easeIn" | "easeOut" | "easeInOut",
  readonly [number, number, number, number]
> = {
  ease: [0.25, 0.1, 0.25, 1],
  easeIn: [0.42, 0, 1, 1],
  easeOut: [0, 0, 0.58, 1],
  easeInOut: [0.42, 0, 0.58, 1],
}

/**
 * A keyframe animation: its length, its timing function (applied to each stretch between frames,
 * as CSS does), and its frames at 0 to 1. A channel a frame leaves out is at rest there, and a track
 * without a frame at 0 or 1 starts and ends at the pose the mood holds, as CSS fills them in.
 */
export interface Track<
  P extends Partial<Record<string, number>> = Partial<Pose>,
> {
  ms: number
  ease: Ease
  frames: { at: number; pose: P }[]
  /** Plays until something else takes over (the sensei's breathing, unhinged's tremor). */
  loop?: boolean
}

export type Eyes = "open" | "happy" | "sad"
type Squash = readonly [sx: number, sy: number]

export interface MoodLook {
  /** Which eyes show: the open ovals, the happy arcs, or the sad ones. */
  eyes: Eyes
  /** How each open eye (the start one, then the end one) is squashed: closed, half, wide. */
  squash: readonly [Squash, Squash]
  /** Where the mood points his eyes, for the ones that look somewhere on their own. */
  look?: readonly [x: number, y: number]
  /** Where the head is held while the mood lasts (it eases there, overshooting a little). */
  head: Pose
  headTrack?: Track
  bodyTrack?: Track
  /** A move of the open eyes themselves (the sensei's slow blink), as scale on both. */
  eyeTrack?: Track
}

export const CLOSED: Squash = [1.06, 0.06]
const HALF: Squash = [1.02, 0.45]
const WIDE: Squash = [1.22, 1.28]
const OPEN: Squash = [1, 1]

const HAPPY_EYES: NinjaMood[] = [
  "happy",
  "cheer",
  "wiggle",
  "nod",
  "sparkle",
  "spin",
  "flip",
  "doublespin",
  "inflate",
  "headbang",
]
const SAD_EYES: NinjaMood[] = ["droop", "sigh", "faint"]
const CLOSED_EYES: NinjaMood[] = ["closed", "shake", "bow", "deepbow", "breath"]
const HALF_EYES: NinjaMood[] = ["half", "rattle", "halfturn"]
const WIDE_EYES: NinjaMood[] = ["wide", "tremble"]

/** A whole-body move given in % of the bare mark, as globals.css writes them, in mark units. */
const pct = (p: number) => (p / 100) * 64

const at = <P extends Partial<Pose>>(a: number, pose: P) => ({ at: a, pose })
/** The same pose at several points of a track. */
const many = (points: number[], pose: Partial<Pose>) =>
  points.map((a) => at(a, pose))

/** The head's keyframes for a mood at an energy, or none for a mood that only holds a pose. */
function headTrack(mood: NinjaMood, e: number): Track | undefined {
  switch (mood) {
    case "sigh":
      return {
        ms: 1300,
        ease: EASE.ease,
        frames: [
          at(0.3, { ty: -1.5 * e, sx: 1.02, sy: 0.98 }),
          at(1, { ty: 2 * e }),
        ],
      }
    case "shake":
      return {
        ms: 500,
        ease: EASE.ease,
        frames: [
          at(0.2, { tx: -2.2 * e }),
          at(0.4, { tx: 2.2 * e }),
          at(0.6, { tx: -1.6 * e }),
          at(0.8, { tx: 1.2 * e }),
        ],
      }
    case "wiggle":
      return {
        ms: 700,
        ease: EASE.ease,
        frames: [
          at(0.2, { rot: -9 * e }),
          at(0.45, { rot: 8 * e }),
          at(0.7, { rot: -4 * e }),
        ],
      }
    case "nod":
      return {
        ms: 900,
        ease: EASE.ease,
        frames: [
          at(0.25, { ty: 2 * e, rot: 2 * e }),
          at(0.55, { ty: -1 * e, rot: -1 * e }),
        ],
      }
    case "spin":
      return {
        ms: 800,
        ease: [0.4, 0, 0.2, 1],
        frames: [at(1, { rot: 360 })],
      }
    case "rewind":
      return {
        ms: 700,
        ease: [0.5, 0, 0.3, 1],
        frames: [at(1, { rot: -720 })],
      }
    case "bow":
      return {
        ms: 1700,
        ease: [0.4, 0, 0.2, 1],
        frames: many([0.35, 0.65], { ty: 4 * e, sy: 0.88 }),
      }
    case "deepbow":
      return {
        ms: 2600,
        ease: [0.4, 0, 0.2, 1],
        frames: many([0.3, 0.7], { ty: 7 * e, sy: 0.8 }),
      }
    case "liftnod":
      return {
        ms: 1300,
        ease: EASE.easeInOut,
        frames: [
          at(0.25, { ty: -1.5 * e }),
          at(0.55, { ty: 2.5 * e, rot: 2 * e }),
        ],
      }
    case "breath": {
      const s = 1 + 0.035 * e
      return {
        ms: 1900,
        ease: EASE.easeInOut,
        frames: [at(0.5, { sx: s, sy: s })],
      }
    }
    case "halfturn":
      return {
        ms: 1300,
        ease: EASE.easeInOut,
        frames: [at(0.45, { tx: -1.5 * e, rot: -7 * e })],
      }
    case "rattle":
      return {
        ms: 550,
        ease: "linear",
        frames: [
          ...many([0.1, 0.3, 0.5, 0.7, 0.9], { tx: -2 * e }),
          ...many([0.2, 0.4, 0.6, 0.8], { tx: 2 * e }),
        ].sort((a, b) => a.at - b.at),
      }
    case "doublespin":
      return {
        ms: 1100,
        ease: [0.4, 0, 0.2, 1],
        frames: [at(1, { rot: 720 })],
      }
    case "headbang":
      return {
        ms: 1000,
        ease: EASE.easeInOut,
        frames: [
          ...many([0.15, 0.45, 0.75], { ty: 2 * e, rot: 16 * e }),
          ...many([0.3, 0.6, 0.9], { ty: -1 * e, rot: -10 * e }),
        ].sort((a, b) => a.at - b.at),
      }
    case "faint":
      return {
        ms: 1700,
        ease: [0.4, 0, 0.2, 1],
        frames: [
          ...many([0.25, 0.7], { tx: 4 * e, ty: 6 * e, rot: 80 }),
          at(0.85, { ty: -2 * e, rot: -6 }),
        ],
      }
    case "tremble":
      return {
        ms: 800,
        ease: "linear",
        frames: [
          ...many([0.1, 0.3, 0.5, 0.7, 0.9], { tx: -1.5 * e, ty: -1 * e }),
          ...many([0.2, 0.4, 0.6, 0.8], { tx: 1.5 * e, ty: 1 * e }),
        ].sort((a, b) => a.at - b.at),
      }
    default:
      return undefined
  }
}

/** The whole body's keyframes for a mood: the jumps, the swell, the flip. */
function bodyTrack(mood: NinjaMood, e: number): Track | undefined {
  switch (mood) {
    case "cheer":
      return {
        ms: 700,
        ease: [0.3, 1.6, 0.5, 1],
        frames: [
          at(0.3, { ty: pct(-16) * e, sx: 1.04, sy: 0.96 }),
          at(0.6, { ty: 0, sx: 0.98, sy: 1.03 }),
        ],
      }
    case "sparkle": {
      const s = 1 + 0.12 * e
      return {
        ms: 800,
        ease: [0.3, 1.5, 0.5, 1],
        frames: [at(0.3, { sx: s, sy: s })],
      }
    }
    case "flip":
      return {
        ms: 900,
        ease: [0.3, 0.6, 0.3, 1],
        frames: [
          at(0, { sx: 1.08, sy: 0.92 }),
          at(0.15, { ty: pct(-30) * e, rot: 60, sx: 0.96, sy: 1.06 }),
          at(0.5, { ty: pct(-55) * e, rot: 200 }),
          at(0.85, { rot: 360, sx: 1.1, sy: 0.9 }),
          at(1, { rot: 360 }),
        ],
      }
    case "inflate":
      return {
        ms: 900,
        ease: [0.3, 1.5, 0.5, 1],
        frames: [
          at(0.4, { sx: 1 + 0.3 * e, sy: 1 + 0.3 * e }),
          at(0.7, { sx: 1 + 0.24 * e, sy: 1 + 0.24 * e }),
        ],
      }
    default:
      return undefined
  }
}

/** The sensei's breathing while he waits: a slow swell, over and over. */
export const BREATHING: Track = {
  ms: 5000,
  ease: EASE.easeInOut,
  frames: [at(0.5, { sx: 1.012, sy: 1.012 })],
  loop: true,
}

/** Unhinged's shakes: a fine tremor for a few seconds at a time. */
export const TWEAK: Track = {
  ms: 140 * 4,
  ease: "step",
  frames: [
    at(0, { tx: pct(-1.2), ty: pct(0.6), rot: -0.8 }),
    at(0.25, { tx: pct(1), ty: pct(-0.8), rot: 0.6 }),
    at(0.5, { tx: pct(-0.6), ty: pct(-1), rot: 0.9 }),
    at(0.75, { tx: pct(1.2), ty: pct(0.8), rot: -0.5 }),
    at(1, { tx: pct(-1.2), ty: pct(0.6), rot: -0.8 }),
  ],
  loop: true,
}

/** The open eyes' slow blink (the sensei's yes), as a squash of both. */
const SLOW_BLINK: Track = {
  ms: 1300,
  ease: EASE.easeInOut,
  frames: many([0.45, 0.65], { sx: CLOSED[0], sy: CLOSED[1] }),
}

/** How a mood looks at a setting's energy. */
export function moodLook(mood: NinjaMood, e = 1): MoodLook {
  const eyes: Eyes = HAPPY_EYES.includes(mood)
    ? "happy"
    : SAD_EYES.includes(mood)
      ? "sad"
      : "open"
  const both = (s: Squash): [Squash, Squash] => [s, s]
  let squash: [Squash, Squash] = both(OPEN)
  if (CLOSED_EYES.includes(mood)) squash = both(CLOSED)
  else if (HALF_EYES.includes(mood)) squash = both(HALF)
  else if (WIDE_EYES.includes(mood)) squash = both(WIDE)
  else if (mood === "oops")
    squash = [
      [1, 0.5],
      [1, 0.8],
    ]
  else if (mood === "lookaway") squash = both([1, 0.7])
  const head: Pose = { ...REST }
  if (mood === "droop") head.ty = 2.5 * e
  if (mood === "tilt") head.rot = -8 * e
  if (mood === "oops") head.rot = -9 * e
  return {
    eyes,
    squash,
    look: mood === "lookaway" ? [5, 1] : undefined,
    head,
    headTrack: headTrack(mood, e),
    bodyTrack: bodyTrack(mood, e),
    eyeTrack: mood === "slowblink" ? SLOW_BLINK : undefined,
  }
}

/** One stretch of a channel's animation: where it goes, how long it takes. */
export interface Segment {
  to: number
  ms: number
}

/**
 * A track as one channel's stretches from `from` back to `from`, the way CSS runs keyframes: the
 * frames it gives, with the held pose filled in at 0 and 1 where the track leaves them out. A frame
 * that leaves the channel out has it at rest.
 */
export function segments<P extends Partial<Record<string, number>>>(
  track: Track<P>,
  channel: Channel | "opacity",
  from: number
): Segment[] {
  const points: { at: number; value: number }[] = track.frames.map((f) => ({
    at: f.at,
    value: f.pose[channel] ?? REST_ALL[channel]!,
  }))
  if (points[0]?.at !== 0) points.unshift({ at: 0, value: from })
  if (points.at(-1)?.at !== 1) points.push({ at: 1, value: from })
  const out: Segment[] = []
  for (let i = 1; i < points.length; i++)
    out.push({
      to: points[i]!.value,
      ms: (points[i]!.at - points[i - 1]!.at) * track.ms,
    })
  // A track that opens on a frame of its own jumps there first.
  if (points[0]!.value !== from) out.unshift({ to: points[0]!.value, ms: 0 })
  return out
}

/** Whether a track moves a channel at all (so the others can be left to their transitions). */
export function moves<P extends Partial<Record<string, number>>>(
  track: Track<P>,
  channel: Channel | "opacity"
): boolean {
  return track.frames.some(
    (f) =>
      f.pose[channel] !== undefined && f.pose[channel] !== REST_ALL[channel]
  )
}

/** His own glances' length at a setting, in ms (NINJA_GAZE is the CSS duration). */
export function gazeMs(gaze: string): number {
  return parseFloat(gaze) * (gaze.endsWith("ms") ? 1 : 1000)
}

/**
 * The intro's entrance on the wrapper the moods never touch, in points: casual and unhinged bounce
 * in twice with a squash on each landing, the sensei fades in and settles. Opacity rides along.
 */
export const ENTRANCE_MOVES: Record<
  "is-enter" | "is-settle",
  Track<EntrancePose>
> = {
  "is-enter": {
    ms: 1250,
    ease: [0.2, 0.7, 0.2, 1],
    frames: [
      at(0, { ty: 34, sx: 0.9, sy: 0.9, opacity: 0 }),
      at(0.18, { ty: -18, sx: 1.02, sy: 0.98, opacity: 1 }),
      at(0.34, { ty: 0, sx: 1.06, sy: 0.92 }),
      at(0.5, { ty: -9, sx: 0.99, sy: 1.02 }),
      at(0.66, { ty: 0, sx: 1.03, sy: 0.96 }),
      at(0.8, { ty: -2 }),
      at(1, {}),
    ],
  },
  "is-settle": {
    ms: 900,
    ease: [0.2, 0.7, 0.2, 1],
    frames: [
      at(0, { ty: 10, sx: 0.96, sy: 0.96, opacity: 0 }),
      at(0.55, { ty: 0, sx: 1.03, sy: 0.97, opacity: 1 }),
      at(1, {}),
    ],
  },
}
