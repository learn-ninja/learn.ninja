import type { NinjaLevel } from "@workspace/player-core/strings"
import {
  clipFor,
  hasVoice,
  NINJA_VOICE,
  nextClips,
  type LinePicker,
} from "@workspace/player-core/voices"

// Where the ninja's spoken lines come from: the web app serves each clip at /voice/{language}/
// {clip}.mp3 (voice-clips.json, written by `npm run voice -w @workspace/player`), and the app
// streams them from the same server it loads lessons from. Pure, so the tests check it.

/** The URL of a line's clip, or null for a line he doesn't speak (another language, an unvoiced line). */
export function voiceUrl(
  base: string,
  lang: string,
  line: string | null
): string | null {
  if (!line) return null
  const path = clipFor(lang, line)
  return path ? `${base}${path}` : null
}

/** The clips of the lines he'd say next, one per moment, to load before the learner answers. */
export function upcomingVoice(
  base: string,
  lang: string,
  level: NinjaLevel,
  pick: LinePicker
): string[] {
  return nextClips(lang, level, pick).map((path) => `${base}${path}`)
}

/**
 * Whether he speaks: his voice is on at all (NINJA_VOICE, off for now), he's on, the learner hasn't
 * muted the player, and he has a voice in the lesson's language (only English so far).
 */
export function speaks(
  level: NinjaLevel,
  soundOn: boolean,
  lang: string,
  voice: boolean = NINJA_VOICE
) {
  return voice && level !== "off" && soundOn && hasVoice(lang)
}
