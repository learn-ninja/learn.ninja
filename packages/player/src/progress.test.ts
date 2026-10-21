import { readFileSync } from "node:fs"

import { describe, expect, it } from "vitest"

import type { Lesson } from "@workspace/spec"

import { buildSequence } from "./flow"
import { reducer, type State } from "./lesson-player"
import {
  fingerprint,
  loadProgress,
  resumeScript,
  savedProgress,
  saveProgress,
} from "./progress"

// Progress saved in the browser: a reload lands on the same screen, a changed lesson starts over.

const lesson = JSON.parse(
  readFileSync(
    new URL("../../../examples/compound-interest.json", import.meta.url),
    "utf8"
  )
) as Lesson

/** The minimal Storage the helpers use. */
function fakeStorage(): Storage {
  const map = new Map<string, string>()
  return {
    get length() {
      return map.size
    },
    key: (i) => [...map.keys()][i] ?? null,
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
    clear: () => map.clear(),
  }
}

function fresh(): State {
  return reducer(
    {
      items: [],
      index: 0,
      results: {},
      mistakes: [],
      fixed: [],
      inFix: false,
      fixQueued: false,
      question: null,
      run: 0,
    },
    { type: "restart", lesson }
  )
}

function midway(): State {
  let state = fresh()
  state = reducer(state, { type: "next" })
  state = reducer(state, { type: "next" })
  return state
}

describe("saved progress", () => {
  it("comes back for the same lesson", () => {
    const storage = fakeStorage()
    const state = midway()
    saveProgress(storage, "l/x", lesson, state)
    expect(loadProgress(storage, "l/x", lesson)).toEqual(state)
  })

  it("keeps lessons apart by key", () => {
    const storage = fakeStorage()
    saveProgress(storage, "l/x", lesson, midway())
    expect(loadProgress(storage, "l/y", lesson)).toBeNull()
  })

  it("starts over when the lesson's content changed", () => {
    const storage = fakeStorage()
    saveProgress(storage, "l/x", lesson, midway())
    const edited: Lesson = {
      ...lesson,
      challenge: { ...lesson.challenge, prompt: "Something else?" },
    }
    expect(fingerprint(edited)).not.toBe(fingerprint(lesson))
    expect(loadProgress(storage, "l/x", edited)).toBeNull()
  })

  it("ignores a rename: the title isn't part of the fingerprint", () => {
    expect(fingerprint({ ...lesson, title: "Renamed" })).toBe(
      fingerprint(lesson)
    )
  })

  it("forgets the lesson on the intro and at the wrap-up", () => {
    const storage = fakeStorage()
    saveProgress(storage, "l/x", lesson, midway())
    expect(storage.length).toBe(1)
    saveProgress(storage, "l/x", lesson, fresh())
    expect(storage.length).toBe(0)
    saveProgress(storage, "l/x", lesson, midway())
    let state = midway()
    while (state.items[state.index]?.kind !== "wrap")
      state = reducer(state, { type: "next" })
    saveProgress(storage, "l/x", lesson, state)
    expect(storage.length).toBe(0)
  })

  it("drops entries older than a week and ones it can't read", () => {
    const storage = fakeStorage()
    saveProgress(storage, "l/old", lesson, midway())
    const old = JSON.parse(storage.getItem("learn:progress:l/old")!)
    old.savedAt = Date.now() - 8 * 24 * 3.6e6
    storage.setItem("learn:progress:l/old", JSON.stringify(old))
    storage.setItem("learn:progress:l/junk", "{")
    storage.setItem("learn:preferences", "{}")
    expect(loadProgress(storage, "l/other", lesson)).toBeNull()
    expect(storage.getItem("learn:progress:l/old")).toBeNull()
    expect(storage.getItem("learn:progress:l/junk")).toBeNull()
    expect(storage.getItem("learn:preferences")).toBe("{}")
  })

  it("rejects a saved state that doesn't fit", () => {
    const storage = fakeStorage()
    storage.setItem(
      "learn:progress:l/x",
      JSON.stringify({
        v: 1,
        fingerprint: fingerprint(lesson),
        savedAt: Date.now(),
        state: { items: [], index: 3 },
      })
    )
    expect(loadProgress(storage, "l/x", lesson)).toBeNull()
  })
})

describe("progress for the feed", () => {
  const total = lesson.bricks.length + 2

  it("counts the bricks behind the learner", () => {
    const storage = fakeStorage()
    const state = { ...fresh(), items: buildSequence(lesson), index: 3 }
    saveProgress(storage, "l/x", lesson, state)
    expect(savedProgress(storage, "l/x")).toEqual({ done: 2, total })
  })

  it("leaves fix-round retries out", () => {
    const storage = fakeStorage()
    const items = buildSequence(lesson)
    const fixAt = items.findIndex((i) => i.kind === "fix")
    items.splice(fixAt, 0, {
      kind: "question",
      brick: lesson.hook,
      role: "fix",
    })
    saveProgress(storage, "l/x", lesson, { ...fresh(), items, index: fixAt })
    expect(savedProgress(storage, "l/x")).toEqual({ done: total, total })
  })

  it("is null with nothing saved, or saved over a week ago", () => {
    const storage = fakeStorage()
    expect(savedProgress(storage, "l/x")).toBeNull()
    storage.setItem(
      "learn:progress:l/x",
      JSON.stringify({
        v: 1,
        fingerprint: fingerprint(lesson),
        savedAt: Date.now() - 8 * 24 * 3.6e6,
        state: { ...fresh(), items: buildSequence(lesson), index: 3 },
      })
    )
    expect(savedProgress(storage, "l/x")).toBeNull()
  })
})

describe("resume script", () => {
  /** Runs the script as the browser would, with a stub page and storage; returns the root's mark. */
  function run(storage: Storage, key = "l/a-1", content = lesson) {
    const attrs = new Map<string, string>()
    const document = {
      currentScript: {
        parentNode: { setAttribute: (k: string, v: string) => attrs.set(k, v) },
      },
    }
    new Function("localStorage", "document", resumeScript(key, content))(
      storage,
      document
    )
    return attrs.has("data-resuming")
  }

  it("marks the player when there's progress for this lesson", () => {
    const storage = fakeStorage()
    saveProgress(storage, "l/a-1", lesson, midway())
    expect(run(storage)).toBe(true)
    expect(run(storage, "l/b-2")).toBe(false)
    const edited: Lesson = {
      ...lesson,
      challenge: { ...lesson.challenge, prompt: "Something else?" },
    }
    expect(run(storage, "l/a-1", edited)).toBe(false)
  })

  it("leaves it alone on a fresh visit, or when storage fails", () => {
    expect(run(fakeStorage())).toBe(false)
    const broken = fakeStorage()
    broken.getItem = () => {
      throw new Error("blocked")
    }
    expect(run(broken)).toBe(false)
    const junk = fakeStorage()
    junk.setItem("learn:progress:l/a-1", "{nope")
    expect(run(junk)).toBe(false)
  })

  it("can't break out of its script tag", () => {
    expect(resumeScript("l/</script>", lesson)).not.toContain("</")
  })
})
