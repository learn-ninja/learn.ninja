"use client"

import * as React from "react"

import { cn } from "@workspace/ui/lib/utils"

import type { NinjaLevel } from "./strings"

// The ninja: the logo as a character. He is the same mark as the header logo with two extra eye
// layers (happy arcs, sad arcs) that stay hidden until a mood class asks for them. Everything he
// does is eye and head transforms, so he still reads as the logo at 22px. Styles live in
// packages/ui/src/styles/globals.css under `.ninja`. Reactions come from the player, never the lesson.

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

/** How far (in viewBox units) a bleeding mark's box reaches past the 64-unit drawing on each side. */
const BLEED = 16

export const Ninja = React.forwardRef<
  SVGSVGElement,
  {
    mood?: NinjaMood
    className?: string
    /**
     * Draw him inside a box a quarter bigger on every side (size it at 150%, offset by -25%). His
     * rolls and bounces leave the 64-unit box, and Safari crops whatever an SVG draws past its own
     * box, overflow: visible or not; the bleed gives them room inside it.
     */
    bleed?: boolean
  }
>(function Ninja({ mood = "idle", className, bleed = false }, ref) {
  return (
    <svg
      ref={ref}
      viewBox={
        bleed
          ? `${-BLEED} ${-BLEED} ${64 + 2 * BLEED} ${64 + 2 * BLEED}`
          : "0 0 64 64"
      }
      fill="none"
      aria-hidden="true"
      className={cn(
        "ninja",
        bleed && "ninja-bleed",
        mood !== "idle" && `e-${mood}`,
        className
      )}
    >
      <g className="ninja-head">
        <g stroke="currentColor" strokeWidth="5" strokeLinejoin="round">
          <path d="M7.01 24.83A26 26 0 0 1 56.99 24.83Q32 15.17 7.01 24.83Z" />
          <path d="M56.99 39.17Q32 48.83 7.01 39.17A26 26 0 0 0 56.99 39.17Z" />
        </g>
        <g className="ninja-eyes">
          <g className="ninja-open" fill="currentColor">
            <ellipse cx="25" cy="32" rx="2.9" ry="4.6" />
            <ellipse cx="39" cy="32" rx="2.9" ry="4.6" />
          </g>
          <g
            className="ninja-happy"
            stroke="currentColor"
            strokeWidth="3.4"
            strokeLinecap="round"
          >
            <path d="M21 34.4Q25 28.6 29 34.4" />
            <path d="M35 34.4Q39 28.6 43 34.4" />
          </g>
          <g
            className="ninja-sad"
            stroke="currentColor"
            strokeWidth="3.4"
            strokeLinecap="round"
          >
            <path d="M21.5 30.2Q25 34.6 28.5 31.6" />
            <path d="M42.5 30.2Q39 34.6 35.5 31.6" />
          </g>
        </g>
      </g>
    </svg>
  )
})

// ---------- reactions ----------

/** One beat of a reaction: a mood, how long to hold it, and where to look meanwhile. */
type Beat = [mood: NinjaMood, ms: number, lookX?: number, lookY?: number]

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
const ANTIC_EVERY: Record<NinjaEnergy, [number, number]> = {
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
const REWIND: Record<string, Beat[]> = { rewind: [["rewind", 750]] }

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

const MOOD_CLASSES = (
  [
    "happy",
    "cheer",
    "wiggle",
    "sparkle",
    "nod",
    "spin",
    "oops",
    "droop",
    "sigh",
    "shake",
    "lookaway",
    "wince",
    "wide",
    "half",
    "closed",
    "bow",
    "deepbow",
    "slowblink",
    "liftnod",
    "breath",
    "tilt",
    "halfturn",
    "rattle",
    "flip",
    "doublespin",
    "inflate",
    "headbang",
    "faint",
    "tremble",
    "rewind",
  ] satisfies NinjaMood[]
).map((m) => `e-${m}`)

export function setMood(svg: SVGSVGElement, mood: NinjaMood) {
  svg.classList.remove(...MOOD_CLASSES)
  // Re-adding the same class restarts nothing; a reflow in between lets a keyframe mood replay.
  void svg.getBoundingClientRect()
  if (mood !== "idle") svg.classList.add(`e-${mood}`)
}

/**
 * Plays one mood on a mark, then settles him back to idle after `ms`; a new mood cuts the last
 * one short, and unmounting cancels the settle. For a single emote on a click (the footer, the
 * mission page); a reaction of several beats goes through `useNinjaLife().play`.
 */
export function useEmote(
  svg: React.RefObject<SVGSVGElement | null>,
  ms: number
): (mood: NinjaMood) => void {
  const settle = React.useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined
  )
  React.useEffect(() => () => clearTimeout(settle.current), [])
  return React.useCallback(
    (mood: NinjaMood) => {
      const el = svg.current
      if (!el) return
      clearTimeout(settle.current)
      setMood(el, mood)
      settle.current = setTimeout(() => setMood(el, "idle"), ms)
    },
    [svg, ms]
  )
}

// ---------- idle life ----------

export interface NinjaLife {
  /** Pause the idle gaze and blinks, e.g. while a reaction plays. */
  hold: (on: boolean) => void
  /** Point the eyes: ±5 sideways, about -2 to 2.5 up and down, in the mark's own units. */
  look: (x: number, y: number) => void
  /** Play a reaction, then return to idle. */
  play: (beats: Beat[]) => Promise<void>
}

const rnd = (a: number, b: number) => a + Math.random() * (b - a)
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

export function reducedMotion(): boolean {
  return (
    typeof matchMedia !== "undefined" &&
    matchMedia("(prefers-reduced-motion: reduce)").matches
  )
}

/**
 * Keeps him alive: his eyes wander every second or two, he blinks at random (sometimes twice),
 * and he follows the pointer while it's over `area`. At the livelier settings he also pulls a stunt
 * now and then. Nothing moves when the viewer prefers reduced motion.
 */
export function useNinjaLife(
  svg: React.RefObject<SVGSVGElement | null>,
  area: React.RefObject<HTMLElement | null>,
  level: NinjaEnergy = "sensei"
): NinjaLife {
  const held = React.useRef(false)
  const pointer = React.useRef(false)
  const look = React.useCallback(
    (x: number, y: number) => {
      svg.current?.style.setProperty("--ex", `${x.toFixed(2)}px`)
      svg.current?.style.setProperty("--ey", `${y.toFixed(2)}px`)
    },
    [svg]
  )
  const play = React.useCallback(
    async (beats: Beat[]) => {
      const el = svg.current
      if (!el) return
      held.current = true
      for (const [mood, ms, x, y] of beats) {
        if (!svg.current) return
        setMood(el, mood)
        if (x !== undefined) look(x, y ?? 0)
        await sleep(reducedMotion() ? Math.min(ms, 600) : ms)
      }
      if (svg.current) {
        setMood(el, "idle")
        look(0, 0)
      }
      held.current = false
    },
    [svg, look]
  )
  React.useEffect(() => {
    const el = svg.current
    const box = area.current
    if (!el || !box || reducedMotion()) return
    let on = true
    const timers = new Set<ReturnType<typeof setTimeout>>()
    const later = (fn: () => void, ms: number) => {
      const t = setTimeout(() => {
        timers.delete(t)
        if (on) fn()
      }, ms)
      timers.add(t)
    }
    const idle = IDLE[level]
    // The sensei's eyes-closed moments: on until the time is up or the pointer comes near.
    let meditating = false
    const wake = () => {
      if (!meditating) return
      meditating = false
      // A reaction that cut in has already taken his eyes; it restores idle itself.
      if (!held.current) setMood(el, "idle")
    }
    const blinkOnce = (ms: number) => {
      el.classList.add("is-blink")
      later(() => el.classList.remove("is-blink"), ms)
    }
    const blink = () => {
      if (!held.current && !meditating) {
        blinkOnce(idle.blinkMs)
        if (Math.random() < idle.doubleBlink) later(() => blinkOnce(110), 280)
      }
      later(blink, rnd(...idle.blink))
    }
    const wander = () => {
      if (!held.current && !pointer.current && !meditating) {
        if (Math.random() < idle.center) look(0, 0)
        else look(rnd(-4.5, 4.5), rnd(-1.6, 2.2))
      }
      later(wander, rnd(...idle.wander))
    }
    const meditate = () => {
      const m = idle.meditate
      if (!m) return
      if (!held.current && !pointer.current) {
        meditating = true
        setMood(el, "closed")
        later(wake, rnd(...m.lasting))
      }
      later(meditate, rnd(...m.every))
    }
    // Following the pointer: the eyes snap (`.is-following` shortens their transition) and move once
    // per frame, from the last pointer position, however many events arrived in between.
    let at: { x: number; y: number } | null = null
    let frame = 0
    const follow = () => {
      frame = 0
      if (!at || held.current) return
      const r = el.getBoundingClientRect()
      const cx = r.left + r.width / 2
      const cy = r.top + r.height / 2
      // The drawing's own size, without a bleed around it.
      const size = (r.width * 64) / (el.viewBox.baseVal?.width || 64)
      look(
        clamp(((at.x - cx) / (size * 1.3)) * 5, -5, 5),
        clamp(((at.y - cy) / (size * 1.3)) * 2.4, -2, 2.4)
      )
    }
    const move = (e: PointerEvent) => {
      pointer.current = true
      wake()
      at = { x: e.clientX, y: e.clientY }
      el.classList.add("is-following")
      if (!frame) frame = requestAnimationFrame(follow)
    }
    const leave = () => {
      pointer.current = false
      at = null
      el.classList.remove("is-following")
      if (!held.current) look(0, 0)
    }
    const stunts = ANTICS[level]
    const antic = () => {
      if (!held.current && stunts.length)
        void play(stunts[Math.floor(Math.random() * stunts.length)]!)
      later(antic, rnd(...ANTIC_EVERY[level]))
    }
    // Unhinged gets the shakes now and then: a fine tremor for a couple of seconds.
    const tremor = () => {
      if (!held.current) {
        el.classList.add("is-tweaking")
        later(() => el.classList.remove("is-tweaking"), rnd(1500, 3000))
      }
      later(tremor, rnd(6000, 12000))
    }
    later(blink, rnd(2000, 4000))
    later(wander, 600)
    if (stunts.length) later(antic, rnd(...ANTIC_EVERY[level]))
    if (level === "unhinged") later(tremor, rnd(2500, 6000))
    if (idle.meditate) later(meditate, rnd(...idle.meditate.every))
    if (idle.breathing) el.classList.add("is-breathing")
    box.addEventListener("pointermove", move)
    box.addEventListener("pointerleave", leave)
    return () => {
      on = false
      timers.forEach(clearTimeout)
      if (frame) cancelAnimationFrame(frame)
      el.classList.remove("is-tweaking", "is-breathing", "is-following")
      if (meditating) setMood(el, "idle")
      box.removeEventListener("pointermove", move)
      box.removeEventListener("pointerleave", leave)
    }
  }, [svg, area, look, play, level])
  return React.useMemo<NinjaLife>(
    () => ({
      hold: (on) => {
        held.current = on
      },
      look,
      play,
    }),
    [look, play]
  )
}

const clamp = (v: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, v))

// ---------- the stage ----------

export interface NinjaCue {
  kind: CueKind
  /** Changes once per thing worth reacting to (a check, a reveal). */
  key: string
}

/**
 * Where he is on the lesson card. He sits in the screen's `[data-ninja-slot]` when it has one
 * (the intro, the wrap-up) and in the card's bottom start corner otherwise, and
 * leaps between the two. To and from a brief (`data-ninja-slot="brief"`) it's a quick hop, since
 * the question is waiting.
 */
export function NinjaStage({
  area,
  screen,
  cue,
  celebrate,
  level = "sensei",
  vanishing = false,
}: {
  /** The lesson card: he's positioned inside it and follows the pointer over it. */
  area: React.RefObject<HTMLDivElement | null>
  /** Changes whenever the screen does (or a scenario's brief ends), so he looks for his slot again. */
  screen: number | string
  /** The last answer worth a reaction. */
  cue: NinjaCue | null
  /** Set on the wrap-up: his send-off once he's landed, with more for a perfect run. */
  celebrate?: "done" | "perfect"
  /** Which character he is. The player leaves him out entirely when the setting is off. */
  level?: NinjaEnergy
  /** Set while the intro vanishes: he goes up in smoke too, and turns up on the next screen instead of leaping. */
  vanishing?: boolean
}) {
  const float = React.useRef<HTMLDivElement>(null)
  const svg = React.useRef<SVGSVGElement>(null)
  // What the entrance animates: a wrapper the moods never touch (see enter).
  const entrance = React.useRef<HTMLDivElement>(null)
  const life = useNinjaLife(svg, area, level)
  const [placed, setPlaced] = React.useState(false)
  // Where he is: in the slot (measured) or in the corner (classes).
  const [slot, setSlot] = React.useState<{
    left: number
    top: number
    size: number
    kind: string
  } | null>(null)
  const lastScreen = React.useRef<number | string | null>(null)
  const leaping = React.useRef<Promise<void> | null>(null)
  // The kind of slot he's in ("" for a plain slot), or null in the corner.
  const slotKind = React.useRef<string | null>(null)
  // After vanishing he reappears where he's going, out of a wisp of smoke.
  const vanished = React.useRef(false)
  const [appearing, setAppearing] = React.useState(false)
  React.useEffect(() => {
    if (vanishing) vanished.current = true
  }, [vanishing])

  // The card is the stage's parent. (The `area` ref isn't attached yet when this first runs.)
  const measure = React.useCallback(() => {
    const card = float.current?.parentElement
    if (!card) return null
    const el = card.querySelector<HTMLElement>("[data-ninja-slot]")
    if (!el) return null
    const c = card.getBoundingClientRect()
    const r = el.getBoundingClientRect()
    return {
      left: r.left - c.left,
      top: r.top - c.top,
      size: r.width,
      kind: el.dataset.ninjaSlot ?? "",
    }
  }, [area])

  // On each new screen: find the slot, place him, and set up the leap from wherever he was. The
  // leap itself starts in the effect below, once the placement is in the DOM.
  const pending = React.useRef<{
    first: DOMRect
    brisk: boolean
    landed: () => void
  } | null>(null)
  React.useLayoutEffect(() => {
    const el = float.current
    const mark = svg.current
    const box = entrance.current
    if (!el || !mark || !box) return
    const first = el.getBoundingClientRect()
    const next = measure()
    const brisk = slotKind.current === "brief" || next?.kind === "brief"
    const inCorner = slotKind.current === null
    slotKind.current = next ? next.kind : null
    setSlot(next)
    setPlaced(true)
    const firstTime = lastScreen.current === null
    // The same screen again: React re-running the effect (twice in development) or the character
    // changing. He's already where he belongs; on the intro, the new character makes his entrance.
    const again = lastScreen.current === screen
    lastScreen.current = screen
    if (firstTime || again) {
      // The intro's entrance, in character. Demos that open mid-lesson just appear.
      if (next && screen === 0 && !reducedMotion())
        return enter(mark, life, level, box)
      return
    }
    if (reducedMotion()) return
    if (vanished.current) {
      vanished.current = false
      setAppearing(true)
      return
    }
    // Corner to corner: the placement doesn't change, so there's no re-render to leap from.
    if (!next && inCorner) return
    // Reactions and the send-off wait on the leap from now, or they'd find nothing to wait for and
    // play while he's still in the air.
    let settle = () => {}
    const promise = new Promise<void>((resolve) => {
      settle = resolve
    })
    leaping.current = promise
    const landed = () => {
      settle()
      if (leaping.current === promise) leaping.current = null
    }
    pending.current = { first, brisk, landed }
    return () => {
      pending.current = null
      landed()
    }
  }, [screen, measure, life, level])

  // FLIP: the placement above re-renders him synchronously, still before the browser paints, so
  // measuring his end spot here and starting the leap at once means he never shows up there
  // early. (Waiting a frame would paint him in the corner first, for longer the heavier the screen.)
  React.useLayoutEffect(() => {
    const el = float.current
    const mark = svg.current
    const job = pending.current
    if (!el || !mark || !job) return
    pending.current = null
    const last = el.getBoundingClientRect()
    if (
      Math.abs(job.first.left - last.left) < 2 &&
      Math.abs(job.first.top - last.top) < 2 &&
      Math.abs(job.first.width - last.width) < 2
    ) {
      job.landed()
      return
    }
    void leap(el, mark, life, job.first, last, level, job.brisk).then(
      job.landed
    )
  }, [slot, life, level])

  // Keep him on the slot when the card or its content resizes or scrolls. The content is the
  // slot's parent: it grows with the text size while the card stays put, moving the slot.
  React.useEffect(() => {
    const card = float.current?.parentElement
    if (!card || !slot) return
    const update = () => setSlot(measure())
    const observer = new ResizeObserver(update)
    observer.observe(card)
    const content = card.querySelector("[data-ninja-slot]")?.parentElement
    if (content) observer.observe(content)
    const scroller = card.querySelector("main")
    scroller?.addEventListener("scroll", update, { passive: true })
    return () => {
      observer.disconnect()
      scroller?.removeEventListener("scroll", update)
    }
  }, [measure, slot === null])

  // Reactions to answers.
  const lastName = React.useRef<string | undefined>(undefined)
  React.useEffect(() => {
    if (!cue) return
    const { name, beats } = reactionFor(
      cue.kind,
      cue.key,
      level,
      lastName.current
    )
    lastName.current = name
    let cancelled = false
    ;(async () => {
      await leaping.current
      if (!cancelled) await life.play(beats)
    })()
    return () => {
      cancelled = true
    }
  }, [cue?.key, cue?.kind, level, life])

  // The wrap-up: his send-off once he's landed on his slot.
  React.useEffect(() => {
    if (!celebrate) return
    let cancelled = false
    ;(async () => {
      await leaping.current
      if (cancelled) return
      await life.play(WRAP[level][celebrate])
    })()
    return () => {
      cancelled = true
    }
  }, [celebrate, level, life])

  return (
    <div
      ref={float}
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute z-10",
        !placed && "invisible",
        // Phones have no room for him beside the content, so there he only shows in a screen's slot
        // (the intro, the wrap-up).
        !slot &&
          "start-4 bottom-4 size-10 max-sm:hidden sm:start-6 sm:bottom-6",
        vanishing && "ninja-vanish",
        appearing && "ninja-appear"
      )}
      onAnimationEnd={(e) => {
        if (e.target === e.currentTarget) setAppearing(false)
      }}
      style={
        {
          "--ninja-energy": NINJA_ENERGY[level],
          "--ninja-gaze": NINJA_GAZE[level],
          ...(slot
            ? {
                left: slot.left,
                top: slot.top,
                width: slot.size,
                height: slot.size,
              }
            : null),
        } as React.CSSProperties
      }
    >
      <div ref={entrance} className="ninja-entrance absolute inset-0">
        <Ninja
          ref={svg}
          bleed
          className="absolute -start-1/4 -top-1/4 size-[150%] max-w-none"
        />
      </div>
    </div>
  )
}

/**
 * Plays the character's entrance and returns a function that cuts it short and puts him back to
 * idle (also what a finished entrance does). The moods go on the mark; the entrance's own animation
 * goes on `box`, a wrapper the stage gives it: Safari restarts a CSS animation on the mark when its
 * mood and idle classes change partway through, so the entrance faded in twice there.
 */
export function enter(
  mark: SVGSVGElement,
  life: NinjaLife,
  level: NinjaEnergy,
  box: Element = mark
): () => void {
  const { className, beats, ends } = ENTRANCE[level]
  life.hold(true)
  box.classList.add(className)
  const timers = beats.map(([at, mood]) =>
    setTimeout(() => setMood(mark, mood), at)
  )
  const done = () => {
    setMood(mark, "idle")
    box.classList.remove(className)
    life.hold(false)
  }
  timers.push(setTimeout(done, ends))
  return () => {
    timers.forEach(clearTimeout)
    done()
  }
}

/**
 * Squat, launch, arc over, land with a squash and a small bounce. About 1.4s. The sensei's arc is
 * lower and he lands eyes closed. `brisk` is the hop to and from a scenario's brief: a low arc, a
 * soft landing, and no grin after, about 0.9s.
 */
async function leap(
  el: HTMLElement,
  mark: SVGSVGElement,
  life: NinjaLife,
  first: DOMRect,
  last: DOMRect,
  level: NinjaEnergy = "sensei",
  brisk = false
) {
  life.hold(true)
  const arc = LEAP[level].arc * (brisk ? 0.35 : 1)
  const grin = LEAP[level].grin && !brisk
  const dx = first.left - last.left
  const dy = first.top - last.top
  const s0 = first.width / last.width
  const lean = dx > 0 ? -16 : 16
  const lerp = (a: number, b: number, t: number) => a + (b - a) * t
  const frames: Keyframe[] = []
  const N = 24
  for (let i = 0; i <= N; i++) {
    const p = i / N
    let tx = dx
    let ty = dy
    let s = s0
    let sx = 1
    let sy = 1
    let rot = 0
    if (p < 0.12) {
      // The squat, in place.
      const q = p / 0.12
      sx = lerp(1, 1.12, q)
      sy = lerp(1, 0.84, q)
    } else {
      const u = (p - 0.12) / 0.88
      const e = u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2
      tx = dx * (1 - e)
      ty = dy * (1 - e) - arc * Math.sin(Math.PI * u)
      s = lerp(s0, 1, e)
      // The squash becomes a stretch in the air, then neutral.
      sx =
        u < 0.14
          ? lerp(1.12, 0.92, u / 0.14)
          : u < 0.36
            ? lerp(0.92, 1, (u - 0.14) / 0.22)
            : 1
      sy =
        u < 0.14
          ? lerp(0.84, 1.12, u / 0.14)
          : u < 0.36
            ? lerp(1.12, 1, (u - 0.14) / 0.22)
            : 1
      rot = lean * Math.sin(Math.PI * u)
    }
    frames.push({
      transform: `translate(${tx.toFixed(1)}px, ${ty.toFixed(1)}px) rotate(${rot.toFixed(1)}deg) scale(${(s * sx).toFixed(3)}, ${(s * sy).toFixed(3)})`,
      offset: p,
    })
  }
  const t = setTimeout(
    () => setMood(mark, grin ? "happy" : brisk ? "idle" : "closed"),
    100
  )
  await el.animate(frames, { duration: brisk ? 560 : 800, easing: "linear" })
    .finished
  clearTimeout(t)
  if (!brisk) setMood(mark, "closed")
  // The landing: a squash and a bounce, or for the sensei a soft settle with no bounce.
  await el.animate(
    grin
      ? [
          { transform: "scale(1)" },
          { transform: "scale(1.22, .78)", offset: 0.22 },
          { transform: "translateY(-9px) scale(.96, 1.06)", offset: 0.5 },
          { transform: "translateY(0) scale(1.08, .94)", offset: 0.7 },
          { transform: "translateY(-2px) scale(1)", offset: 0.86 },
          { transform: "translateY(0) scale(1)" },
        ]
      : [
          { transform: "scale(1)" },
          { transform: "scale(1.08, .92)", offset: 0.3 },
          { transform: "scale(1)" },
        ],
    { duration: brisk ? 340 : 620, easing: "cubic-bezier(.3,1.2,.4,1)" }
  ).finished
  if (grin) {
    setMood(mark, "wide")
    life.look(4, -2)
    await sleep(340)
    setMood(mark, "happy")
    await sleep(650)
  } else if (!brisk) {
    await sleep(500)
  }
  setMood(mark, "idle")
  life.look(0, 0)
  life.hold(false)
}

// ---------- the smoke ----------

// The puffs: where each sits (% of the smoke box), its size (% of the box's width), its starting
// turn, how long one turn takes (s), which way it turns, and how strong it is. Few and large: every
// layer costs Safari memory and drawing time.
const PUFFS: {
  x: number
  y: number
  size: number
  turn: number
  secs: number
  back?: boolean
  alpha: number
}[] = [
  { x: 50, y: 52, size: 60, turn: 0, secs: 70, alpha: 0.85 },
  { x: 36, y: 46, size: 48, turn: 120, secs: 54, back: true, alpha: 0.75 },
  { x: 64, y: 44, size: 50, turn: 210, secs: 62, alpha: 0.75 },
  { x: 30, y: 64, size: 42, turn: 40, secs: 48, alpha: 0.6 },
  { x: 70, y: 63, size: 44, turn: 300, secs: 58, back: true, alpha: 0.6 },
  { x: 50, y: 33, size: 42, turn: 80, secs: 44, back: true, alpha: 0.55 },
  { x: 52, y: 70, size: 46, turn: 160, secs: 66, alpha: 0.55 },
  { x: 20, y: 48, size: 34, turn: 250, secs: 40, alpha: 0.45 },
  { x: 80, y: 46, size: 34, turn: 20, secs: 46, back: true, alpha: 0.45 },
]

/**
 * The smoke behind the intro: overlapping puffs of one smoke texture, each turning slowly at its own
 * pace, so together they curl and billow. `shift` moves it up or down (px) to follow the content,
 * e.g. when the ninja's slot folds away. `vanishing` flares it and blows the puffs outward as the
 * intro disappears. No scripts, nothing loaded: the textures are in the stylesheet (smoke.css).
 */
export function Aura({
  shift = 0,
  vanishing = false,
}: {
  shift?: number
  vanishing?: boolean
}) {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 -z-10 overflow-hidden rounded-[inherit]"
      style={{ "--aura-shift": `${shift}px` } as React.CSSProperties}
    >
      <div className="smoke" data-vanishing={vanishing || undefined}>
        {PUFFS.map((p, i) => (
          <div
            key={i}
            className="smoke-puff"
            style={
              {
                "--x": `${p.x}%`,
                "--y": `${p.y}%`,
                "--size": `${p.size}%`,
                // Out from the middle, so the burst spreads.
                "--bx": `${(p.x - 50) * 4}px`,
                "--by": `${(p.y - 50) * 4 - 40}px`,
                opacity: p.alpha,
              } as React.CSSProperties
            }
          >
            <div
              className={cn("smoke-spin", i % 2 ? "smoke-b" : "smoke-a")}
              style={
                {
                  "--turn": `${p.turn}deg`,
                  // The starting turn as a head start, so the keyframes stay plain (Safari runs
                  // those on the GPU; ones with variables it may not).
                  animationDelay: `${-(p.turn / 360) * p.secs}s`,
                  animationDuration: `${p.secs}s`,
                  animationDirection: p.back ? "reverse" : "normal",
                } as React.CSSProperties
              }
            />
          </div>
        ))}
      </div>
    </div>
  )
}

/**
 * Text that can vanish into smoke word by word (the `vanish` class on an ancestor starts it). Words,
 * not letters, so joined scripts like Arabic keep their shapes. `step` is the delay between words (ms).
 */
export function SmokeWords({
  text,
  step = 40,
}: {
  text: string
  step?: number
}) {
  const words = text.split(/\s+/).filter(Boolean)
  return words.map((word, i) => (
    <React.Fragment key={i}>
      {i > 0 ? " " : null}
      <span
        className="vanish-word"
        style={
          {
            "--delay": `${Math.min(i * step, 360)}ms`,
          } as React.CSSProperties
        }
      >
        {word}
      </span>
    </React.Fragment>
  ))
}
