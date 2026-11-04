import type { Item } from "./flow"
import { earnedMoment } from "./reducer"
import type { State } from "./state"
import type { NinjaLevel } from "./strings"

// The ninja's character, without his drawing: the moods he can be in, the reactions each setting
// plays for an answer, how he waits, enters, leaps, and sends the learner off. Both players read
// these: the web's ninja.tsx plays them as CSS classes (globals.css), the app's as Reanimated
// tracks (apps/mobile/src/lib/ninja-moves.ts). Reactions come from the player, never the lesson.

export type NinjaMood =
  | "idle"
  | "happy"
  | "cheer"
  | "wiggle"
  | "sparkle"
  | "nod"
  | "spin"
  | "oops"
  | "droop"
  | "sigh"
  | "shake"
  | "lookaway"
  | "wince"
  | "wide"
  | "half"
  | "closed"
  // Sensei: slow, held, eyes mostly closed.
  | "bow"
  | "deepbow"
  | "slowblink"
  | "liftnod"
  | "breath"
  | "tilt"
  | "halfturn"
  // Unhinged
  | "rattle"
  | "flip"
  | "doublespin"
  | "inflate"
  | "headbang"
  | "faint"
  | "tremble"
  // Story mode: spins back, as time rewinds to the decision.
  | "rewind"

/** The ninja settings he can be seen at (the player leaves him out when it's off). */
export type NinjaEnergy = Exclude<NinjaLevel, "off">

/** One beat of a reaction: a mood, how long to hold it, and where to look meanwhile. */
export type Beat = [mood: NinjaMood, ms: number, lookX?: number, lookY?: number]

/**
 * What his body knows about an answer: right, right at an earned moment (a streak or the last
 * question), wrong, nearly right, or wrong twice with the answer now shown. A character with no set
 * for a kind plays its nearest: happy for earned, sad for close and reveal. A scenario's rewind is
 * the same move for everyone.
 */
export type CueKind = "happy" | "earned" | "sad" | "close" | "reveal" | "rewind"
type Reactions = Record<"happy" | "sad", Record<string, Beat[]>> &
  Partial<Record<CueKind, Record<string, Beat[]>>>

/**
 * Each setting is a different character. Casual is small and warm. Sensei is slow and
 * composed. Unhinged is theatrical. At every level he's sorry with the learner, never at them: the
 * sad moves are all self-directed. Several variants per mood, so the same answer never feels canned.
 */
export const REACTIONS: Record<NinjaEnergy, Reactions> = {
  casual: {
    happy: {
      smile: [["happy", 1300]],
      cheer: [["cheer", 1100]],
      wiggle: [["wiggle", 1000]],
      sparkle: [
        ["wide", 320],
        ["sparkle", 1000],
      ],
      nod: [["nod", 1100]],
      spin: [
        ["spin", 850],
        ["happy", 900],
      ],
    },
    sad: {
      oops: [["oops", 1300]],
      droop: [["droop", 1500]],
      sigh: [["sigh", 1500]],
      shake: [
        ["shake", 600],
        ["half", 700],
      ],
      lookaway: [
        ["lookaway", 1100],
        ["half", 500, 0, 0],
      ],
      wince: [
        ["closed", 500],
        ["half", 900],
      ],
    },
  },
  // The sensei moves little and late, and never bounces. His approval is a slow blink or one nod
  // that lifts before it drops, as if weighed first; a bow is kept for the earned moments.
  sensei: {
    happy: {
      // One long, slow blink, then a quiet smile: the smallest possible yes.
      slowblink: [
        ["slowblink", 1300],
        ["happy", 800],
      ],
      // A small lift, then one nod.
      nod: [["liftnod", 1300]],
      // Eyes close for a moment, then a warm smile.
      serene: [
        ["closed", 500],
        ["happy", 1100],
      ],
    },
    earned: {
      // A small bow, held.
      bow: [["bow", 1700]],
    },
    sad: {
      // Eyes close, one slow breath in and out.
      breath: [["breath", 1900]],
      // Eyes close to think, then half open.
      ponder: [
        ["closed", 900],
        ["half", 900],
      ],
    },
    close: {
      // A head tilt, eyes open: considering, not sorry.
      tilt: [["tilt", 1500]],
    },
    reveal: {
      // A slow half-turn away and back with the eyes half closed, then they close while the answer
      // sinks in. (Not a headshake: a sideways shake means yes in some places.)
      halfturn: [
        ["halfturn", 1300, -4, 0.5],
        ["closed", 1400, 0, 0],
      ],
    },
  },
  unhinged: {
    happy: {
      // A full flip off the ground.
      flip: [
        ["flip", 900],
        ["happy", 500],
      ],
      // Two spins, dizzy, grin.
      doublespin: [
        ["doublespin", 1100],
        ["wide", 300],
        ["happy", 500],
      ],
      // Swells up with pride.
      inflate: [
        ["inflate", 900],
        ["happy", 400],
      ],
      headbang: [
        ["headbang", 1000],
        ["happy", 400],
      ],
    },
    sad: {
      // Tips over, lies there, gets up.
      faint: [["faint", 1700]],
      // Rattle, spin, slump.
      meltdown: [
        ["rattle", 550],
        ["doublespin", 1100],
        ["droop", 900],
      ],
      // A silent scream: wide eyes and a violent tremble.
      scream: [
        ["tremble", 800],
        ["half", 700],
      ],
    },
  },
}

/** How far the keyframes go at each setting (as --ninja-energy). The bigger sets are already big. */
export const NINJA_ENERGY: Record<NinjaEnergy, number> = {
  casual: 1,
  sensei: 0.85,
  unhinged: 1.6,
}

/** Things he does on his own while waiting, at the livelier settings. */
export const ANTICS: Record<NinjaEnergy, Beat[][]> = {
  casual: [],
  // The sensei waits without fidgeting.
  sensei: [],
  unhinged: [
    REACTIONS.unhinged.happy.flip!,
    REACTIONS.unhinged.happy.doublespin!,
    REACTIONS.unhinged.happy.headbang!,
    REACTIONS.unhinged.happy.inflate!,
  ],
}

/** How often the antics come (ms), at random in this range. */
export const ANTIC_EVERY: Record<NinjaEnergy, [number, number]> = {
  casual: [0, 0],
  sensei: [0, 0],
  unhinged: [9000, 16000],
}

/** How long his own glances take (as --ninja-gaze); following the pointer is quick for everyone. The sensei is unhurried. */
export const NINJA_GAZE: Record<NinjaEnergy, string> = {
  casual: "0.38s",
  sensei: "0.6s",
  unhinged: "0.3s",
}

/**
 * How each character waits. Blinks and glances come at random in these ranges (ms); `center` is
 * the chance a glance returns to the middle instead. The sensei blinks slowly and rarely, looks
 * around little, breathes (a slow swell, see `.is-breathing`), and now and then closes his eyes
 * for a few seconds until the pointer comes near.
 */
export const IDLE: Record<
  NinjaEnergy,
  {
    blink: [number, number]
    blinkMs: number
    doubleBlink: number
    wander: [number, number]
    center: number
    breathing: boolean
    meditate: { every: [number, number]; lasting: [number, number] } | null
  }
> = {
  casual: {
    blink: [2600, 6500],
    blinkMs: 120,
    doubleBlink: 0.25,
    wander: [1100, 3200],
    center: 0.35,
    breathing: false,
    meditate: null,
  },
  sensei: {
    blink: [4000, 9000],
    blinkMs: 200,
    doubleBlink: 0,
    wander: [2600, 6000],
    center: 0.5,
    breathing: true,
    meditate: { every: [18000, 40000], lasting: [3000, 5000] },
  },
  unhinged: {
    blink: [2600, 6500],
    blinkMs: 120,
    doubleBlink: 0.25,
    wander: [1100, 3200],
    center: 0.35,
    breathing: false,
    meditate: null,
  },
}

/**
 * The intro's entrance: a whole-body class (keyframes in globals.css), moods along the way, and
 * when it's over. Casual and Unhinged bounce in twice and grin; the sensei settles, closes his
 * eyes, and bows in.
 */
export const ENTRANCE: Record<
  NinjaEnergy,
  { className: string; beats: [at: number, mood: NinjaMood][]; ends: number }
> = {
  casual: { className: "is-enter", beats: [[760, "happy"]], ends: 1660 },
  sensei: {
    className: "is-settle",
    beats: [
      [600, "closed"],
      [1300, "bow"],
    ],
    ends: 3100,
  },
  unhinged: { className: "is-enter", beats: [[760, "happy"]], ends: 1660 },
}

/** The leap between the slot and the corner: how high the arc goes, and whether he grins through it. */
export const LEAP: Record<NinjaEnergy, { arc: number; grin: boolean }> = {
  casual: { arc: 120, grin: true },
  sensei: { arc: 60, grin: false },
  unhinged: { arc: 120, grin: true },
}

/** The wrap-up, once he's landed: a cheer for most, a bow out for the sensei, deeper after a perfect run. */
export const WRAP: Record<NinjaEnergy, { done: Beat[]; perfect: Beat[] }> = {
  casual: { done: [["cheer", 1200]], perfect: [["cheer", 1200]] },
  sensei: {
    done: [["bow", 2000]],
    perfect: [
      ["closed", 600],
      ["breath", 1900],
      ["deepbow", 2600],
    ],
  },
  unhinged: { done: [["cheer", 1200]], perfect: [["cheer", 1200]] },
}

/** Time runs back to the decision, and so does he. */
export const REWIND: Record<string, Beat[]> = { rewind: [["rewind", 750]] }

/** The reaction set a character plays for a kind: its own, or the nearest it has. */
function reactionSet(level: NinjaEnergy, kind: CueKind) {
  if (kind === "rewind") return REWIND
  const own = REACTIONS[level][kind]
  if (own) return own
  return REACTIONS[level][kind === "earned" ? "happy" : "sad"]
}

/** A stable pick from a list for a seed, skipping the one played last time. */
export function pickFrom(names: string[], seed: string, last?: string): string {
  const pool = names.filter((n) => n !== last)
  let h = 0
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0
  return pool[h % pool.length]!
}

/** The reaction to play for an answer at a setting. Unhinged gets two in a row where there's a choice. */
export function reactionFor(
  kind: CueKind,
  seed: string,
  level: NinjaEnergy,
  last?: string
): { name: string; beats: Beat[] } {
  const set = reactionSet(level, kind)
  const names = Object.keys(set)
  const name = pickFrom(names, seed, last)
  let beats = set[name]!
  // Unhinged doubles up, except on a rewind: there's only the one move.
  if (level === "unhinged" && names.length > 1) {
    const encore = pickFrom(names, `${seed}!`, name)
    beats = [...beats, ...set[encore]!]
  }
  return { name, beats }
}

/**
 * What the ninja's body knows about the answer just checked: the earned moments that get a move
 * of their own (a streak, the last question), a near miss, and the second miss that shows the
 * answer. A wrong hook guess is only a guess, so it's a plain miss.
 */
export function cueKindFor(
  state: State,
  item: Extract<Item, { kind: "question" }>
): CueKind {
  const s = state.question
  if (!s?.result) return "sad"
  if (s.result.correct) {
    const earned = earnedMoment(state, item)
    return earned === "streak" || earned === "last" ? "earned" : "happy"
  }
  if (item.role === "hook") return "sad"
  if (s.phase === "revealed") return "reveal"
  return s.result.partial ? "close" : "sad"
}
