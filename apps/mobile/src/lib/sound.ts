import {
  createAudioPlayer,
  setAudioModeAsync,
  type AudioPlayer,
} from "expo-audio"

// The player's sounds, after the web's (packages/player/src/sound.ts): the ninja's lines, streamed
// from the web app's /voice/en/ and loaded ahead so each starts with the feedback, and the sound
// effects (the whoosh as the intro vanishes, the streak's lantern lighting and its flame burning),
// bundled with the app so they start at once and play offline. Everything follows the learner's
// Sound setting (the callers check it), and the system's: the session is iOS's ambient one, so the
// silent switch mutes the app and music from another app keeps playing under it, as a learning
// app's taps and voice should.

/** The effects, from the web's apps/web/public/sfx (lantern and flame revived from its parked streak sounds). */
export const SFX = {
  /** The wind as the intro vanishes. */
  vanish: require("../../assets/sfx/vanish.mp3") as number,
  /** The streak's lantern lighting: a soft puff as the wick catches, a crackle, a warm glow. */
  lantern: require("../../assets/sfx/lantern.mp3") as number,
  /** Its flame burning, a 4 s seamless loop, quieter than the lighting. */
  flame: require("../../assets/sfx/flame.mp3") as number,
} as const

export type Effect = keyof typeof SFX

/** A sound that was started: `stop` fades it out over `fade` ms (or cuts it, or cancels it before it starts). */
export interface Sound {
  stop: (fade?: number) => void
}

/** How many players are kept loaded: the next moment's lines and the effects, with room to spare. */
const KEEP = 24

let audioMode: Promise<void> | null = null

/** The ambient session: mixes with other apps' audio and goes quiet with the silent switch. */
function ambient(): Promise<void> {
  return (audioMode ??= setAudioModeAsync({
    playsInSilentMode: false,
    interruptionMode: "mixWithOthers",
    shouldPlayInBackground: false,
  }).catch(() => {
    audioMode = null
  }))
}

/** Loaded players by source, oldest first; the oldest is let go past KEEP. */
const players = new Map<string | number, AudioPlayer>()

function playerFor(source: string | number): AudioPlayer | null {
  const known = players.get(source)
  if (known) {
    players.delete(source)
    players.set(source, known)
    return known
  }
  try {
    const player = createAudioPlayer(source, { updateInterval: 1000 })
    players.set(source, player)
    for (const [old, p] of players) {
      if (players.size <= KEEP) break
      players.delete(old)
      p.remove()
    }
    return player
  } catch {
    // No audio on this device: he just doesn't speak.
    return null
  }
}

/** Loads clips by URL (the ninja's next lines), so they start the moment they're played. */
export function preloadSounds(urls: readonly string[]) {
  void ambient()
  for (const url of urls) playerFor(url)
}

/** Loads the effects, for a screen that's about to need them. */
export function preloadEffects(effects: readonly Effect[]) {
  void ambient()
  for (const effect of effects) playerFor(SFX[effect])
}

function start(
  source: string | number,
  { loop = false, volume = 1 }: { loop?: boolean; volume?: number } = {}
): Sound {
  let stopped = false
  let fading: ReturnType<typeof setInterval> | undefined
  const player = playerFor(source)
  void ambient().then(async () => {
    if (!player || stopped) return
    player.loop = loop
    player.volume = volume
    // A clip played before starts again from its beginning.
    if (player.currentTime > 0) await player.seekTo(0).catch(() => {})
    if (!stopped) player.play()
  })
  return {
    stop(fade = 0) {
      if (stopped || !player) return
      stopped = true
      if (fade <= 0) {
        player.pause()
        return
      }
      // Down in steps, then paused, so a loop ends softly instead of being cut.
      const steps = 10
      let step = 0
      const from = player.volume
      fading = setInterval(() => {
        step++
        player.volume = from * (1 - step / steps)
        if (step >= steps) {
          clearInterval(fading)
          player.pause()
          player.volume = volume
        }
      }, fade / steps)
    },
  }
}

/** Plays a clip by URL (one of the ninja's lines) from its start; the returned function stops it. */
export function playSound(url: string): () => void {
  const sound = start(url)
  return () => sound.stop()
}

/** Plays an effect, looping it if asked (the flame); stop it with the returned Sound. */
export function playEffect(
  effect: Effect,
  options?: { loop?: boolean; volume?: number }
): Sound {
  return start(SFX[effect], options)
}
