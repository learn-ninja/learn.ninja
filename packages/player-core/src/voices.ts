// The ninja's feedback lines for each character: one Japanese sensei in three moods. Sensei is the
// dojo teacher of few words, patient and a little firm, who would rather show than explain; Casual
// (whose lines Off shares) is the same teacher off duty, warm and light; Unhinged is a frantic ninja,
// sure everything is about to go wrong and hugely relieved when it doesn't. On a miss he panics at
// the situation, never at the learner.
//
// Each moment has plain lines and flavor lines, which take turns (CADENCE), so the feedback keeps
// varying while the plain ones keep it grounded. Nothing repeats within a run (see
// createLinePicker). Every line ends in a period, exclamation point, or question mark.
//
// Each language's lines live in ./locales/voices, written in that language's own idiom for the
// character rather than translated from English (en.ts): Unhinged's slang especially is the
// language's own, never a rendering of the English.

import { shuffle } from "./check"
import { packFor } from "./language"
import { seeded } from "./random"
import type { NinjaLevel } from "./strings"
import { uiLanguageFor, type UiLanguage } from "./ui-languages"
import voiceClips from "./voice-clips.json"

/** A point in a lesson where the ninja says something. */
export type Moment =
  | "praise"
  | "correctWithHint"
  | "goodGuess"
  | "hookMiss"
  | "nudge"
  | "close"
  | "answer"
  // Earned: a correct answer at a moment worth more than praise.
  | "streak"
  | "comeback"
  | "last"

/** A moment's lines: the plain ones, said most of the time, and the flavor ones, rationed. */
export type Lines = { plain: string[]; flavor: string[] }
export type Voice = Record<Moment, Lines>
export type Character = Exclude<NinjaLevel, "off">
/** One language's lines: every character, every moment. */
export type Voices = Record<Character, Voice>

export type Slot = keyof Lines
/**
 * Which slot each character draws from the nth time a moment comes up in a run. Every character
 * alternates, flavor first, so the first thing a learner hears has some character and the lines
 * keep changing.
 */
export const CADENCE: Record<Character, readonly Slot[]> = {
  casual: ["flavor", "plain"],
  sensei: ["flavor", "plain"],
  unhinged: ["flavor", "plain"],
}

/** The character a setting plays: Off shows nobody, but his lines are the Casual ones. */
export function characterFor(level: NinjaLevel): Character {
  return level === "off" ? "casual" : level
}

/** The character's lines for a moment, in the player's language (English for one it doesn't have, or hasn't loaded). */
export function voiceLines(
  lang: string,
  level: NinjaLevel,
  moment: Moment
): Lines {
  return packFor(lang).voices[characterFor(level)][moment]
}

/**
 * The ninja's spoken lines: for each language that has them (only English so far), each line's
 * clip, an mp3 at /voice/{language}/{clip}.mp3. Written by `npm run voice -w @workspace/player`.
 */
export type VoiceClips = {
  voice: string
  model: string
  clips: Partial<Record<UiLanguage, Record<string, string>>>
}

const CLIPS = (voiceClips as VoiceClips).clips

/** Whether the ninja speaks in the player's language. */
export function hasVoice(lang: string): boolean {
  return Boolean(CLIPS[uiLanguageFor(lang)?.code ?? "en"])
}

/** The URL of a line's clip in the player's language, or null for a line he doesn't speak. */
export function clipFor(lang: string, line: string): string | null {
  const code = uiLanguageFor(lang)?.code ?? "en"
  const clip = CLIPS[code]?.[line]
  return clip ? `/voice/${code}/${clip}.mp3` : null
}

/** The clips of the lines he'd say next, one per moment, to load before the learner answers. */
export function nextClips(
  lang: string,
  level: NinjaLevel,
  pick: LinePicker
): string[] {
  const voice = packFor(lang).voices[characterFor(level)]
  const cadence = CADENCE[characterFor(level)]
  return (Object.keys(voice) as Moment[]).flatMap((moment) => {
    const clip = clipFor(lang, pick.peek(moment, voice[moment], cadence))
    return clip ? [clip] : []
  })
}

/**
 * Picks a line for one piece of feedback. The nth time a moment comes up in the run, the cadence
 * says whether it gets a plain or a flavor line; within each, a shuffle bag plays every line once
 * before any repeats, and a new round never starts with the line that ended the last one. Seeded,
 * so a server render and the browser agree. `key` names one piece of feedback; asking again with
 * the same key returns the same line.
 */
export type LinePicker = {
  (key: string, moment: Moment, lines: Lines, cadence: readonly Slot[]): string
  /** The line a moment's next piece of feedback will get, without using it up. */
  peek(moment: Moment, lines: Lines, cadence: readonly Slot[]): string
}

export function createLinePicker(seed: string): LinePicker {
  const bags = new Map<string, { order: number[]; at: number; round: number }>()
  const picked = new Map<string, string>()
  const said = new Map<Moment, number>()
  // The lines a moment draws from the next time it comes up.
  const poolFor = (moment: Moment, lines: Lines, cadence: readonly Slot[]) => {
    const slot = cadence[(said.get(moment) ?? 0) % cadence.length] ?? "plain"
    const other: Slot = slot === "plain" ? "flavor" : "plain"
    return lines[slot].length ? lines[slot] : lines[other]
  }
  const pick = (
    key: string,
    moment: Moment,
    lines: Lines,
    cadence: readonly Slot[]
  ) => {
    const known = picked.get(key)
    if (known !== undefined) return known
    const line = draw(poolFor(moment, lines, cadence), true)
    said.set(moment, (said.get(moment) ?? 0) + 1)
    picked.set(key, line)
    return line
  }
  const peek = (moment: Moment, lines: Lines, cadence: readonly Slot[]) =>
    draw(poolFor(moment, lines, cadence), false)
  return Object.assign(pick, { peek })

  // The next line in the pool's shuffle bag; `take` moves past it. A new round's order depends only
  // on the seed and the last round, so peeking may deal it early.
  function draw(lines: string[], take: boolean): string {
    if (lines.length < 2) return lines[0] ?? ""
    const id = lines.join("\n")
    let bag = bags.get(id)
    if (!bag || bag.at >= bag.order.length) {
      const round = bag ? bag.round + 1 : 0
      const order = shuffle(
        lines.map((_, i) => i),
        seeded(`${seed}:${id}:${round}`)
      )
      const last = bag?.order[bag.order.length - 1]
      if (order[0] === last) order.push(order.shift()!)
      bag = { order, at: 0, round }
      bags.set(id, bag)
    }
    return lines[bag.order[take ? bag.at++ : bag.at]!]!
  }
}
