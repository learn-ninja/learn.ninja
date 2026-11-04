import { readFileSync } from "node:fs"

import { afterEach, describe, expect, it, vi } from "vitest"

import type { Lesson } from "@workspace/spec"

import { buildSequence } from "@workspace/player-core/flow"
import { reducer, type State } from "./lesson-player"
import {
  browserStorage,
  fingerprint,
  loadProgress,
  resumeScript,
  savedProgress,
  saveProgress,
} from "./progress"
import { UI_TRANSLATIONS } from "@workspace/player-core/strings"

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

describe("what a save keeps", () => {
  it("names katas by id instead of copying the lesson", () => {
    const storage = fakeStorage()
    saveProgress(storage, "l/x", lesson, midway())
    const raw = storage.getItem("learn:progress:l/x")!
    expect(raw).not.toContain(JSON.stringify(lesson.hook.prompt))
    expect(raw).not.toContain(JSON.stringify(lesson.challenge.explanation))
    expect(raw.length).toBeLessThan(JSON.stringify(midway()).length / 4)
  })

  it("brings the fix round back with its questions", () => {
    let state = midway()
    const fixAt = state.items.findIndex((i) => i.kind === "fix")
    state = { ...state, index: fixAt, mistakes: [lesson.challenge] }
    state = reducer(state, { type: "startFix" })
    expect(state.items[state.index]).toMatchObject({ role: "fix" })
    const storage = fakeStorage()
    saveProgress(storage, "l/x", lesson, state)
    expect(loadProgress(storage, "l/x", lesson)).toEqual(state)
  })

  it("still loads what the previous version saved: the whole state", () => {
    const storage = fakeStorage()
    const state = midway()
    storage.setItem(
      "learn:progress:l/x",
      JSON.stringify({
        v: 1,
        fingerprint: fingerprint(lesson),
        savedAt: Date.now(),
        state,
      })
    )
    expect(loadProgress(storage, "l/x", lesson)).toEqual(state)
    expect(savedProgress(storage, "l/x")).toEqual({
      done: 1,
      total: lesson.katas.length + 2,
    })
  })

  it("fills a question's missing fields with defaults, and starts it over when it doesn't fit", () => {
    const storage = fakeStorage()
    // On the warm-up question.
    const state = reducer(fresh(), { type: "next" })
    expect(state.question).not.toBeNull()
    saveProgress(storage, "l/x", lesson, state)
    const saved = JSON.parse(storage.getItem("learn:progress:l/x")!)
    const question = saved.state.question
    delete question.tried
    storage.setItem("learn:progress:l/x", JSON.stringify(saved))
    expect(loadProgress(storage, "l/x", lesson)?.question).toEqual({
      ...state.question,
      tried: [],
    })

    question.answer = { kind: "nonsense" }
    storage.setItem("learn:progress:l/x", JSON.stringify(saved))
    expect(loadProgress(storage, "l/x", lesson)?.question).toMatchObject({
      answer: state.question!.answer,
      attempts: 0,
    })
  })

  it("starts over when it names a question the lesson doesn't have", () => {
    const storage = fakeStorage()
    saveProgress(storage, "l/x", lesson, midway())
    const saved = JSON.parse(storage.getItem("learn:progress:l/x")!)
    saved.state.mistakes = ["gone"]
    storage.setItem("learn:progress:l/x", JSON.stringify(saved))
    expect(loadProgress(storage, "l/x", lesson)).toBeNull()
  })
})

describe("browser storage", () => {
  afterEach(() => vi.unstubAllGlobals())

  it("is null where reading it throws, so the lesson plays without it", () => {
    vi.stubGlobal("window", {
      get localStorage(): Storage {
        throw new DOMException("blocked", "SecurityError")
      },
    })
    expect(browserStorage()).toBeNull()
  })

  it("is the page's storage otherwise", () => {
    const storage = fakeStorage()
    vi.stubGlobal("window", { localStorage: storage })
    expect(browserStorage()).toBe(storage)
  })
})

describe("progress for the feed", () => {
  const total = lesson.katas.length + 2

  it("counts the katas behind the learner", () => {
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
      kata: lesson.hook,
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
  function run(
    storage: Storage,
    key: string | null = "l/a-1",
    content = lesson,
    { lang = "en", search = "" } = {}
  ) {
    const attrs = new Map<string, string>([["lang", lang]])
    const document = {
      currentScript: {
        parentNode: {
          getAttribute: (k: string) => attrs.get(k) ?? null,
          setAttribute: (k: string, v: string) => attrs.set(k, v),
        },
      },
    }
    new Function(
      "localStorage",
      "document",
      "location",
      resumeScript(key, content)
    )(storage, document, { search })
    return attrs.has("data-resuming")
  }

  it("hides the player while saved preferences would change what the server drew", () => {
    const storage = fakeStorage()
    const prefs = (p: object) =>
      storage.setItem("learn:preferences", JSON.stringify(p))
    // A saved language counts only while the player offers its translations.
    prefs({ uiLanguage: "ar" })
    expect(run(storage, null)).toBe(UI_TRANSLATIONS)
    expect(run(storage, null, lesson, { lang: "ar" })).toBe(false)
    prefs({ textSize: "lg" })
    expect(run(storage, null)).toBe(true)
    prefs({ tray: "closed" })
    expect(run(storage, null)).toBe(true)
    prefs({ ninja: "unhinged" })
    expect(run(storage, null)).toBe(true)
    prefs({ ninja: "off" })
    expect(run(storage, null)).toBe(true)
    prefs({ uiLanguage: "en", textSize: "md", ninja: "sensei" })
    expect(run(storage, null)).toBe(false)
    // The Sensei's old name.
    prefs({ ninja: "caffeinated" })
    expect(run(storage, null)).toBe(false)
  })

  it("hides it while ?ui= asks for another language than the server drew", () => {
    expect(run(fakeStorage(), null, lesson, { search: "?ui=es" })).toBe(true)
    expect(
      run(fakeStorage(), null, lesson, { lang: "es", search: "?ui=es" })
    ).toBe(false)
  })

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
