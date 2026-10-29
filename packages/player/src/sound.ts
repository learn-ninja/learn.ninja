// The player's sounds (the ninja's lines, the whoosh as the intro vanishes) through Web Audio, so
// they start with what happens on screen. An <audio> element waits on the network when it's asked
// to play and, in Safari, takes a beat more to start; here each clip is fetched and decoded ahead
// of time and started from its first sound.

/** Loud enough to count as the clip starting (about -50 dB). */
const THRESHOLD = 0.003
/** Kept before the first sound, so a soft consonant isn't cut. */
const PREROLL = 0.01
const GESTURES = ["pointerdown", "pointerup", "keydown", "keyup", "touchend"]
/** How long a sound waits for paused audio to come back before it's dropped (ms): any later and it comes late. */
const LATE = 400
/** A running context whose clock hasn't moved in this long (ms) has gone quiet. */
const STALL = 250

type Clip = { buffer: AudioBuffer; start: number }

let context: AudioContext | null = null
let decoder: OfflineAudioContext | null = null
let listening = false
/** The context's clock when last woken, to tell a stuck one. */
let clock = { at: 0, time: 0 }
const clips = new Map<string, Promise<Clip | null>>()

const supported = () =>
  typeof window !== "undefined" &&
  "AudioContext" in window &&
  "OfflineAudioContext" in window

/**
 * Waits for the learner to press or type something: browsers only let audio play after that, and
 * creating the context sooner logs a warning. Every press resumes it, since Safari suspends it when
 * the tab or window goes to the background, and so does coming back to the page.
 */
function listen() {
  if (listening) return
  listening = true
  for (const type of GESTURES)
    window.addEventListener(type, wake, { capture: true, passive: true })
  document.addEventListener("visibilitychange", revive)
  window.addEventListener("focus", revive)
  window.addEventListener("pageshow", revive)
}

/** Resumes paused audio when the page is back. Without a press the browser may refuse; the next press tries again. */
function revive() {
  if (context && context.state !== "running" && !document.hidden)
    context.resume().catch(() => {})
}

/**
 * Safari can leave a context "running" with its clock stopped after the audio output changes (a
 * second screen, headphones), and then nothing it plays is heard. A press replaces such a context.
 */
function stuck(ctx: AudioContext) {
  const now = performance.now()
  const frozen =
    ctx.state === "running" &&
    ctx.currentTime === clock.time &&
    now - clock.at > STALL
  clock = { at: now, time: ctx.currentTime }
  return frozen
}

function wake() {
  if (context && (context.state === "closed" || stuck(context))) {
    context.close().catch(() => {})
    context = null
  }
  if (!context) {
    // On iPhones Web Audio otherwise goes quiet with the silent switch, which <audio> didn't.
    const session = (navigator as { audioSession?: { type: string } })
      .audioSession
    if (session) session.type = "playback"
    context = new AudioContext()
    clock = { at: performance.now(), time: 0 }
  }
  if (context.state !== "running") context.resume().catch(() => {})
}

/**
 * Whether the context is running, resuming it first if it was paused. Safari's resume can hang
 * until the audio comes back, so it gets LATE to do it.
 */
function running(ctx: AudioContext): Promise<boolean> {
  if (ctx.state === "running") return Promise.resolve(true)
  return Promise.race([
    ctx.resume().then(
      () => ctx.state === "running",
      () => false
    ),
    new Promise<boolean>((done) => setTimeout(() => done(false), LATE)),
  ])
}

function load(url: string): Promise<Clip | null> {
  let pending = clips.get(url)
  if (!pending) {
    // An offline context decodes without waiting for a press, so the clip is ready before it's wanted.
    const offline = (decoder ??= new OfflineAudioContext(1, 1, 48000))
    pending = fetch(url)
      .then((res) => (res.ok ? res.arrayBuffer() : Promise.reject()))
      .then((data) => offline.decodeAudioData(data))
      .then((buffer) => ({ buffer, start: firstSound(buffer) }))
      .catch(() => null)
    // A clip that failed to load is tried again next time.
    void pending.then((clip) => {
      if (!clip) clips.delete(url)
    })
    clips.set(url, pending)
  }
  return pending
}

/** Where a clip's first sound is, in seconds, less a little room before it. */
function firstSound(buffer: AudioBuffer): number {
  const samples = buffer.getChannelData(0)
  const at = samples.findIndex((s) => Math.abs(s) > THRESHOLD)
  return at < 0 ? 0 : Math.max(0, at / buffer.sampleRate - PREROLL)
}

/** Fetches and decodes clips, so they start the moment they're played. */
export function preloadSounds(urls: readonly string[]) {
  if (!supported()) return
  listen()
  for (const url of urls) void load(url)
}

/**
 * Plays a clip from its first sound. One not loaded yet starts as soon as it is, unless the returned
 * function stops it first. Before the learner's first press it stays quiet: the browser wouldn't
 * play it, and it shouldn't come late. Paused audio is resumed first, and the clip starts once it
 * runs, rather than being scheduled on a clock that isn't moving.
 */
export function playSound(url: string): () => void {
  if (!supported()) return () => {}
  listen()
  // Asked during the press that wakes the context, before its listeners heard it.
  if (navigator.userActivation?.isActive) wake()
  let stopped = false
  let source: AudioBufferSourceNode | null = null
  void load(url).then(async (clip) => {
    const ctx = context
    if (!clip || stopped || !ctx || !(await running(ctx))) return
    if (stopped || ctx !== context) return
    source = ctx.createBufferSource()
    source.buffer = clip.buffer
    source.connect(ctx.destination)
    source.start(0, clip.start)
  })
  return () => {
    stopped = true
    source?.stop()
  }
}
