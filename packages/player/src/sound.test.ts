import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

// Safari pauses Web Audio when the tab or window goes to the background, and can leave a context
// "running" with a stopped clock after the output changes. These fakes stand in for both.

type Fake = {
  state: string
  currentTime: number
  started: number
  resume: () => Promise<void>
  close: () => Promise<void>
}

let contexts: Fake[]
let resumes: "run" | "hang"
let listeners: Map<string, () => void>

function fakeContext(): Fake {
  const ctx: Fake = {
    state: "running",
    currentTime: 0,
    started: 0,
    resume: () =>
      resumes === "run"
        ? Promise.resolve().then(() => {
            ctx.state = "running"
          })
        : new Promise(() => {}),
    close: () => Promise.resolve(),
  }
  Object.assign(ctx, {
    destination: {},
    createBufferSource: () => ({
      connect() {},
      start() {
        ctx.started++
      },
      stop() {},
    }),
  })
  contexts.push(ctx)
  return ctx
}

const buffer = {
  sampleRate: 48000,
  getChannelData: () => new Float32Array([0, 0.5]),
}

async function setup() {
  vi.resetModules()
  const sound = await import("./sound")
  sound.preloadSounds(["/clip.mp3"])
  press()
  await vi.advanceTimersByTimeAsync(0)
  return sound
}

function press() {
  listeners.get("pointerdown")?.()
}

beforeEach(() => {
  vi.useFakeTimers()
  contexts = []
  resumes = "run"
  listeners = new Map()
  const on = (type: string, fn: () => void) => listeners.set(type, fn)
  vi.stubGlobal("window", {
    AudioContext: fakeContext,
    OfflineAudioContext: function () {
      return { decodeAudioData: () => Promise.resolve(buffer) }
    },
    addEventListener: on,
  })
  vi.stubGlobal("AudioContext", function () {
    return fakeContext()
  })
  vi.stubGlobal("OfflineAudioContext", function () {
    return { decodeAudioData: () => Promise.resolve(buffer) }
  })
  vi.stubGlobal("document", { hidden: false, addEventListener: on })
  vi.stubGlobal("navigator", {})
  vi.stubGlobal("fetch", () =>
    Promise.resolve({ ok: true, arrayBuffer: () => new ArrayBuffer(8) })
  )
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe("playSound", () => {
  it("plays on a running context", async () => {
    const { playSound } = await setup()
    playSound("/clip.mp3")
    await vi.advanceTimersByTimeAsync(0)
    expect(contexts[0]!.started).toBe(1)
  })

  it("resumes paused audio before starting the clip", async () => {
    const { playSound } = await setup()
    const ctx = contexts[0]!
    ctx.state = "suspended"
    playSound("/clip.mp3")
    await vi.advanceTimersByTimeAsync(0)
    expect(ctx.state).toBe("running")
    expect(ctx.started).toBe(1)
  })

  it("drops a clip when the audio doesn't come back in time", async () => {
    const { playSound } = await setup()
    const ctx = contexts[0]!
    ctx.state = "interrupted"
    resumes = "hang"
    playSound("/clip.mp3")
    await vi.advanceTimersByTimeAsync(1000)
    expect(ctx.started).toBe(0)
  })

  it("resumes paused audio when the page comes back", async () => {
    await setup()
    const ctx = contexts[0]!
    ctx.state = "suspended"
    listeners.get("visibilitychange")?.()
    await vi.advanceTimersByTimeAsync(0)
    expect(ctx.state).toBe("running")
  })

  it("replaces a running context whose clock has stopped", async () => {
    const { playSound } = await setup()
    await vi.advanceTimersByTimeAsync(1000)
    press()
    expect(contexts).toHaveLength(2)
    playSound("/clip.mp3")
    await vi.advanceTimersByTimeAsync(0)
    expect(contexts[0]!.started).toBe(0)
    expect(contexts[1]!.started).toBe(1)
  })

  it("keeps a context whose clock moves", async () => {
    await setup()
    contexts[0]!.currentTime = 1
    await vi.advanceTimersByTimeAsync(1000)
    press()
    expect(contexts).toHaveLength(1)
  })
})
