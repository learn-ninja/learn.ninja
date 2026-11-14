import { describe, expect, it } from "vitest"

import { packFor } from "@workspace/player-core/language"
import type { NinjaLevel } from "@workspace/player-core/strings"
import voiceClips from "@workspace/player-core/voice-clips.json"
import {
  CADENCE,
  characterFor,
  createLinePicker,
  NINJA_VOICE,
  voiceLines,
  type Moment,
} from "@workspace/player-core/voices"

import { speaks, upcomingVoice, voiceUrl } from "./voice"

const BASE = "https://learn.ninja"
const LEVELS: NinjaLevel[] = ["off", "sensei", "casual", "unhinged"]
const MOMENTS = Object.keys(packFor("en").voices.sensei) as Moment[]
const clips = (voiceClips as { clips: { en: Record<string, string> } }).clips.en

describe("the ninja's voice", () => {
  it("has a clip for every English line the app can say", () => {
    // The app says voiceLines for every character (Off says Casual's) at every moment.
    const missing = LEVELS.flatMap((level) =>
      MOMENTS.flatMap((moment) => {
        const { plain, flavor } = voiceLines("en", level, moment)
        return [...plain, ...flavor].filter((line) => !clips[line])
      })
    )
    expect(missing).toEqual([])
  })

  it("streams each line from the web app's /voice/en/", () => {
    const line = voiceLines("en", "sensei", "praise").plain[0]!
    expect(voiceUrl(BASE, "en", line)).toBe(
      `${BASE}/voice/en/${clips[line]}.mp3`
    )
    expect(voiceUrl(BASE, "en-GB", line)).toBe(
      `${BASE}/voice/en/${clips[line]}.mp3`
    )
  })

  it("stays quiet where he has no voice", () => {
    expect(voiceUrl(BASE, "en", null)).toBeNull()
    expect(voiceUrl(BASE, "en", "Not one of his lines.")).toBeNull()
    const line = voiceLines("de", "sensei", "praise").plain[0]!
    expect(voiceUrl(BASE, "de", line)).toBeNull()
  })

  it("loads one clip per moment ahead, the ones the picker will say next", () => {
    const pick = createLinePicker("Lesson:0")
    const ahead = upcomingVoice(BASE, "en", "sensei", pick)
    expect(ahead).toHaveLength(MOMENTS.length)
    // Saying the praise line uses up the one loaded for it.
    const said = pick(
      "0-1-feedback-praise-sensei",
      "praise",
      voiceLines("en", "sensei", "praise"),
      CADENCE[characterFor("sensei")]
    )
    expect(ahead).toContain(voiceUrl(BASE, "en", said))
  })

  it("speaks only when he's on, unmuted, and in a language he speaks", () => {
    expect(speaks("sensei", true, "en", true)).toBe(true)
    expect(speaks("off", true, "en", true)).toBe(false)
    expect(speaks("casual", false, "en", true)).toBe(false)
    expect(speaks("casual", true, "de", true)).toBe(false)
  })

  it("stays quiet while his voice is off", () => {
    expect(speaks("sensei", true, "en", false)).toBe(false)
    expect(speaks("sensei", true, "en")).toBe(NINJA_VOICE)
  })
})

describe("the line picker", () => {
  const lines = voiceLines("en", "sensei", "praise")
  const cadence = CADENCE.sensei

  it("says the same line for the same feedback, so a re-render agrees", () => {
    const pick = createLinePicker("Lesson:0")
    const first = pick("2-1-feedback-praise-sensei", "praise", lines, cadence)
    expect(pick("2-1-feedback-praise-sensei", "praise", lines, cadence)).toBe(
      first
    )
  })

  it("deals the same run for the same seed, and another for a replay", () => {
    const run = (seed: string) => {
      const pick = createLinePicker(seed)
      return Array.from({ length: 6 }, (_, i) =>
        pick(`${i}-1-feedback-praise-sensei`, "praise", lines, cadence)
      )
    }
    expect(run("Lesson:0")).toEqual(run("Lesson:0"))
    expect(run("Lesson:0")).not.toEqual(run("Lesson:1"))
  })

  it("starts with a flavor line and takes turns with the plain ones", () => {
    const pick = createLinePicker("Lesson:0")
    const said = Array.from({ length: 4 }, (_, i) =>
      pick(`${i}-1-feedback-praise-sensei`, "praise", lines, cadence)
    )
    expect(lines.flavor).toContain(said[0])
    expect(lines.plain).toContain(said[1])
    expect(lines.flavor).toContain(said[2])
    expect(lines.plain).toContain(said[3])
  })

  it("says every line of a slot once before any repeats", () => {
    const pick = createLinePicker("Lesson:0")
    const n = lines.plain.length
    // Every other praise is plain: 2n praises say each plain line once.
    const plain = Array.from({ length: 2 * n }, (_, i) =>
      pick(`${i}-1-feedback-praise-sensei`, "praise", lines, cadence)
    ).filter((_, i) => i % 2 === 1)
    expect(new Set(plain).size).toBe(n)
  })

  it("peeks at the next line without using it up", () => {
    const pick = createLinePicker("Lesson:0")
    const next = pick.peek("praise", lines, cadence)
    expect(pick.peek("praise", lines, cadence)).toBe(next)
    expect(pick("0-1-feedback-praise-sensei", "praise", lines, cadence)).toBe(
      next
    )
  })
})
