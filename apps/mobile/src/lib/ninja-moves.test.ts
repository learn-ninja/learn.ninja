import { describe, expect, it } from "vitest"

import {
  ENTRANCE,
  REACTIONS,
  reactionFor,
  WRAP,
  type CueKind,
  type NinjaEnergy,
  type NinjaMood,
} from "@workspace/player-core/ninja"

import {
  CLOSED,
  ENTRANCE_MOVES,
  moodLook,
  moves,
  segments,
  TWEAK,
} from "./ninja-moves"

const LEVELS: NinjaEnergy[] = ["casual", "sensei", "unhinged"]
const KINDS: CueKind[] = ["happy", "earned", "sad", "close", "reveal", "rewind"]

/** Every mood a reaction, the wrap-up, or the entrance asks for. */
const used = new Set<NinjaMood>([
  ...LEVELS.flatMap((l) =>
    Object.values(REACTIONS[l]).flatMap((set) =>
      Object.values(set ?? {}).flatMap((beats) => beats.map((b) => b[0]))
    )
  ),
  ...LEVELS.flatMap((l) =>
    [...WRAP[l].done, ...WRAP[l].perfect].map((b) => b[0])
  ),
  ...LEVELS.flatMap((l) => ENTRANCE[l].beats.map((b) => b[1])),
  "rewind",
])

describe("the ninja's moods", () => {
  it("shows the eyes each mood asks for, as globals.css does", () => {
    expect(moodLook("happy").eyes).toBe("happy")
    expect(moodLook("cheer").eyes).toBe("happy")
    expect(moodLook("droop").eyes).toBe("sad")
    expect(moodLook("faint").eyes).toBe("sad")
    expect(moodLook("closed").eyes).toBe("open")
    expect(moodLook("closed").squash).toEqual([CLOSED, CLOSED])
    expect(moodLook("bow").squash[0]).toEqual(CLOSED)
    expect(moodLook("half").squash[0]).toEqual([1.02, 0.45])
    expect(moodLook("wide").squash[1]).toEqual([1.22, 1.28])
    // Oops squints one eye more than the other, and looks away holds his gaze to the side.
    expect(moodLook("oops").squash).toEqual([
      [1, 0.5],
      [1, 0.8],
    ])
    expect(moodLook("lookaway").look).toEqual([5, 1])
  })

  it("holds the head where the held moods put it, scaled by energy", () => {
    expect(moodLook("droop", 1).head.ty).toBe(2.5)
    expect(moodLook("droop", 1.6).head.ty).toBeCloseTo(4)
    expect(moodLook("tilt", 0.85).head.rot).toBeCloseTo(-6.8)
    expect(moodLook("idle").head).toEqual({
      tx: 0,
      ty: 0,
      rot: 0,
      sx: 1,
      sy: 1,
    })
  })

  it("gives every mood the player uses a look, and every keyframe mood a track", () => {
    const tracked: NinjaMood[] = [
      "sigh",
      "shake",
      "cheer",
      "wiggle",
      "nod",
      "sparkle",
      "spin",
      "rewind",
      "bow",
      "deepbow",
      "slowblink",
      "liftnod",
      "breath",
      "halfturn",
      "rattle",
      "flip",
      "doublespin",
      "inflate",
      "headbang",
      "faint",
      "tremble",
    ]
    for (const mood of tracked) {
      const look = moodLook(mood)
      expect(
        look.headTrack ?? look.bodyTrack ?? look.eyeTrack,
        mood
      ).toBeDefined()
    }
    for (const mood of used) expect(moodLook(mood)).toBeDefined()
  })

  it("keeps every track's frames in order inside it", () => {
    for (const mood of used) {
      const look = moodLook(mood)
      for (const track of [look.headTrack, look.bodyTrack, look.eyeTrack]) {
        if (!track) continue
        const ats = track.frames.map((f) => f.at)
        expect(ats, mood).toEqual([...ats].sort((a, b) => a - b))
        expect(Math.min(...ats)).toBeGreaterThanOrEqual(0)
        expect(Math.max(...ats)).toBeLessThanOrEqual(1)
      }
    }
  })
})

describe("segments", () => {
  it("fills in the held pose at both ends, as CSS keyframes do", () => {
    const bow = moodLook("bow").headTrack!
    // 35% and 65% dip, so: down in 35%, held 30%, back up in 35%.
    expect(segments(bow, "ty", 0)).toEqual([
      { to: 4, ms: 0.35 * 1700 },
      { to: 4, ms: (0.65 - 0.35) * 1700 },
      { to: 0, ms: 0.35 * 1700 },
    ])
    // A channel a frame leaves out is at rest there (sigh ends on its own frame).
    expect(
      segments(moodLook("sigh").headTrack!, "sx", 1).map((s) => s.to)
    ).toEqual([1.02, 1])
  })

  it("lasts as long as its track", () => {
    for (const mood of used) {
      const track = moodLook(mood).headTrack ?? moodLook(mood).bodyTrack
      if (!track) continue
      const total = segments(track, "ty", 0).reduce((n, s) => n + s.ms, 0)
      expect(total, mood).toBeCloseTo(track.ms)
    }
  })

  it("starts on a track's own first frame when it gives one", () => {
    const flip = moodLook("flip").bodyTrack!
    const sx = segments(flip, "sx", 1)
    expect(sx[0]).toEqual({ to: 1.08, ms: 0 })
    expect(sx.at(-1)!.to).toBe(1)
  })

  it("knows which channels a track moves", () => {
    const spin = moodLook("spin").headTrack!
    expect(moves(spin, "rot")).toBe(true)
    expect(moves(spin, "ty")).toBe(false)
    expect(moves(TWEAK, "tx")).toBe(true)
  })

  it("fades the entrance in from nothing", () => {
    const enter = ENTRANCE_MOVES["is-enter"]
    expect(segments(enter, "opacity", 1)[0]).toEqual({ to: 0, ms: 0 })
    expect(segments(enter, "opacity", 1).at(-1)!.to).toBe(1)
    for (const level of LEVELS)
      expect(ENTRANCE_MOVES).toHaveProperty(ENTRANCE[level].className)
  })
})

describe("reactionFor", () => {
  it("picks the same reaction for the same cue, so a replay matches", () => {
    for (const level of LEVELS)
      for (const kind of KINDS)
        expect(reactionFor(kind, "3-1-feedback", level)).toEqual(
          reactionFor(kind, "3-1-feedback", level)
        )
  })

  it("never plays the same reaction twice in a row where there's a choice", () => {
    for (const level of LEVELS)
      for (const kind of ["happy", "sad"] as const) {
        let last: string | undefined
        for (let i = 0; i < 20; i++) {
          const { name } = reactionFor(kind, `${i}-0-feedback`, level, last)
          if (last) expect(name).not.toBe(last)
          last = name
        }
      }
  })

  it("plays a character's nearest set for a kind it has none of", () => {
    // Casual has no earned or reveal moves of its own: happy and sad stand in.
    const earned = reactionFor("earned", "k", "casual").name
    expect(Object.keys(REACTIONS.casual.happy)).toContain(earned)
    const reveal = reactionFor("reveal", "k", "casual").name
    expect(Object.keys(REACTIONS.casual.sad)).toContain(reveal)
    expect(reactionFor("rewind", "k", "unhinged").beats).toEqual([
      ["rewind", 750],
    ])
  })
})
